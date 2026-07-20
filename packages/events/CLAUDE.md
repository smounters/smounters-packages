# @smounters/events

Typed event emitter package. Part of the [smounters-public monorepo](../../CLAUDE.md).

## What this package is

In-process event emitter with `@OnEvent()` decorator and wildcard pattern matching for imperium apps. Zero runtime dependencies.

- **npm:** `@smounters/events` (v2.0.0)

## API surface

- `@OnEvent(pattern)` — method decorator, supports exact match and `*` wildcard
- `EventModule.register({ listeners })` — dynamic module
- `EventService` — injectable singleton, `emit(event, payload?)` and `getHandlers()`

## How it works internally

1. `EventModule.register()` filters listeners with `@OnEvent()` metadata
2. `EventBootstrap` (OnModuleInit) resolves listener instances from DI and registers in EventService
3. `emit()` finds matching handlers via regex (compiled from pattern), runs all concurrently via `Promise.allSettled`
4. Errors in handlers are caught and logged — never block caller or other handlers

## Tests

10 integration tests: exact match, wildcard, async handlers, error isolation, multiple handlers, introspection.

## Publishing

Tag `events/vX.Y.Z` from repo root. Before tagging:
1. Update CHANGELOG.md in this directory
2. Update README.md if API changed
3. Verify: `pnpm run typecheck && pnpm run test`
