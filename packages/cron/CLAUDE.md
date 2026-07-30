# @smounters/cron

Cron scheduling package. Part of the [smounters-packages monorepo](../../CLAUDE.md).

## What this package is

`@Cron()` method decorator + `CronModule` for scheduling tasks in imperium apps. Built on [croner](https://github.com/Hexagon/croner).

- **npm:** `@smounters/cron` (v2.0.0)
- **Runtime dependency:** `croner` (only runtime dep, everything else is peer)

## API surface

- `@Cron(expression, options?)` — method decorator
- `CronModule.register({ providers })` — dynamic module
- `CronService` — injectable, exposes `getJobs()` and `stopAll()`
- Jobs auto-stop on `OnApplicationShutdown`

## How it works internally

1. `CronModule.register()` filters providers that have `@Cron()` metadata
2. `CronBootstrap` (implements `OnModuleInit`) resolves providers from DI container and calls `CronService.registerProvider()`
3. `CronService` creates `Croner` instances for each decorated method
4. Container is passed via factory provider (`"cron:container"`) to resolve providers in correct scope

## Tests

6 integration tests in `tests/cron.test.ts`:
- Job registration, filtering, execution on schedule, shutdown cleanup

## Package-specific commands

```bash
pnpm --filter @smounters/cron run typecheck
pnpm --filter @smounters/cron run test
pnpm --filter @smounters/cron run build
```

## Publishing

Tag `cron/vX.Y.Z` from repo root. Before tagging:
1. Update CHANGELOG.md in this directory
2. Update README.md if API changed
3. Verify: `pnpm run typecheck && pnpm run test`
