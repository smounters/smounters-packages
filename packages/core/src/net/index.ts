import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// SSRF guard for outbound requests whose URL is configurable by a user, a tenant admin or a merchant
// (postback targets, webhook endpoints, avatar imports). Without it such a URL can point at a
// cluster-internal service or the cloud metadata endpoint (169.254.169.254) and the server will happily
// fetch it — the request comes from inside the perimeter.

/** Is this IP literal in a private / loopback / link-local / reserved range? Pure, unit-tested. */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateV4(ip);
  if (v === 6) return isPrivateV6(ip.toLowerCase());
  return false;
}

function isPrivateV4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformed → unsafe
  const [a, b] = p as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true; // "this", private, loopback
  if (a === 169 && b === 254) return true; // link-local (incl. the 169.254.169.254 metadata address)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 (IETF) + 192.0.2.0/24 (documentation)
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved + 255.255.255.255
  return false;
}

function isPrivateV6(ip: string): boolean {
  if (ip === "::1" || ip === "::") return true; // loopback / unspecified
  const mapped = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip); // IPv4-mapped → check the embedded IPv4
  if (mapped?.[1]) return isPrivateV4(mapped[1]);
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // ULA fc00::/7
  if (ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) return true; // link-local
  return false;
}

/**
 * Throw unless `rawUrl` is a safe public http(s) target: blocks non-http schemes, internal hostnames,
 * IP literals in private ranges, and hostnames that DNS-resolve into a private range.
 *
 * Known limit: a determined DNS-rebinding attacker can still win the race between this check and the
 * socket connect. Closing that needs connect-time pinning; this blocks the realistic cases —
 * misconfiguration and metadata-endpoint grabs.
 */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error(`scheme ${u.protocol} not allowed`);
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || /\.(local|internal|localhost)$/.test(host)) throw new Error(`internal host ${host}`);

  if (isIP(host) !== 0) {
    if (isPrivateIp(host)) throw new Error(`private address ${host}`);
    return;
  }
  const addrs = await lookup(host, { all: true });
  for (const a of addrs) if (isPrivateIp(a.address)) throw new Error(`${host} resolves to private ${a.address}`);
}

const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * A request was refused as an SSRF risk (private/internal target, bad scheme, or a redirect to one).
 * Deliberately distinct from transient network/timeout errors: callers should treat it as a PERMANENT
 * misconfiguration — mark the delivery blocked instead of retrying it forever.
 */
export class SsrfBlockedError extends Error {}

export interface SafeFetchInit extends RequestInit {
  /** Abort after this many ms (default 10s). Ignored when an explicit `signal` is supplied. */
  timeoutMs?: number;
}

/**
 * SSRF-safe outbound fetch. `assertPublicUrl` on its own only validates the FIRST url while `fetch`
 * defaults to following redirects — so a public host could answer 302 → a private address and the guard
 * would be bypassed. This follows redirects MANUALLY and re-validates every hop, with a timeout.
 *
 * Route every outbound request built from a user- or tenant-supplied URL through here.
 */
export async function safeFetch(url: string, init: SafeFetchInit = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = init;
  let current = url;
  for (let hop = 0; ; hop++) {
    try {
      await assertPublicUrl(current); // the initial URL AND every redirect target
    } catch (err) {
      throw new SsrfBlockedError((err as Error).message);
    }
    const res = await fetch(current, {
      ...rest,
      redirect: "manual",
      signal: signal ?? AbortSignal.timeout(timeoutMs),
    });
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get("location");
    if (!location) return res; // 3xx without Location — nothing to follow
    if (hop >= MAX_REDIRECTS) throw new SsrfBlockedError("too many redirects");
    current = new URL(location, current).toString(); // relative → absolute; the loop re-validates
  }
}
