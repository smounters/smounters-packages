# Cron Scheduling

Schedule recurring tasks with `@Cron()` decorator. Jobs auto-stop on application shutdown.

Provided by [`@smounters/cron`](https://www.npmjs.com/package/@smounters/cron).

## Install

```bash
pnpm add @smounters/cron
```

## Basic Usage

```ts
import { Injectable, Module } from "@smounters/core/decorators";
import { Cron, CronModule } from "@smounters/cron";

@Injectable()
class MarketSync {
  @Cron("*/30 * * * * *") // every 30 seconds
  async syncPrices() {
    // fetch latest prices from exchange
  }

  @Cron("0 0 * * *", { name: "daily-cleanup" }) // midnight daily
  async cleanup() {
    // remove stale data
  }
}

@Module({
  imports: [CronModule.register({ providers: [MarketSync] })],
})
class AppModule {}
```

## `@Cron(expression, options?)`

Method decorator. Registers the method to run on a cron schedule.

- `expression` — standard cron expression. Supports 6 fields with seconds: `* * * * * *`
- `options.name` — optional human-readable name (used in logs and introspection)

### Expression Examples

| Expression | Schedule |
|---|---|
| `*/30 * * * * *` | Every 30 seconds |
| `0 * * * *` | Every minute |
| `0 */5 * * *` | Every 5 minutes |
| `0 0 * * *` | Daily at midnight |
| `0 0 * * MON` | Every Monday at midnight |
| `0 9,17 * * MON-FRI` | 9:00 and 17:00 on weekdays |

## `CronModule.register({ providers })`

Dynamic module. Pass providers that contain `@Cron()` decorated methods. Providers without `@Cron()` are ignored.

```ts
@Module({
  imports: [
    CronModule.register({
      providers: [MarketSync, Cleanup, SomeServiceWithoutCron],
      // SomeServiceWithoutCron is silently skipped
    }),
  ],
})
class AppModule {}
```

## `CronService`

Injectable service for runtime introspection:

```ts
import { CronService } from "@smounters/cron";

@Injectable()
class AdminController {
  constructor(private readonly cron: CronService) {}

  listJobs() {
    return this.cron.getJobs();
    // [{ name: "daily-cleanup", expression: "0 0 * * *", running: true }]
  }
}
```

Methods:

- `getJobs()` — returns all registered jobs with name, expression, and running status
- `stopAll()` — stops all jobs (called automatically on `OnApplicationShutdown`)

## Lifecycle

- Jobs start immediately when the application bootstraps (`OnModuleInit`)
- Jobs stop automatically when the application shuts down (`OnApplicationShutdown`)
- If a job handler throws, the error is logged and the job continues on the next tick

## Built on Croner

Under the hood, `imperium-cron` uses [croner](https://github.com/Hexagon/croner) — a zero-dependency cron scheduler that works in Node.js, Bun, and Deno.
