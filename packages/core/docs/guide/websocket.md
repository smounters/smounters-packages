# WebSocket Gateway

Imperium supports real-time WebSocket communication via `@fastify/websocket`. No socket.io — just native WebSocket with message routing.

## Installation

`@fastify/websocket` is an **optional** peer dependency. Install it only if you need WebSocket support:

```bash
pnpm add @fastify/websocket
```

## Gateway Definition

```ts
import { WsGateway, WsHandler, WsConnection, WsMessage, WsRequest } from "@smounters/core/decorators";
import { UseGuards } from "@smounters/core/decorators";
import type { WsGatewayLifecycle } from "@smounters/core/ws";
import type { WebSocket } from "@fastify/websocket";
import type { FastifyRequest } from "fastify";

@WsGateway("/ws")
@UseGuards(AuthGuard)
class NotificationsGateway implements WsGatewayLifecycle {
  private clients = new Set<WebSocket>();

  onConnection(socket: WebSocket, req: FastifyRequest) {
    this.clients.add(socket);
  }

  onDisconnect(socket: WebSocket) {
    this.clients.delete(socket);
  }

  @WsHandler("subscribe")
  onSubscribe(
    @WsConnection() ws: WebSocket,
    @WsMessage() data: { channel: string },
  ) {
    // handle subscription logic
  }

  @WsHandler("ping")
  onPing(@WsConnection() ws: WebSocket) {
    ws.send(JSON.stringify({ type: "pong" }));
  }

  broadcast(type: string, payload: unknown) {
    const msg = JSON.stringify({ type, data: payload });
    for (const ws of this.clients) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }
}
```

## Module Registration

Gateways are registered as regular providers:

```ts
@Module({
  providers: [NotificationsGateway],
})
class AppModule {}
```

Imperium auto-detects providers with `@WsGateway()` metadata and registers them on the specified path.

## Message Protocol

Messages must be JSON with a `type` field:

```json
{ "type": "subscribe", "data": { "channel": "orders" } }
```

The `type` field is matched against `@WsHandler(messageType)` decorators. The `data` field is passed to the handler via `@WsMessage()`.

## Parameter Decorators

| Decorator | Injects |
|---|---|
| `@WsConnection()` | WebSocket instance |
| `@WsMessage()` | Parsed `data` from the message |
| `@WsRequest()` | Original Fastify upgrade request |

## Lifecycle Hooks

Implement `WsGatewayLifecycle` for connection/disconnect events:

```ts
interface WsGatewayLifecycle {
  onConnection?(socket: WebSocket, req: FastifyRequest): void | Promise<void>;
  onDisconnect?(socket: WebSocket): void | Promise<void>;
}
```

## Guards

Guards run at **connection time** (during the WebSocket upgrade request). If a guard returns `false`, the connection is closed with code `4403`.

Class-level `@UseGuards()` and global `APP_GUARD` both work:

```ts
@WsGateway("/ws")
@UseGuards(AuthGuard)
class SecureGateway { ... }
```

## Context

WebSocket handlers participate in the unified `BaseContext` system. In guards and filters, use `ctx.switchToWs()`:

```ts
class AuthGuard implements Guard {
  canActivate(ctx: BaseContext) {
    if (ctx.getType() === "ws") {
      const req = ctx.switchToWs().getRequest();
      // check auth headers from upgrade request
    }
    return true;
  }
}
```

::: tip No @fastify/websocket?
If gateways are registered but `@fastify/websocket` is not installed, the server will throw a clear error at startup telling you to install it.
:::
