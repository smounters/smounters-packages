# Events

Decouple services with typed in-process events. Emit from anywhere, handle with `@OnEvent()` decorators. Supports wildcard patterns.

Provided by [`@smounters/events`](https://www.npmjs.com/package/@smounters/events).

## Install

```bash
pnpm add @smounters/events
```

## Basic Usage

```ts
import { Injectable, Module } from "@smounters/core/decorators";
import { OnEvent, EventModule, EventService } from "@smounters/events";

// --- Listener ---

@Injectable()
class TradeNotifier {
  @OnEvent("trade.opened")
  async onTradeOpened(payload: { symbol: string; price: number }) {
    // send push notification
  }
}

// --- Emitter ---

@Injectable()
class TradingEngine {
  constructor(private readonly events: EventService) {}

  async executeTrade(symbol: string, price: number) {
    // ... trade logic
    await this.events.emit("trade.opened", { symbol, price });
  }
}

// --- Module ---

@Module({
  imports: [EventModule.register({ listeners: [TradeNotifier] })],
  providers: [TradingEngine],
})
class TradingModule {}
```

## `@OnEvent(pattern)`

Method decorator. Registers the method as a handler for matching events.

### Exact Match

```ts
@OnEvent("trade.opened")
async onOpened(payload: TradePayload) { ... }
```

### Wildcard

`*` matches any single segment:

```ts
@OnEvent("trade.*")  // matches trade.opened, trade.closed, etc.
async onAnyTrade(payload: unknown) { ... }
```

### Multiple Handlers

A class can have multiple `@OnEvent()` methods. Multiple classes can listen to the same event.

```ts
@Injectable()
class AuditLogger {
  @OnEvent("trade.*")
  async logTrade(payload: unknown) { /* write to DB */ }

  @OnEvent("user.*")
  async logUser(payload: unknown) { /* write to DB */ }
}
```

## `EventModule.register({ listeners })`

Dynamic module. Pass providers that contain `@OnEvent()` methods. Providers without `@OnEvent()` are ignored.

```ts
@Module({
  imports: [
    EventModule.register({
      listeners: [TradeNotifier, AuditLogger, WebSocketPusher],
    }),
  ],
})
class AppModule {}
```

## `EventService`

Injectable service for emitting events:

```ts
import { EventService } from "@smounters/events";

@Injectable()
class OrderService {
  constructor(private readonly events: EventService) {}

  async createOrder(data: OrderData) {
    const order = await this.saveOrder(data);
    await this.events.emit("order.created", order);
    return order;
  }
}
```

Methods:

- `emit(event, payload?)` — emit an event. All matching handlers run concurrently via `Promise.allSettled`. Returns when all handlers complete.
- `getHandlers()` — returns registered handlers (for debugging/testing)

## Error Isolation

Errors in individual handlers are caught and logged — they never block other handlers or the caller:

```ts
@Injectable()
class FailingListener {
  @OnEvent("order.created")
  async sendEmail() {
    throw new Error("SMTP down"); // logged, does not block other listeners
  }
}

@Injectable()
class ReliableListener {
  @OnEvent("order.created")
  async updateStats() {
    // still executes even if FailingListener throws
  }
}
```

## Use with WebSocket Gateway

Events pair naturally with the WebSocket gateway for real-time push:

```ts
@Injectable()
class WebSocketPusher {
  constructor(private readonly gateway: NotificationsGateway) {}

  @OnEvent("trade.opened")
  async pushToClients(payload: { botId: string }) {
    this.gateway.broadcast(`bot:${payload.botId}`, "trade_opened", payload);
  }
}
```
