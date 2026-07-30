import { randomBytes } from "node:crypto";

// Dependency-free helpers with no infrastructure of their own.

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // excludes I, L, O, U

function encodeTime(nowMs: number, len: number): string {
  let out = "";
  let n = nowMs;
  for (let i = len - 1; i >= 0; i--) {
    const mod = n % 32;
    out = CROCKFORD[mod] + out;
    n = (n - mod) / 32;
  }
  return out;
}

function encodeRandom(len: number): string {
  let out = "";
  for (const b of randomBytes(len)) out += CROCKFORD[b % 32];
  return out;
}

/**
 * ULID (Universally Unique Lexicographically Sortable Identifier), spec-compliant: 26 chars of
 * Crockford base32 = 48-bit millisecond timestamp (10 chars) + 80-bit randomness (16 chars).
 *
 * Time-ordered like UUIDv7 but a compact, URL-safe, opaque string — good for ids that travel to third
 * parties (a webhook id a consumer dedups on, a public reference in a receipt). A fresh random suffix
 * per call is enough at our volumes; there is no monotonicity guarantee inside one millisecond.
 */
export function ulid(nowMs: number = Date.now()): string {
  return encodeTime(nowMs, 10) + encodeRandom(16);
}

const SECRET_QUERY_PARAM = /([?&](?:token|code|secret|key|otp|hmac|signature|password|apikey|api_key)=)[^&"'\s)]+/gi;
const SECRET_KEY =
  /^(?:token|secret|password|apikey|api_key|authorization|hmac|secret_token|x-api-key|sm-api-key|sm-signature|sm-internal-token)$/i;
const REDACTED = "[redacted]";

/**
 * Strip credentials before a payload is written somewhere long-lived (a delivery log row, an audit
 * record, a support attachment). Two passes: token-like URL query params inside any string (a verify
 * link in a mail body, a callback URL carrying a signing token) and object KEYS that name a credential.
 *
 * Structure is preserved so a stored payload can still be re-sent or diffed — only the secret VALUE is
 * replaced. Returns a copy; the input is not mutated.
 */
export function redactSecrets<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") return value.replace(SECRET_QUERY_PARAM, `$1${REDACTED}`) as T;
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? REDACTED : redactSecrets(v);
    }
    return out as T;
  }
  return value;
}
