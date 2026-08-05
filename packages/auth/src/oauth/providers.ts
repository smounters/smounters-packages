import type { ProviderDescriptor, RawProfile } from "./types.js";
import { OAuthError } from "./types.js";

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

export const GOOGLE: ProviderDescriptor = {
  id: "google",
  label: "Google",
  discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
  issuer: "https://accounts.google.com",
  scopes: ["openid", "email", "profile"],
  usesIdToken: true,
  verifiesEmail: true,
  // Ask which account to use. Without it a browser signed into several accounts picks silently, and
  // the person links the wrong one without noticing.
  authorizeParams: { prompt: "select_account" },
};

export const MICROSOFT: ProviderDescriptor = {
  id: "microsoft",
  label: "Microsoft",
  discoveryUrl: "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
  scopes: ["openid", "email", "profile"],
  usesIdToken: true,
  verifiesEmail: true,
  authorizeParams: { prompt: "select_account" },
};

export const LINKEDIN: ProviderDescriptor = {
  id: "linkedin",
  label: "LinkedIn",
  discoveryUrl: "https://www.linkedin.com/oauth/.well-known/openid-configuration",
  issuer: "https://www.linkedin.com/oauth",
  scopes: ["openid", "email", "profile"],
  usesIdToken: true,
  verifiesEmail: true,
};

export const FACEBOOK: ProviderDescriptor = {
  id: "facebook",
  label: "Facebook",
  authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
  tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
  userInfoUrl: "https://graph.facebook.com/v21.0/me?fields=id,name,email,picture",
  scopes: ["email", "public_profile"],
  usesIdToken: false,
  // Deliberately false: Facebook returns an email without saying whether it is verified, and it may be
  // missing entirely. Auto-linking on it would let anyone claim an existing account by that address.
  verifiesEmail: false,
  readUserInfo: (json): RawProfile => ({
    subject: String(json.id ?? ""),
    email: str(json.email),
    emailVerified: false,
    name: str(json.name),
    picture: str((json.picture as { data?: { url?: string } } | undefined)?.data?.url),
  }),
};

/** Any OIDC-compliant server (self-hosted Keycloak, Authentik, Zitadel …) — endpoints come from discovery. */
export const OIDC: ProviderDescriptor = {
  id: "oidc",
  label: "OIDC",
  scopes: ["openid", "email", "profile"],
  usesIdToken: true,
  verifiesEmail: true,
};

export const PROVIDERS: Record<string, ProviderDescriptor> = {
  [GOOGLE.id]: GOOGLE,
  [MICROSOFT.id]: MICROSOFT,
  [LINKEDIN.id]: LINKEDIN,
  [FACEBOOK.id]: FACEBOOK,
  [OIDC.id]: OIDC,
};

export function describeProvider(id: string): ProviderDescriptor {
  const found = PROVIDERS[id];
  if (!found) throw new OAuthError(`unknown provider "${id}"`, "config");
  return found;
}
