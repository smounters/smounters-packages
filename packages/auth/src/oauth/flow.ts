import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import { requireEndpoint, resolveEndpoints } from "./endpoints.js";
import type { ClientConfig, OAuthProfile, ProviderDescriptor, RawProfile, TokenSet } from "./types.js";
import { OAuthError } from "./types.js";

export interface AuthorizeInput {
  descriptor: ProviderDescriptor;
  config: ClientConfig;
  /** Opaque one-time value; the caller stores what it means. */
  state: string;
  nonce?: string;
  codeChallenge?: string;
  /** Pre-fill the account picker (e.g. when re-linking a known address). */
  loginHint?: string;
  /** Restrict a Google Workspace login to one hosted domain. */
  hostedDomain?: string;
}

export function buildAuthorizeUrl(input: AuthorizeInput): Promise<string> {
  return resolveEndpoints(input.descriptor, input.config).then((endpoints) => {
    const scopes = input.config.scopes?.length ? input.config.scopes : input.descriptor.scopes;
    const url = new URL(requireEndpoint(endpoints.authorizeUrl, "authorize endpoint", input.descriptor.id));
    const params: Record<string, string> = {
      response_type: "code",
      client_id: input.config.clientId,
      redirect_uri: input.config.redirectUri,
      scope: scopes.join(" "),
      state: input.state,
      ...input.descriptor.authorizeParams,
    };
    if (input.nonce) params.nonce = input.nonce;
    if (input.codeChallenge) {
      params.code_challenge = input.codeChallenge;
      params.code_challenge_method = "S256";
    }
    if (input.loginHint) params.login_hint = input.loginHint;
    if (input.hostedDomain) params.hd = input.hostedDomain;
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
  });
}

export interface ExchangeInput {
  descriptor: ProviderDescriptor;
  config: ClientConfig;
  code: string;
  codeVerifier?: string;
}

export async function exchangeCode(input: ExchangeInput): Promise<TokenSet> {
  const endpoints = await resolveEndpoints(input.descriptor, input.config);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.config.redirectUri,
    client_id: input.config.clientId,
    client_secret: input.config.clientSecret,
  });
  if (input.codeVerifier) body.set("code_verifier", input.codeVerifier);

  let res: Response;
  try {
    res = await fetch(requireEndpoint(endpoints.tokenUrl, "token endpoint", input.descriptor.id), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body,
    });
  } catch (err) {
    throw new OAuthError(`token request failed: ${(err as Error).message}`, "network");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail = typeof json.error === "string" ? json.error : `HTTP ${res.status}`;
    throw new OAuthError(`token exchange rejected: ${detail}`, "token");
  }
  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  if (!accessToken && typeof json.id_token !== "string") {
    throw new OAuthError("token response has neither access_token nor id_token", "token");
  }
  return {
    accessToken,
    idToken: typeof json.id_token === "string" ? json.id_token : undefined,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expiresIn: typeof json.expires_in === "number" ? json.expires_in : undefined,
    scope: typeof json.scope === "string" ? json.scope : undefined,
    raw: json,
  };
}

// Один набор ключей на URL: createRemoteJWKSet сам кеширует и сам переспрашивает при неизвестном kid,
// но только пока живёт экземпляр — создавать его на каждый вход значит ходить за ключами каждый раз.
const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const keySet = (url: string) => {
  const found = jwks.get(url);
  if (found) return found;
  const created = createRemoteJWKSet(new URL(url));
  jwks.set(url, created);
  return created;
};

export interface ProfileInput {
  descriptor: ProviderDescriptor;
  config: ClientConfig;
  tokens: TokenSet;
  /** Must equal the nonce sent to authorize — replay protection for the id_token. */
  nonce?: string;
}

/**
 * Identity of the person who just signed in.
 *
 * OIDC path: the `id_token` signature is verified against the provider's JWKS, plus issuer, audience
 * and nonce. Non-OIDC path (Facebook): the access token is spent on the userinfo endpoint. In both
 * cases the result is the same shape, so the application never branches on the provider.
 */
export async function fetchProfile(input: ProfileInput): Promise<OAuthProfile> {
  const { descriptor, config, tokens } = input;
  const endpoints = await resolveEndpoints(descriptor, config);

  if (descriptor.usesIdToken) {
    if (!tokens.idToken) throw new OAuthError("provider returned no id_token", "profile");
    const jwksUrl = requireEndpoint(endpoints.jwksUrl, "JWKS url", descriptor.id);
    let claims: Record<string, unknown>;
    try {
      const verified = await jwtVerify(tokens.idToken, keySet(jwksUrl), {
        issuer: endpoints.issuer,
        audience: config.clientId,
      });
      claims = verified.payload;
    } catch (err) {
      throw new OAuthError(`id_token rejected: ${(err as Error).message}`, "profile");
    }
    if (input.nonce && claims.nonce !== input.nonce) {
      throw new OAuthError("id_token nonce mismatch", "profile");
    }
    const subject = typeof claims.sub === "string" ? claims.sub : "";
    if (!subject) throw new OAuthError("id_token has no sub", "profile");
    return {
      provider: descriptor.id,
      subject,
      email: typeof claims.email === "string" ? claims.email : undefined,
      // Доверяем подтверждению почты, только если провайдер вообще умеет его давать честно.
      emailVerified: descriptor.verifiesEmail && claims.email_verified === true,
      name: typeof claims.name === "string" ? claims.name : undefined,
      picture: typeof claims.picture === "string" ? claims.picture : undefined,
      hostedDomain: typeof claims.hd === "string" ? claims.hd : undefined,
      raw: claims,
    };
  }

  const userInfoUrl = requireEndpoint(endpoints.userInfoUrl, "userinfo url", descriptor.id);
  let res: Response;
  try {
    res = await fetch(userInfoUrl, {
      headers: { authorization: `Bearer ${tokens.accessToken}`, accept: "application/json" },
    });
  } catch (err) {
    throw new OAuthError(`userinfo request failed: ${(err as Error).message}`, "network");
  }
  if (!res.ok) throw new OAuthError(`userinfo returned ${res.status}`, "provider");
  const json = (await res.json()) as Record<string, unknown>;
  const raw: RawProfile = descriptor.readUserInfo
    ? descriptor.readUserInfo(json)
    : {
        subject: String(json.sub ?? json.id ?? ""),
        email: typeof json.email === "string" ? json.email : undefined,
        emailVerified: json.email_verified === true,
        name: typeof json.name === "string" ? json.name : undefined,
        picture: typeof json.picture === "string" ? json.picture : undefined,
      };
  if (!raw.subject) throw new OAuthError("userinfo has no subject", "profile");
  return {
    ...raw,
    provider: descriptor.id,
    emailVerified: descriptor.verifiesEmail && raw.emailVerified === true,
    raw: json,
  };
}

/** Reads an id_token WITHOUT verifying it — diagnostics only, never for an access decision. */
export const peekIdToken = (idToken: string): Record<string, unknown> => decodeJwt(idToken);
