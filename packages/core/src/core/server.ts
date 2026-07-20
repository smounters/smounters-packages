import "reflect-metadata";

import { fastifyConnectPlugin } from "@connectrpc/connect-fastify";
import fastifyCors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";

import { HTTP_ROUTES_KEY } from "../decorators/http.decorators.js";
import { RPC_METHODS_KEY, RPC_SERVICE_KEY } from "../decorators/rpc.decorators.js";
import { registerHttpRoutes } from "../http/index.js";
import { buildConnectRoutes } from "../rpc/index.js";
import type { CorsOptions, HealthCheck, HealthCheckResult, ServerOptions } from "../types.js";
import { registerWsGateways } from "../ws/index.js";
import { AppContainer } from "./container.js";

type RequestScope = ReturnType<AppContainer["createRequestScope"]>;
type RequestWithScope = FastifyRequest & { diScope?: RequestScope; requestStartAt?: number };
type LegacyServerOptions = ServerOptions & { di: AppContainer };
type CorsPluginOptions = Omit<CorsOptions, "enabled">;
type AppLogger = ReturnType<AppContainer["getLogger"]>;

export type HookEntry = [name: string, handler: (...args: any[]) => unknown];

interface HealthCheckStatus {
  ok: boolean;
  details?: unknown;
}

interface ResolvedHealthOptions {
  enabled: boolean;
  path: string;
  check?: HealthCheck;
}

function normalizePrefix(prefix: string | undefined): string {
  if (!prefix) {
    return "";
  }

  const trimmed = prefix.trim();

  if (trimmed.length === 0 || trimmed === "/") {
    return "";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }

  return withLeadingSlash;
}

function mergePrefixes(...prefixes: (string | undefined)[]): string {
  const normalized = prefixes.map((prefix) => normalizePrefix(prefix)).filter((prefix) => prefix.length > 0);
  return normalized.join("");
}

function hasRegisteredHttpHandlers(di: AppContainer): boolean {
  for (const controller of di.getHttpControllers()) {
    const routes = Reflect.getMetadata(HTTP_ROUTES_KEY, controller) as unknown[] | undefined;

    if ((routes?.length ?? 0) > 0) {
      return true;
    }
  }

  return false;
}

function hasRegisteredRpcHandlers(di: AppContainer): boolean {
  for (const controller of di.getControllers()) {
    const service = Reflect.getMetadata(RPC_SERVICE_KEY, controller);
    if (!service) {
      continue;
    }

    const methods = Reflect.getMetadata(RPC_METHODS_KEY, controller) as unknown[] | undefined;

    if ((methods?.length ?? 0) > 0) {
      return true;
    }
  }

  return false;
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function resolveListenPort(port: number | undefined, config: Readonly<Record<string, unknown>>): number {
  if (typeof port === "number" && isValidPort(port)) {
    return port;
  }

  const configPort = config.APP_PORT;

  if (typeof configPort === "number" && isValidPort(configPort)) {
    return configPort;
  }

  if (typeof configPort === "string") {
    const normalized = configPort.trim();
    if (normalized.length > 0) {
      const parsed = Number(normalized);
      if (isValidPort(parsed)) {
        return parsed;
      }
    }
  }

  throw new Error("Server port is invalid. Provide options.port or APP_PORT in range 1..65535.");
}

function resolveCors(options: ServerOptions["cors"]): { enabled: boolean; options: CorsPluginOptions } {
  if (options === undefined || options === false) {
    return { enabled: false, options: {} };
  }

  if (options === true) {
    return { enabled: true, options: {} };
  }

  const { enabled = true, ...corsOptions } = options;

  return { enabled, options: corsOptions };
}

function resolveHealth(options: ServerOptions["health"]): ResolvedHealthOptions {
  const defaults: ResolvedHealthOptions = {
    enabled: false,
    path: "/health",
  };

  if (options === undefined || options === false) {
    return defaults;
  }

  if (options === true) {
    return {
      ...defaults,
      enabled: true,
    };
  }

  return {
    enabled: options.enabled ?? true,
    path: normalizePrefix(options.path) || defaults.path,
    check: options.check,
  };
}

function normalizeHealthResult(result: HealthCheckResult): HealthCheckStatus {
  if (typeof result === "boolean") {
    return { ok: result };
  }

  return {
    ok: result.ok,
    details: result.details,
  };
}

async function runHealthCheck(
  check: HealthCheck | undefined,
  exposeInternalErrors: boolean,
  logger: AppLogger,
  path: string,
): Promise<HealthCheckStatus> {
  if (!check) {
    return { ok: true };
  }

  try {
    const result = await check();
    return normalizeHealthResult(result);
  } catch (error) {
    logger.error(
      {
        type: "health_check_error",
        path,
      },
      error,
    );

    if (exposeInternalErrors && error instanceof Error) {
      return {
        ok: false,
        details: {
          message: error.message,
          error: error.name,
        },
      };
    }

    return { ok: false };
  }
}

export function startServer(di: AppContainer, options: ServerOptions, hooks?: HookEntry[]): Promise<FastifyInstance>;
export function startServer(options: LegacyServerOptions): Promise<FastifyInstance>;
export async function startServer(
  diOrOptions: AppContainer | LegacyServerOptions,
  options?: ServerOptions,
  hooks?: HookEntry[],
): Promise<FastifyInstance> {
  const di = diOrOptions instanceof AppContainer ? diOrOptions : diOrOptions.di;
  const serverOptions = diOrOptions instanceof AppContainer ? options : diOrOptions;

  if (!serverOptions) {
    throw new Error("Server options are required");
  }

  const {
    port,
    host = "0.0.0.0",
    prefix,
    httpPrefix,
    rpcPrefix,
    trustProxy,
    requestTimeout,
    connectionTimeout,
    keepAliveTimeout,
    bodyLimit,
    routerOptions,
    maxParamLength: legacyMaxParamLength,
    pluginTimeout,
    accessLogs = false,
    exposeInternalErrors = false,
    cors,
    health,
    loggerOptions,
    onError,
    config,
  } = serverOptions;

  if (loggerOptions !== undefined) {
    di.configureLogger(loggerOptions);
  }

  if (config) {
    di.configureConfig(config.schema, config.source ?? process.env);
  }

  di.setExposeInternalErrors(exposeInternalErrors);

  if (onError) {
    di.setOnError(onError);
  }

  const listenPort = resolveListenPort(port, di.getConfig());
  const healthConfig = resolveHealth(health);

  const http = hasRegisteredHttpHandlers(di);
  const rpc = hasRegisteredRpcHandlers(di);

  const ws = di.getWsGateways().length > 0;

  if (!http && !rpc && !ws && !healthConfig.enabled) {
    throw new Error("No handlers found for HTTP, RPC, or WebSocket. Register controllers in @Module().");
  }

  let server: FastifyInstance | undefined;

  try {
    await di.init();

    const resolvedRouterOptions =
      legacyMaxParamLength === undefined
        ? routerOptions
        : {
            ...(routerOptions ?? {}),
            maxParamLength: legacyMaxParamLength,
          };

    server = Fastify({
      logger: false,
      trustProxy,
      requestTimeout,
      connectionTimeout,
      keepAliveTimeout,
      bodyLimit,
      pluginTimeout,
      ...(resolvedRouterOptions ? { routerOptions: resolvedRouterOptions } : {}),
    });
    const appLogger = di.getLogger();
    const corsConfig = resolveCors(cors);
    const effectiveHttpPrefix = mergePrefixes(prefix, httpPrefix);
    const effectiveRpcPrefix = mergePrefixes(prefix, rpcPrefix);

    if (hooks) {
      for (const [name, handler] of hooks) {
        server.addHook(name as any, handler as any);
      }
    }

    server.addHook("onRequest", (req, _reply, done) => {
      const request = req as RequestWithScope;
      request.requestStartAt = Date.now();
      done();
    });

    server.addHook("onResponse", async (req, reply) => {
      const request = req as RequestWithScope;
      const startedAt = request.requestStartAt ?? Date.now();

      if (accessLogs) {
        appLogger.info({
          type: "access",
          method: req.method,
          url: req.url,
          statusCode: reply.statusCode,
          durationMs: Date.now() - startedAt,
          ip: req.ip,
        });
      }

      if (request.diScope) {
        try {
          await di.disposeRequestScope(request.diScope);
        } catch (error) {
          appLogger.error(
            {
              type: "request_scope_dispose_error",
              method: req.method,
              url: req.url,
            },
            error,
          );
        } finally {
          request.diScope = undefined;
        }
      }
    });

    server.addHook("onRequestAbort", async (req) => {
      const request = req as RequestWithScope;

      if (request.diScope) {
        try {
          await di.disposeRequestScope(request.diScope);
        } catch (error) {
          appLogger.error(
            {
              type: "request_scope_abort_dispose_error",
              method: req.method,
              url: req.url,
            },
            error,
          );
        } finally {
          request.diScope = undefined;
        }
      }
    });

    server.addHook("onClose", async () => {
      await di.close("server.close");
    });

    if (corsConfig.enabled) {
      await server.register(fastifyCors, corsConfig.options);
    }

    if (healthConfig.enabled) {
      const healthUrl = healthConfig.path || "/health";

      server.get(healthUrl, async (_req, reply) => {
        const result = await runHealthCheck(healthConfig.check, exposeInternalErrors, appLogger, healthUrl);
        reply.status(result.ok ? 200 : 503).send({
          status: result.ok ? "ok" : "error",
          type: "health",
          ...(result.details !== undefined ? { details: result.details } : {}),
        });
      });
    }

    if (http) {
      server.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) => {
        try {
          const params = new URLSearchParams(body as string);
          const result: Record<string, string | string[]> = {};
          for (const [key, value] of params) {
            const existing = result[key];
            if (existing === undefined) {
              result[key] = value;
            } else if (Array.isArray(existing)) {
              existing.push(value);
            } else {
              result[key] = [existing, value];
            }
          }
          done(null, result);
        } catch (err) {
          done(err as Error, undefined);
        }
      });

      registerHttpRoutes(server, di, effectiveHttpPrefix);
    }

    if (rpc) {
      await server.register(fastifyConnectPlugin, {
        prefix: effectiveRpcPrefix,
        routes: buildConnectRoutes(di),
      });
    }

    if (ws) {
      await registerWsGateways(server, di);
    }

    await server.listen({ port: listenPort, host });

    return server;
  } catch (error) {
    const logger = (() => {
      try {
        return di.getLogger();
      } catch {
        return undefined;
      }
    })();

    if (logger) {
      logger.error(
        {
          type: "server_start_failed",
          host,
          port: listenPort,
        },
        error,
      );
    }

    if (server) {
      try {
        await server.close();
      } catch (closeError) {
        if (logger) {
          logger.error({ type: "server_start_cleanup_error", stage: "server.close" }, closeError);
        }
      }
    }

    try {
      await di.close("server.start_failed");
    } catch (closeError) {
      if (logger) {
        logger.error({ type: "server_start_cleanup_error", stage: "di.close" }, closeError);
      }
    }

    throw error;
  }
}
