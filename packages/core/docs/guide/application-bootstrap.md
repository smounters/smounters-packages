# Application Bootstrap

`Application` is the public bootstrap API from `@smounters/core/core`.

## Why It Exists

It wraps internal container/server wiring and gives you a deterministic startup sequence:

1. Create app and load module graph.
2. Configure config/logger before startup.
3. Resolve services (including `ConfigService`) before binding ports.
4. Start HTTP/RPC server.

## Recommended Flow

```ts
import "reflect-metadata";

import { Application } from "@smounters/core/core";
import { ConfigService, LoggerService } from "@smounters/core/services";
import { appConfigSchema, type AppConfig } from "@smounters/core/validation";

const app = new Application(AppModule, {
  host: "0.0.0.0",
  accessLogs: true,
});

app.configureConfig(appConfigSchema, process.env);

const configService = app.resolve(ConfigService<AppConfig>);
const config = configService.getAll();

app.configureLogger({
  name: "backend",
  minLevel: 3,
});

await app.start({
  port: config.APP_PORT,
  prefix: config.APP_GLOBAL_PREFIX,
});

app.resolve(LoggerService).info({ event: "app.started", port: config.APP_PORT });
```

## Main Methods

- `resolve(token)`
- `resolveAll(token)`
- `configureConfig(schema, source?)`
- `configureLogger(options?)`
- `setServerOptions(partial)`
- `getServerOptions()`
- `start(options?)`
- `close(signal?)`

## Backward Compatibility

The old pattern also works:

```ts
const app = new Application(AppModule, { host: "0.0.0.0", port: 8000 });
await app.start();
```
