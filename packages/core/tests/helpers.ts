import "reflect-metadata";
import type { FastifyInstance } from "fastify";
import { Application } from "../src/core/application";
import type { Constructor, ServerOptions } from "../src/types";

let nextPort = 40000 + Math.floor(Math.random() * 10000);

export interface TestApp {
  server: FastifyInstance;
  app: Application;
  address: string;
  close: () => Promise<void>;
}

export async function createTestApp(
  rootModule: Constructor,
  options: Partial<ServerOptions> = {},
): Promise<TestApp> {
  const app = new Application(rootModule, {
    host: "127.0.0.1",
    ...options,
  });

  const port = options.port ?? nextPort++;
  const server = await app.start({ port, ...options });
  const addr = server.addresses()[0]!;
  const address = `http://127.0.0.1:${addr.port}`;

  return {
    server,
    app,
    address,
    close: () => app.close(),
  };
}
