# RPC (Connect)

## Service Decorators

```ts
import { Module, RpcMethod, RpcService } from "@smounters/core/decorators";
import { AuthRPC } from "@proto/public/auth_pb";

@RpcService(AuthRPC)
class AuthRpcController {
  @RpcMethod(AuthRPC.method.signIn)
  async signIn(payload: { email: string }) {
    return { email: payload.email };
  }
}

@Module({
  controllers: [AuthRpcController],
})
class AuthModule {}
```

## RPC Parameter Decorators

- `@RpcData(key?)`
- `@RpcContext()`
- `@RpcHeaders()`
- `@RpcHeader(name)`
- `@RpcAbortSignal()` — injects `AbortSignal` (useful for streaming)

```ts
@RpcMethod(AuthRPC.method.signIn)
async signIn(
  @RpcData("email") email: string,
  @RpcHeader("x-request-id") requestId: string | undefined,
) {
  return { email, requestId };
}
```

## Server Streaming

Imperium supports server streaming RPC via `async function*`. ConnectRPC delivers this as SSE (Server-Sent Events) in browsers — no WebSocket needed.

```ts
import { RpcAbortSignal, RpcData, RpcMethod, RpcService } from "@smounters/core/decorators";
import { EventsService } from "@proto/events_pb";

@RpcService(EventsService)
class EventsController {
  @RpcMethod(EventsService.method.streamEvents)
  async *streamEvents(
    @RpcData() req: { channel: string },
    @RpcAbortSignal() signal: AbortSignal,
  ) {
    while (!signal.aborted) {
      const events = await fetchNewEvents(req.channel);
      for (const event of events) {
        yield event;
      }
      await sleep(1000);
    }
  }
}
```

Guards and pipes run before the generator starts. Filters catch errors thrown during iteration. Interceptors are **not** applied to streaming methods — they wrap single responses by design.

::: info Supported method kinds
Only `unary` and `server_streaming` are supported. Client streaming and bidirectional streaming will throw at startup.
:::

## Unified Server

No separate RPC server is needed. Imperium auto-detects registered HTTP/RPC handlers and serves both on one Fastify instance.

```ts
await app.start({
  host: "0.0.0.0",
  port: 8000,
  prefix: "/api",
  httpPrefix: "/http",
  rpcPrefix: "/rpc",
});
```

Final RPC base URL = `prefix + rpcPrefix`.
