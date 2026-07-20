# Server Options

`Application.start(options?)` accepts `ServerOptions`.

## Network

- `host?: string`
- `port?: number`

If `port` is omitted, Imperium tries `APP_PORT` from current app config (by default it starts with `process.env`).

## Path Prefixes

- `prefix?: string` (global)
- `httpPrefix?: string`
- `rpcPrefix?: string`

## Fastify Runtime Options

- `trustProxy`
- `requestTimeout`
- `connectionTimeout`
- `keepAliveTimeout`
- `bodyLimit`
- `routerOptions`
- `pluginTimeout`
- `maxParamLength` (legacy, deprecated in favor of `routerOptions.maxParamLength`)

## Observability and Safety

- `accessLogs?: boolean`
- `exposeInternalErrors?: boolean`
- `loggerOptions?: LoggerOptions`

## CORS

- `cors?: boolean | CorsOptions`

`false` or `undefined` disables CORS plugin registration.

## Health

- `health?: boolean | HealthOptions`

Use `health: true` for default `/health` endpoint, or custom object:

```ts
health: {
  enabled: true,
  path: "/health",
  check: async () => ({ ok: true, details: { db: "up" } }),
}
```

## Graceful Shutdown

- `gracefulShutdown?: boolean | GracefulShutdownOptions`

Defaults:

- signals: `SIGINT`, `SIGTERM`
- timeout: `15000ms`
- `forceExitOnFailure: false`

## Built-in Config and Logger Injection

`ServerOptions` also supports:

- `config?: { schema, source? }`
- `loggerOptions?: LoggerOptions`

For full control, prefer pre-start methods on `Application`:

```ts
app.configureConfig(appConfigSchema, process.env);
app.configureLogger(loggerOptions);
await app.start({ port: 8000 });
```
