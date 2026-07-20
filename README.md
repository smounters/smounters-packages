# Imperium

NestJS-inspired modular DI framework for TypeScript services. Monorepo for all `@smounters/core` packages.

## Packages

| Package | Description | npm |
|---|---|---|
| [`@smounters/core`](packages/core/) | Core framework — HTTP + ConnectRPC + WebSocket on Fastify | [![npm](https://img.shields.io/npm/v/@smounters/core)](https://www.npmjs.com/package/@smounters/core) |
| [`@smounters/cron`](packages/cron/) | Cron scheduling with `@Cron()` decorator | [![npm](https://img.shields.io/npm/v/@smounters/cron)](https://www.npmjs.com/package/@smounters/cron) |
| [`@smounters/events`](packages/events/) | Typed event emitter with `@OnEvent()` and wildcards | [![npm](https://img.shields.io/npm/v/@smounters/events)](https://www.npmjs.com/package/@smounters/events) |

## Quick Start

```bash
pnpm add @smounters/core reflect-metadata tsyringe fastify @connectrpc/connect @connectrpc/connect-fastify zod tslog
```

```ts
import "reflect-metadata";
import { Application } from "@smounters/core/core";
import { HttpController, Get, Injectable, Module } from "@smounters/core/decorators";

@Injectable()
class HelloService {
  greet() { return { message: "Hello from Imperium" }; }
}

@HttpController("/api")
class ApiController {
  constructor(private readonly hello: HelloService) {}

  @Get("/hello")
  greet() { return this.hello.greet(); }
}

@Module({ providers: [HelloService], httpControllers: [ApiController] })
class AppModule {}

await new Application(AppModule).start({ port: 3000 });
```

## Documentation

Full guide and API reference: **[smounters.github.io/smounters-public](https://smounters.github.io/smounters-public/)**

## Development

```bash
pnpm install          # install all dependencies
pnpm run typecheck    # typecheck all packages
pnpm run test         # run all tests
pnpm run build        # build all packages
pnpm run docs:dev     # VitePress dev server
```

## Publishing

All three packages are published together from a single tag — they share a version:

```bash
git tag v2.0.1 && git push origin v2.0.1
```

CI resolves the version from the tag, runs typecheck and tests, then builds and publishes
`@smounters/core`, `@smounters/cron` and `@smounters/events` to npm, deploys the docs and
creates a GitHub release.

## License

MIT
