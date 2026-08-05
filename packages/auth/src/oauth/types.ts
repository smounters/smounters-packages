/**
 * Provider-agnostic OAuth2/OIDC types.
 *
 * The package knows how the protocol works and nothing about the product using it: no roles, no
 * account matching, no session issuing. Those are policy and must ship with the application, not with
 * an npm release.
 */

/** What a provider supports and where its endpoints live. Static per provider, not per installation. */
export interface ProviderDescriptor {
  id: string;
  label: string;
  /** OIDC discovery document. When set, endpoints below are optional — they are read from it. */
  discoveryUrl?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  jwksUrl?: string;
  userInfoUrl?: string;
  /** Expected `iss` claim. With discovery it is taken from the document. */
  issuer?: string;
  scopes: string[];
  /** OIDC: the token response carries an `id_token` we verify ourselves. */
  usesIdToken: boolean;
  /**
   * The provider states whether the email is verified AND that statement can be trusted.
   *
   * This drives whether an account may be auto-linked by email. Facebook is the reason this flag
   * exists: it does not give a trustworthy verified-email claim, and treating it like Google would
   * hand over an existing account to whoever registers that address there.
   */
  verifiesEmail: boolean;
  /** Extra query parameters for the authorize request (e.g. Google's `access_type`). */
  authorizeParams?: Record<string, string>;
  /** Non-OIDC providers: how to read the userinfo payload. */
  readUserInfo?: (json: Record<string, unknown>) => RawProfile;
}

/** One installation of a provider: credentials + where it may come back to. */
export interface ClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Overrides the descriptor (generic OIDC / self-hosted Keycloak). */
  discoveryUrl?: string;
  issuer?: string;
  scopes?: string[];
}

export interface RawProfile {
  subject: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  /** Google Workspace hosted domain, when present. */
  hostedDomain?: string;
}

export interface OAuthProfile extends RawProfile {
  provider: string;
  /** Verified id_token claims or the userinfo payload — kept for auditing, never trusted blindly. */
  raw: Record<string, unknown>;
}

export interface TokenSet {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  raw: Record<string, unknown>;
}

/**
 * Endpoints after discovery is resolved. All optional on purpose: building an authorize URL needs no
 * token endpoint, and a token exchange needs no JWKS. Each operation demands only what it uses, so a
 * half-configured provider fails at the step that actually needs the missing piece.
 */
export interface ResolvedEndpoints {
  authorizeUrl?: string;
  tokenUrl?: string;
  jwksUrl?: string;
  userInfoUrl?: string;
  issuer?: string;
}

export class OAuthError extends Error {
  constructor(
    message: string,
    readonly code: "config" | "network" | "provider" | "token" | "profile",
  ) {
    super(message);
    this.name = "OAuthError";
  }
}
