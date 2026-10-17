# API Surface

Core exports only subpaths. Root import (`@smounters/core`) is intentionally disabled.

## `@smounters/core/core`

Runtime exports:

- `Application`
- `APP_GUARD`
- `APP_PIPE`
- `APP_INTERCEPTOR`
- `APP_FILTER`
- `Reflector`
- `consoleTransport` — built-in console log transport factory
- `Logger` — native transport-based logger (alias `AppLogger`)
- `HttpException`
- `BadRequestException`
- `UnauthorizedException`
- `ForbiddenException`
- `NotFoundException`
- `InternalServerErrorException`

Type exports (selected):

- `ModuleMeta`, `DynamicModule`, `Provider`
- `Guard`, `Interceptor`, `PipeTransform`, `ExceptionFilter`
- lifecycle hooks: `OnModuleInit`, `OnApplicationBootstrap`, `OnModuleDestroy`, `BeforeApplicationShutdown`, `OnApplicationShutdown`
- `ServerOptions`, `CorsOptions`, `HealthOptions`
- `LoggerOptions`, `LogLevel`, `LogEntry`, `LogTransport`
- `OnErrorCallback`, `ErrorContext`, `ErrorContextType`
- `BaseContext`, `ContextType`, `HttpArgumentsHost`, `RpcArgumentsHost`, `WsArgumentsHost`

## `@smounters/core/decorators`

- DI: `Module`, `Injectable`, `Inject`, `InjectAll`, `Optional`, `Scope`
- HTTP: `HttpController`, `Get`, `Post`, `Put`, `Patch`, `Delete`, `Body`, `Query`, `Param`, `Header`, `Req`, `Res`
- RPC: `RpcService`, `RpcMethod`, `RpcData`, `RpcContext`, `RpcHeaders`, `RpcHeader`, `RpcAbortSignal`
- WebSocket: `WsGateway`, `WsHandler`, `WsConnection`, `WsMessage`, `WsRequest`
- Enhancers: `UseGuards`, `UsePipes`, `UseInterceptors`, `UseFilters`, `Catch`
- Metadata: `SetMetadata`

## `@smounters/core/services`

- `ConfigService`
- `LoggerService`

## `@smounters/core/pipes`

- `ZodPipe`

## `@smounters/core/validation`

- `appConfigSchema`
- `AppConfig`
- `booleanSchema`
- `numberSchema`
- `nativeEnumSchema`
- `stringArraySchema`
- `enumArraySchema`
- `enumSchema`

## `@smounters/core/ws`

- `registerWsGateways`
- `handleWsConnection`

Type exports:

- `WsGatewayLifecycle`
- `WsGatewayMeta`, `WsHandlerMeta`, `WsParamMeta`, `WsParamSource`

## `@smounters/core/http` <Badge type="tip" text="batteries" />

HTTP-edge helpers (formerly `@smounters/kit/http`):

- `clientIp(get)` — real external client IP behind CDN → edge → ingress → pod
- `clientIpNormalizeHook()` — Fastify `onRequest`: rewrite `x-forwarded-for` so `req.ip` is spoof-proof
- `requestContextHook(options?)` — Fastify `onRequest`: one request id across the whole chain
- `rateLimitHook(options)` — Fastify `onRequest`: fixed-window counter in a shared store, fail-open
- `bufferCapped(payload, limit)`, `stashRawBodyStream(req, payload, limit)` — exact request bytes with a hard limit
- `newRequestId()`, `acceptRequestId(inbound)`, `currentRequestContext()`, `currentRequestId()`, `runWithRequestContext(ctx, fn)`
- `PayloadTooLargeError`, types: `HeaderGetter`, `RequestContext`, `RateLimitStore`, `RateLimitBucket`, `RateLimitOptions`, `RawBodyRequest`

## `@smounters/core/log` <Badge type="tip" text="batteries" />

Structured logging transports (formerly `@smounters/kit/log`):

- `createTransports(options?)` — transports for `app.configureLogger()`: one-line JSON outside local, colour locally
- `createLogger(options?)` — standalone logger for code outside DI (entrypoint, scripts)
- `requestId`/`src` fields are mixed into every line automatically when `requestContextHook` is registered
- Types: `LogOptions`, `StandaloneLogger`, `LogEntry`, `LogLevel`, `LogTransport`

## `@smounters/core/net` <Badge type="tip" text="batteries" />

SSRF guard for outbound requests built from user- or tenant-supplied URLs (formerly `@smounters/kit/net`):

- `isPrivateIp(ip)`
- `assertPublicUrl(url)`
- `safeFetch(url, init?)` — manual redirect following, every hop re-validated
- `SsrfBlockedError`, type `SafeFetchInit`

## `@smounters/core/money` <Badge type="tip" text="batteries" />

Decimal money arithmetic on strings (formerly `@smounters/kit/money`):

- `toDecimal`, `toMoneyAmount`, `quantizeToDecimals`, `sumAmounts`, `applyDelta`, `isBalanced`, `createMoney`
- Constants: `MONEY_SCALE`, `RATE_SCALE`, `ZERO_MONEY`, `ROUND_DOWN`, `ROUND_UP`, `ROUND_HALF_UP`
- Types: `MoneyOptions`, `MoneyOps`, `PostingLine`
- Requires `decimal.js` (installed with the package)

## `@smounters/core/redis` <Badge type="tip" text="batteries" />

Redis as one injectable service (formerly `@smounters/kit/redis`):

- `RedisService` — connection lifecycle, pub/sub, read-through cache, distributed lock (`withLock`)
- `REDIS_CONNECTION` — DI token; supply the connection as a value provider
- Type: `RedisConnectionOptions`
- Requires optional peer dependency: `pnpm add ioredis`

## `@smounters/core/rpc/validate` <Badge type="tip" text="batteries" />

- `ProtoValidateInterceptor` — global protovalidate enforcement, `buf.validate` rules from the contract (formerly `@smounters/kit/rpc`)
- Requires optional peer dependencies: `pnpm add @bufbuild/protobuf @bufbuild/protovalidate`

## `@smounters/core/text` <Badge type="tip" text="batteries" />

Text mechanics (formerly `@smounters/kit/text`):

- `escapeLike`, `escapeHtml`, `escapeMarkdownV2`, `escapeValue`, `renderTemplate`, `resolvePath`, `splitPersonName`
- Type: `EscapeMode`

## `@smounters/core/util` <Badge type="tip" text="batteries" />

Dependency-free helpers (formerly `@smounters/kit/util`):

- `ulid(nowMs?)` — spec-compliant ULID
- `redactSecrets(value)` — strip credentials before long-lived storage

## `@smounters/cron` <Badge type="tip" text="separate package" />

- `Cron` — method decorator
- `CronModule` — dynamic module (`CronModule.register({ providers })`)
- `CronService` — injectable (`getJobs()`, `stopAll()`)

Install: `pnpm add @smounters/cron` — [Guide](/guide/cron)

## `@smounters/events` <Badge type="tip" text="separate package" />

- `OnEvent` — method decorator (supports wildcards)
- `EventModule` — dynamic module (`EventModule.register({ listeners })`)
- `EventService` — injectable (`emit()`, `getHandlers()`)

Install: `pnpm add @smounters/events` — [Guide](/guide/events)
