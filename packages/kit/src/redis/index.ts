import { randomUUID } from "node:crypto";
import type { OnModuleDestroy, OnModuleInit } from "@smounters/core/core";
import { Inject, Injectable } from "@smounters/core/decorators";
import { LoggerService } from "@smounters/core/services";
import Redis, { type RedisOptions } from "ioredis";

// Redis as one injectable service: connection lifecycle, pub/sub, a read-through cache and a distributed
// lock. Deliberately free of domain methods — anything that knows what an entity IS belongs to that
// feature, not here, or every product ends up carrying the others' keys.

export const REDIS_CONNECTION = Symbol("kit:redis-connection");

export interface RedisConnectionOptions {
  /** Connection string, e.g. `redis://host:6379/0`. */
  url: string;
  /** Passed through to ioredis; the defaults below are chosen for a request-serving process. */
  options?: RedisOptions;
  /**
   * Wait for the connection before the module finishes starting, and FAIL the startup if it errors.
   *
   * Two defensible stances, so it is a choice rather than a default: an API that also serves pages
   * should come up and warn (a cache outage is not an outage of the product), while a worker whose whole
   * job is queue-driven is better off refusing to start than pretending to work. Default is not to wait.
   */
  awaitReady?: boolean;
}

const DEFAULTS: RedisOptions = {
  // A request should fail fast rather than hang while a command is retried forever.
  maxRetriesPerRequest: 2,
  enableOfflineQueue: true,
};

/**
 * Register in the application with the connection supplied as a value provider — the package has no
 * opinion on where configuration comes from:
 *
 * ```ts
 * @Module({
 *   providers: [{ provide: REDIS_CONNECTION, useValue: { url: appConfig.REDIS_URL } }, RedisService],
 *   exports: [RedisService],
 *   global: true,
 * })
 * export class RedisModule {}
 * ```
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: RedisConnectionOptions,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.client = new Redis(this.connection.url, { ...DEFAULTS, ...this.connection.options });
    this.client.on("ready", () => this.logger.info({ type: "redis", event: "ready" }));
    this.client.on("error", (err: Error) => this.logger.warn({ type: "redis", event: "error", error: err.message }));
    if (this.connection.awaitReady) {
      await new Promise<void>((resolve, reject) => {
        this.client.once("ready", resolve);
        this.client.once("error", reject);
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  getClient(): Redis {
    return this.client;
  }

  /** Publish to a pub/sub channel. Returns the number of subscribers that received it. */
  publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  /**
   * A dedicated connection for SUBSCRIBE mode. A subscribing connection cannot run ordinary commands,
   * which is why this is a separate socket rather than the shared client.
   */
  createSubscriber(): Redis {
    return this.client.duplicate();
  }

  /**
   * Read-through JSON cache: return the cached value, otherwise run the loader, cache it and return.
   *
   * A loader that throws is NOT cached — the next call retries. A null/undefined result is returned but
   * also NOT cached, so a miss (an unknown token, a deleted row) cannot poison the cache. Invalidate
   * explicitly from whatever writes the source.
   */
  async cacheJson<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
    const hit = await this.client.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
    const value = await loader();
    if (value != null) await this.client.set(key, JSON.stringify(value), "EX", ttlSec);
    return value;
  }

  invalidate(...keys: string[]): Promise<number> {
    return keys.length > 0 ? this.client.del(...keys) : Promise.resolve(0);
  }

  /**
   * Run `fn` while holding a distributed lock (SET NX EX). Returns null WITHOUT running it when another
   * instance holds the lock — that is the point: a periodic tick must do its work once per cluster, not
   * once per replica.
   *
   * Release is a Lua compare-and-delete against a random token, so a lock that expired mid-run and was
   * re-acquired elsewhere is never freed by the previous owner. `ttlSec` must exceed the worst-case
   * runtime of `fn`, otherwise the lock can expire while the work is still going.
   */
  async withLock<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T | null> {
    const token = randomUUID();
    const acquired = await this.client.set(key, token, "EX", ttlSec, "NX");
    if (acquired !== "OK") return null;
    try {
      return await fn();
    } finally {
      await this.client
        .eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          key,
          token,
        )
        // Releasing is best-effort: the lock expires on its own, and a failure here must not mask
        // whatever fn returned or threw.
        .catch(() => undefined);
    }
  }
}
