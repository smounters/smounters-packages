import "reflect-metadata";
import { describe, it, expect, afterEach } from "vitest";
import WebSocket from "ws";
import { Injectable, Module, UseGuards, WsGateway, WsHandler, WsConnection, WsMessage } from "../src/decorators";
import type { BaseContext, Guard } from "../src/types";
import type { WsGatewayLifecycle } from "../src/ws/types";
import { createTestApp, type TestApp } from "./helpers";

// --- Simple gateway ---

@WsGateway("/ws")
class EchoGateway implements WsGatewayLifecycle {
  onConnection() {}
  onDisconnect() {}

  @WsHandler("ping")
  onPing(@WsConnection() ws: InstanceType<typeof WebSocket>) {
    ws.send(JSON.stringify({ type: "pong" }));
  }

  @WsHandler("echo")
  onEcho(@WsConnection() ws: InstanceType<typeof WebSocket>, @WsMessage() data: unknown) {
    ws.send(JSON.stringify({ type: "echo", data }));
  }
}

@Module({ providers: [EchoGateway] })
class WsTestModule {}

// --- Guarded gateway ---

@Injectable()
class WsAuthGuard implements Guard {
  canActivate(ctx: BaseContext): boolean {
    const req = ctx.switchToWs().getRequest();
    return req?.headers["x-token"] === "valid";
  }
}

@WsGateway("/ws-guarded")
@UseGuards(WsAuthGuard)
class GuardedGateway {
  @WsHandler("ping")
  onPing(@WsConnection() ws: InstanceType<typeof WebSocket>) {
    ws.send(JSON.stringify({ type: "pong" }));
  }
}

@Module({ providers: [GuardedGateway] })
class GuardedWsModule {}

function connectWs(url: string, headers?: Record<string, string>): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), 3000);
    ws.on("message", (raw) => {
      clearTimeout(timeout);
      resolve(JSON.parse(raw.toString()));
    });
  });
}

describe("WebSocket Gateway", () => {
  let app: TestApp;

  afterEach(async () => {
    await app?.close();
  });

  it("handles ping/pong", async () => {
    app = await createTestApp(WsTestModule);
    const wsUrl = app.address.replace("http", "ws") + "/ws";
    const ws = await connectWs(wsUrl);

    ws.send(JSON.stringify({ type: "ping" }));
    const msg = await waitForMessage(ws);
    expect(msg).toEqual({ type: "pong" });

    ws.close();
  });

  it("echoes message data", async () => {
    app = await createTestApp(WsTestModule);
    const wsUrl = app.address.replace("http", "ws") + "/ws";
    const ws = await connectWs(wsUrl);

    ws.send(JSON.stringify({ type: "echo", data: { hello: "world" } }));
    const msg = await waitForMessage(ws);
    expect(msg).toEqual({ type: "echo", data: { hello: "world" } });

    ws.close();
  });

  it("ignores unknown message types", async () => {
    app = await createTestApp(WsTestModule);
    const wsUrl = app.address.replace("http", "ws") + "/ws";
    const ws = await connectWs(wsUrl);

    ws.send(JSON.stringify({ type: "unknown" }));

    // Send a known message after — if we get pong, the unknown was silently ignored
    ws.send(JSON.stringify({ type: "ping" }));
    const msg = await waitForMessage(ws);
    expect(msg).toEqual({ type: "pong" });

    ws.close();
  });

  it("guard rejects connection without token", async () => {
    app = await createTestApp(GuardedWsModule);
    const wsUrl = app.address.replace("http", "ws") + "/ws-guarded";

    const ws = new WebSocket(wsUrl);
    const code = await new Promise<number>((resolve) => {
      ws.on("close", (code) => resolve(code));
      ws.on("open", () => {
        // guard should close it
      });
    });

    expect(code).toBe(4403);
  });

  it("guard allows connection with valid token", async () => {
    app = await createTestApp(GuardedWsModule);
    const wsUrl = app.address.replace("http", "ws") + "/ws-guarded";
    const ws = await connectWs(wsUrl, { "x-token": "valid" });

    ws.send(JSON.stringify({ type: "ping" }));
    const msg = await waitForMessage(ws);
    expect(msg).toEqual({ type: "pong" });

    ws.close();
  });
});
