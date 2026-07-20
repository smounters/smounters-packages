import type { FastifyInstance } from "fastify";
import "reflect-metadata";
import type { AppContainer } from "../core/container.js";
import type { HttpRouteMeta } from "../core/types.js";
import { HTTP_CONTROLLER_KEY, HTTP_ROUTES_KEY } from "../decorators/http.decorators.js";
import type { Constructor } from "../types.js";
import { createHttpHandler } from "./adapter.js";

type ControllerShape = Record<string, unknown>;

function joinUrlPath(...segments: string[]): string {
  const parts = segments
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== "/")
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""));

  if (parts.length === 0) {
    return "/";
  }

  return `/${parts.join("/")}`;
}

export function registerHttpRoutes(server: FastifyInstance, di: AppContainer, globalPrefix = "") {
  for (const ctrl of di.getHttpControllers()) {
    // сузим тип конструктора контроллера
    const controller = ctrl as Constructor<ControllerShape>;

    const meta = (Reflect.getMetadata(HTTP_CONTROLLER_KEY, controller) as { prefix: string } | undefined) ?? {
      prefix: "",
    };

    const routes = (Reflect.getMetadata(HTTP_ROUTES_KEY, controller) as HttpRouteMeta[] | undefined) ?? [];

    for (const r of routes) {
      server.route({
        method: r.method,
        url: joinUrlPath(globalPrefix, meta.prefix, r.path),
        handler: createHttpHandler(di, controller, r.handlerName),
      });
    }
  }
}
