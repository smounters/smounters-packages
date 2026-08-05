import type { ClientConfig, ProviderDescriptor, ResolvedEndpoints } from "./types.js";
import { OAuthError } from "./types.js";

interface DiscoveryDocument {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  jwks_uri?: string;
  userinfo_endpoint?: string;
}

// Документ дискавери меняется раз в годы, а запрашивался бы на каждый вход. Кеш на час — компромисс
// между «не ходить лишний раз» и «переживём ротацию у провайдера без перезапуска».
const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; doc: DiscoveryDocument }>();

export async function fetchDiscovery(url: string, now = Date.now()): Promise<DiscoveryDocument> {
  const hit = cache.get(url);
  if (hit && now - hit.at < TTL_MS) return hit.doc;
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch (err) {
    throw new OAuthError(`discovery request failed: ${(err as Error).message}`, "network");
  }
  if (!res.ok) throw new OAuthError(`discovery returned ${res.status}`, "provider");
  const doc = (await res.json()) as DiscoveryDocument;
  cache.set(url, { at: now, doc });
  return doc;
}

/** Only for tests and for the "check settings" button — never on the hot path. */
export function clearDiscoveryCache(): void {
  cache.clear();
}

/** Требуемый endpoint или внятная ошибка настройки — вместо `undefined` где-то дальше по стеку. */
export function requireEndpoint(value: string | undefined, name: string, providerId: string): string {
  if (!value) throw new OAuthError(`provider "${providerId}" has no ${name}`, "config");
  return value;
}

export async function resolveEndpoints(
  descriptor: ProviderDescriptor,
  config: ClientConfig,
): Promise<ResolvedEndpoints> {
  const discoveryUrl = config.discoveryUrl ?? descriptor.discoveryUrl;
  const doc = discoveryUrl ? await fetchDiscovery(discoveryUrl) : {};
  return {
    authorizeUrl: doc.authorization_endpoint ?? descriptor.authorizeUrl,
    tokenUrl: doc.token_endpoint ?? descriptor.tokenUrl,
    jwksUrl: doc.jwks_uri ?? descriptor.jwksUrl,
    userInfoUrl: doc.userinfo_endpoint ?? descriptor.userInfoUrl,
    issuer: doc.issuer ?? config.issuer ?? descriptor.issuer,
  };
}
