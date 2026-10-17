import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { FastifyReply, FastifyRequest } from "fastify";

// HTTP-edge helpers: who the caller really is, one id across the whole chain, exact request bytes, and a
// rate-limit window. All of them are mechanism only — the policy (which header we trust, which URL gets
// which limit) stays in the application.

// ─────────────────────────────── real client IP ───────────────────────────────

type HeaderValue = string | string[] | null | undefined;
export type HeaderGetter = (name: string) => HeaderValue;

/** Left-most token of a (possibly comma-joined or repeated) header value, trimmed. */
function firstHop(v: HeaderValue): string {
  const s = Array.isArray(v) ? v[0] : v;
  return (s ?? "").split(",")[0]?.trim() ?? "";
}

/**
 * The real external client IP behind a CDN → own edge → ingress → pod chain.
 *
 * Trust order (first non-empty wins) and why it matters: with `trustProxy` enabled the app trusts every
 * hop, so `X-Forwarded-For` is client-controllable end to end — a caller can prepend a forged left-most
 * entry that the CDN only appends to. `CF-Connecting-IP` (set by Cloudflare) and `X-Real-IP` (set by your
 * own edge) are OVERWRITTEN by that infrastructure and therefore cannot be spoofed from outside, so they
 * win; XFF is the last resort. Empty string when nothing usable is present (local dev, health checks).
 *
 * Pass a getter that reads by lower-case name: works for Fastify `req.headers` and for WHATWG
 * `Headers.get` alike.
 */
export function clientIp(get: HeaderGetter): string {
  return firstHop(get("cf-connecting-ip")) || firstHop(get("x-real-ip")) || firstHop(get("x-forwarded-for")) || "";
}

/**
 * Fastify `onRequest`: rewrite the raw `x-forwarded-for` so that Fastify's own `req.ip` — and everything
 * built on it (framework access logs, rate-limit keys, stored remote addresses) — resolves to the real
 * client instead of a spoofable left-most entry. Only rewrites when a trustworthy infrastructure header
 * is present, so local development and non-CDN hosts keep default behaviour.
 *
 * MUST be registered FIRST: Fastify runs `onRequest` hooks in registration order, and everything reading
 * `req.ip` afterwards depends on this.
 */
export function clientIpNormalizeHook() {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const h = req.raw.headers;
    const trusted = firstHop(h["cf-connecting-ip"]) || firstHop(h["x-real-ip"]);
    if (trusted) h["x-forwarded-for"] = trusted;
  };
}

// ───────────────────────────── request context ─────────────────────────────

export interface RequestContext {
  requestId: string;
  /**
   * Where the chain started: `http` — an external call, `job` — a queue worker, `event` — a message
   * consumer, `cron` — a scheduled tick. Lets a log query tell "someone called us" from "we started it".
   */
  source: "http" | "job" | "event" | "cron";
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * `req_<hex>` — one shape of id across every process, safe to hand to a caller for a support request.
 */
export function newRequestId(): string {
  return `req_${randomUUID().replace(/-/g, "")}`;
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** Run work inside a context. Everything asynchronous started inside sees the same id. */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

// An inbound id is only accepted if it LOOKS like an id: the value ends up in log lines and in a response
// header, so an arbitrary caller-supplied string is log injection plus noise in the log store.
const ID_RE = /^[\w.-]{1,80}$/;

export function acceptRequestId(inbound: string | undefined): string {
  return inbound && ID_RE.test(inbound) ? inbound : newRequestId();
}

/**
 * Fastify `onRequest`: open a context for the whole request and echo the id back in a header.
 *
 * Why AsyncLocalStorage and not a parameter: threading an id through every layer (RPC → service →
 * service → repository) would mean changing every signature for a field only the logs care about. The log
 * transport reads the context itself, so calling code stays unaware.
 *
 * Register AFTER `clientIpNormalizeHook` and BEFORE everything else: this hook continues the chain inside
 * `storage.run`, so only hooks registered later see the context.
 */
export function requestContextHook(options: { headerName?: string } = {}) {
  const headerName = options.headerName ?? "X-Request-Id";
  const lower = headerName.toLowerCase();
  return (req: FastifyRequest, reply: FastifyReply, done: () => void): void => {
    const raw = req.headers[lower];
    const inbound = Array.isArray(raw) ? raw[0] : raw;
    const requestId = acceptRequestId(inbound?.trim() ? inbound.trim() : undefined);
    reply.header(headerName, requestId);
    runWithRequestContext({ requestId, source: "http" }, done);
  };
}

// ─────────────────────────────── raw body ───────────────────────────────

interface RawBodyRequest extends FastifyRequest {
  rawBody?: Buffer;
}

/** Body over the limit. `statusCode` is the Fastify idiom — the default error handler renders 413. */
export class PayloadTooLargeError extends Error {
  readonly statusCode = 413;
  constructor(limit: number) {
    super(`Request body exceeds the ${limit}-byte limit`);
    this.name = "PayloadTooLargeError";
  }
}

/**
 * Drain a stream into one Buffer, ABORTING as soon as the limit is passed: the offending chunk is not
 * kept and no further chunks are pulled, so an oversized body never sits in the heap in full.
 */
export async function bufferCapped(payload: AsyncIterable<Buffer | string>, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of payload) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > limit) throw new PayloadTooLargeError(limit);
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

/**
 * Capture the EXACT request bytes on `req.rawBody` and return a fresh equivalent stream so the normal
 * parser still fills `req.body` for the handler.
 *
 * Needed wherever a signature is computed over the raw bytes: a re-serialized object produces different
 * bytes (key order, spacing, number formatting) and the verification fails for a legitimate caller.
 */
export async function stashRawBodyStream(req: FastifyRequest, payload: Readable, limit: number): Promise<Readable> {
  const raw = await bufferCapped(payload, limit);
  (req as RawBodyRequest).rawBody = raw;
  const stream = new Readable();
  stream.push(raw);
  stream.push(null);
  (stream as Readable & { receivedEncodedLength?: number }).receivedEncodedLength = raw.length;
  return stream;
}

// ─────────────────────────────── rate limit ───────────────────────────────

/** Minimal shape of the counter store — structural, so this module needs no Redis dependency. */
export interface RateLimitStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export interface RateLimitBucket {
  /** Bucket name; part of the counter key, so two buckets never share a counter. */
  name: string;
  limit: number;
}

export interface RateLimitOptions {
  store: () => RateLimitStore;
  /** Window length in seconds. A getter, because a limit is a business setting that may change live. */
  windowSec: () => Promise<number> | number;
  /** Which bucket a request belongs to — the POLICY, and it stays in the application. null = exempt. */
  bucketFor: (req: FastifyRequest) => Promise<RateLimitBucket | null> | RateLimitBucket | null;
}

/**
 * Fastify `onRequest`: fixed-window counter per (bucket, IP), kept in the shared store so the limit is
 * global across replicas rather than per-process.
 *
 * FAIL-OPEN by design: a store outage must not become an outage of the product. A limiter that blocks
 * everything when Redis blinks is worse than one that briefly stops limiting.
 *
 * Requires `clientIpNormalizeHook` to be registered earlier, otherwise the key is built from a
 * spoofable address and the limit can be evaded by forging a header.
 */
export function rateLimitHook(options: RateLimitOptions) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const bucket = await options.bucketFor(req);
      if (!bucket) return;
      const win = await options.windowSec();
      const key = `rl:${bucket.name}:${req.ip}`;
      const store = options.store();
      const n = await store.incr(key);
      if (n === 1) await store.expire(key, win);
      if (n > bucket.limit) {
        await reply.code(429).header("retry-after", String(win)).send({ error: "rate_limited" });
      }
    } catch {
      // fail-open
    }
  };
}
