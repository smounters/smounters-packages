# @smounters/core

Core framework package. Part of the [smounters-packages monorepo](../../CLAUDE.md).

## What this package is

NestJS-like modular DI container with unified HTTP + ConnectRPC + WebSocket server for TypeScript.

- **npm:** `@smounters/core` (v2.0.1)
- **Runtime:** Node.js >=20.0.0, ESM only
- **Zero runtime dependencies** — all deps are peer (fastify, connectrpc, tsyringe, zod, tslog)

## Subpath exports (no root import)

```ts
import { Application } from "@smounters/core/core";
import { Module, Injectable, HttpController, Get, RpcService, RpcMethod, RpcAbortSignal, WsGateway, WsHandler } from "@smounters/core/decorators";
import { ZodPipe } from "@smounters/core/pipes";
import { ConfigService, LoggerService } from "@smounters/core/services";
import { appConfigSchema } from "@smounters/core/validation";
import { registerWsGateways } from "@smounters/core/ws";
```

## Key architecture

- **Module system:** `@Module({ providers, controllers, httpControllers, imports, exports, global })`
- **DI:** tsyringe-based, singleton by default, request-scoped via AsyncLocalStorage
- **Request lifecycle:** Guards → Pipes → Interceptors → Handler → Filters (same for HTTP, RPC, WS)
- **Transport:** HTTP (Fastify), RPC unary + server streaming (ConnectRPC), WebSocket (@fastify/websocket optional)
- **BaseContext:** unified `switchToHttp()` / `switchToRpc()` / `switchToWs()`
- **Interceptors** do NOT apply to streaming RPC or WebSocket — by design

## Tests

23 integration tests in `tests/`:
- `http.test.ts` (6) — GET/POST, query/path params, prefix
- `logger-transport.test.ts` (6) — transports, onError callback
- `ws.test.ts` (5) — ping/pong, echo, guard reject/allow
- `guards-pipes.test.ts` (4) — class guards, global APP_GUARD
- `lifecycle.test.ts` (2) — onModuleInit, onModuleDestroy

Transformed by SWC, not esbuild — see the decorator-metadata note in the root CLAUDE.md.

## Current limitations

- Only unary + server streaming RPC — client/bidi streaming throw
- `Constructor<T>` uses `any[]` (tsyringe requirement)

## Package-specific commands

```bash
pnpm --filter @smounters/core run typecheck
pnpm --filter @smounters/core run test
pnpm --filter @smounters/core run build
pnpm --filter @smounters/core run docs:dev
```

## Publishing

Tag `vX.Y.Z` from repo root. Before tagging:
1. Update CHANGELOG.md in this directory
2. Update VitePress docs if API changed
3. Verify: `pnpm run typecheck && pnpm run test && pnpm run docs:build`
