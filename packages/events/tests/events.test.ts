import "reflect-metadata";
import { describe, it, expect, afterEach } from "vitest";
import { Injectable, Module } from "@smounters/core/decorators";
import { Application } from "@smounters/core/core";

import { OnEvent, EventModule, EventService } from "../src";

// --- Listeners ---

const calls: { event: string; payload: unknown }[] = [];

@Injectable()
class TradeListener {
  @OnEvent("trade.opened")
  onOpened(payload: unknown) {
    calls.push({ event: "trade.opened", payload });
  }

  @OnEvent("trade.closed")
  onClosed(payload: unknown) {
    calls.push({ event: "trade.closed", payload });
  }
}

@Injectable()
class WildcardListener {
  @OnEvent("trade.*")
  onAnyTrade(payload: unknown) {
    calls.push({ event: "trade.*", payload });
  }
}

@Injectable()
class ErrorListener {
  @OnEvent("error.test")
  onError() {
    throw new Error("handler failed");
  }
}

@Injectable()
class AsyncListener {
  @OnEvent("async.test")
  async onAsync(payload: unknown) {
    await new Promise((r) => setTimeout(r, 10));
    calls.push({ event: "async.test", payload });
  }
}

@Injectable()
class NoEventsService {
  doWork() {
    return "ok";
  }
}

// --- Module factory ---

function createModule(listeners: Function[]) {
  @Module({
    imports: [EventModule.register({ listeners: listeners as any })],
  })
  class TestModule {}
  return TestModule;
}

describe("EventModule", () => {
  let app: Application;

  afterEach(async () => {
    calls.length = 0;
    await app?.close();
  });

  it("registers handlers from @OnEvent decorated methods", async () => {
    app = new Application(createModule([TradeListener]), { host: "127.0.0.1" });
    await app.start({ port: 48200, health: true });

    const events = app.resolve(EventService);
    const handlers = events.getHandlers();

    expect(handlers).toHaveLength(2);
    expect(handlers.map((h) => h.pattern)).toContain("trade.opened");
    expect(handlers.map((h) => h.pattern)).toContain("trade.closed");
  });

  it("emits to exact match handlers", async () => {
    app = new Application(createModule([TradeListener]), { host: "127.0.0.1" });
    await app.start({ port: 48201, health: true });

    const events = app.resolve(EventService);
    await events.emit("trade.opened", { symbol: "BTC" });

    expect(calls).toEqual([
      { event: "trade.opened", payload: { symbol: "BTC" } },
    ]);
  });

  it("emits to wildcard handlers", async () => {
    app = new Application(createModule([WildcardListener]), { host: "127.0.0.1" });
    await app.start({ port: 48202, health: true });

    const events = app.resolve(EventService);
    await events.emit("trade.opened", { a: 1 });
    await events.emit("trade.closed", { b: 2 });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ event: "trade.*", payload: { a: 1 } });
    expect(calls[1]).toEqual({ event: "trade.*", payload: { b: 2 } });
  });

  it("does not match unrelated events", async () => {
    app = new Application(createModule([TradeListener]), { host: "127.0.0.1" });
    await app.start({ port: 48203, health: true });

    const events = app.resolve(EventService);
    await events.emit("user.registered", {});

    expect(calls).toHaveLength(0);
  });

  it("handles async handlers", async () => {
    app = new Application(createModule([AsyncListener]), { host: "127.0.0.1" });
    await app.start({ port: 48204, health: true });

    const events = app.resolve(EventService);
    await events.emit("async.test", "data");

    expect(calls).toEqual([{ event: "async.test", payload: "data" }]);
  });

  it("error in one handler does not block others", async () => {
    app = new Application(createModule([ErrorListener, TradeListener]), { host: "127.0.0.1" });
    await app.start({ port: 48205, health: true });

    const events = app.resolve(EventService);

    // ErrorListener listens to "error.test", TradeListener to "trade.opened"
    // Emit both — error in ErrorListener should not affect TradeListener
    await events.emit("error.test");
    await events.emit("trade.opened", { ok: true });

    expect(calls).toEqual([
      { event: "trade.opened", payload: { ok: true } },
    ]);
  });

  it("multiple handlers for same event all fire", async () => {
    app = new Application(createModule([TradeListener, WildcardListener]), { host: "127.0.0.1" });
    await app.start({ port: 48206, health: true });

    const events = app.resolve(EventService);
    await events.emit("trade.opened", { x: 1 });

    // TradeListener.onOpened + WildcardListener.onAnyTrade
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.event)).toContain("trade.opened");
    expect(calls.map((c) => c.event)).toContain("trade.*");
  });

  it("skips listeners without @OnEvent", async () => {
    app = new Application(createModule([NoEventsService, TradeListener]), { host: "127.0.0.1" });
    await app.start({ port: 48207, health: true });

    const events = app.resolve(EventService);
    const handlers = events.getHandlers();

    // Only TradeListener handlers, not NoEventsService
    expect(handlers.every((h) => h.listenerName === "TradeListener")).toBe(true);
  });
});

describe("EventService.hasEventHandlers", () => {
  it("returns true for decorated class", () => {
    expect(EventService.hasEventHandlers(TradeListener)).toBe(true);
  });

  it("returns false for non-decorated class", () => {
    expect(EventService.hasEventHandlers(NoEventsService)).toBe(false);
  });
});
