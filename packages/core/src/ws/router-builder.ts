import type { FastifyInstance } from "fastify";
import "reflect-metadata";

import type { AppContainer } from "../core/container.js";
import { WS_GATEWAY_KEY } from "../decorators/ws.decorators.js";
import { handleWsConnection } from "./adapter.js";
import type { WsGatewayMeta } from "./types.js";

export async function registerWsGateways(server: FastifyInstance, app: AppContainer): Promise<void> {
  const gateways = app.getWsGateways();

  if (gateways.length === 0) {
    return;
  }

  // Dynamic import — @fastify/websocket is an optional peer dep
  let fastifyWebsocket: typeof import("@fastify/websocket");

  try {
    fastifyWebsocket = await import("@fastify/websocket");
  } catch {
    throw new Error(
      "WebSocket gateways are registered but @fastify/websocket is not installed. " +
        "Install it: pnpm add @fastify/websocket",
    );
  }

  await server.register(fastifyWebsocket.default);

  for (const gateway of gateways) {
    const meta = Reflect.getMetadata(WS_GATEWAY_KEY, gateway) as WsGatewayMeta;

    server.get(meta.path, { websocket: true }, (socket, req) => {
      handleWsConnection(app, gateway, socket, req);
    });
  }
}
