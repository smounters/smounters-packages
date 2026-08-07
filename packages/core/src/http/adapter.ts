import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppContainer } from "../core/container.js";
import { ForbiddenException, toHttpError } from "../core/errors.js";
import type { HttpParamMeta } from "../core/types.js";
import { CATCH_EXCEPTIONS_KEY } from "../decorators/filters.decorators.js";
import { PARAMS_KEY } from "../decorators/http.decorators.js";
import type { BaseContext, Constructor, ExceptionFilter, Guard, Interceptor, PipeTransform } from "../types.js";
import {
  collectFiltersForHttp,
  collectGuardsForHttp,
  collectInterceptorsForHttp,
  collectPipesForHttp,
} from "./utils.js";

type RequestScope = ReturnType<AppContainer["createRequestScope"]>;
type RequestWithScope = FastifyRequest & { diScope?: RequestScope };

interface HttpArgsBuildResult {
  args: unknown[];
  metasByIndex: Map<number, HttpParamMeta>;
}

function reportHttpError(app: AppContainer, details: Record<string, unknown>, error: unknown): void {
  app.reportError(error, {
    type: "http",
    handler: details.handler as string | undefined,
    controller: details.controller as string | undefined,
    method: details.method,
    url: details.url,
  });
}

function resolveEnhancer<T>(scope: RequestScope, enhancer: Constructor<T> | T): T {
  if (typeof enhancer === "function") {
    return scope.resolve(enhancer as Constructor<T>);
  }

  return enhancer;
}

function getRequestScope(req: FastifyRequest, app: AppContainer, controller: Constructor): RequestScope {
  const request = req as RequestWithScope;

  if (request.diScope?.isRegistered(controller, true)) {
    return request.diScope;
  }

  const scope = app.createRequestScope(controller);
  request.diScope = scope;

  return scope;
}

function getPayloadValue(payload: unknown, key?: string): unknown {
  if (!key) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  return (payload as Record<string, unknown>)[key];
}

function buildArgs(req: FastifyRequest, reply: FastifyReply, handler: Function): HttpArgsBuildResult {
  const metas: HttpParamMeta[] = Reflect.getMetadata(PARAMS_KEY, handler) ?? [];

  if (!metas.length) {
    return {
      args: [req, reply],
      metasByIndex: new Map<number, HttpParamMeta>(),
    };
  }

  const args: unknown[] = [];
  const metasByIndex = new Map<number, HttpParamMeta>();

  for (const meta of metas) {
    let value: unknown;

    switch (meta.source) {
      case "body":
        value = getPayloadValue(req.body, meta.key);
        break;
      case "query":
        value = getPayloadValue(req.query, meta.key);
        break;
      case "param":
        value = getPayloadValue(req.params, meta.key);
        break;
      case "header":
        value = meta.key ? req.headers[meta.key.toLowerCase()] : undefined;
        break;
      case "req":
        value = req;
        break;
      case "res":
        value = reply;
        break;
    }

    args[meta.index] = value;
    metasByIndex.set(meta.index, meta);
  }

  return { args, metasByIndex };
}

function canHandleException(error: unknown, filter: ExceptionFilter): boolean {
  const exceptions = Reflect.getMetadata(CATCH_EXCEPTIONS_KEY, filter.constructor) as Constructor[] | undefined;

  if (!exceptions || exceptions.length === 0) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return exceptions.some((ExceptionType) => error instanceof ExceptionType);
}

async function runHttpFilters(
  error: unknown,
  filters: ExceptionFilter[],
  ctx: BaseContext,
  reply: FastifyReply,
): Promise<{ handled: boolean; error: unknown }> {
  let currentError = error;

  for (const filter of filters) {
    if (!canHandleException(currentError, filter)) {
      continue;
    }

    try {
      const result = await filter.catch(currentError, ctx);

      if (reply.sent) {
        return { handled: true, error: currentError };
      }

      if (result !== undefined) {
        reply.send(result);
        return { handled: true, error: currentError };
      }
    } catch (nextError) {
      currentError = nextError;
    }
  }

  return { handled: false, error: currentError };
}

export function createHttpHandler<TController extends Record<string, unknown>>(
  app: AppContainer,
  controller: Constructor<TController>,
  methodName: keyof TController & string,
) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const requestScope = getRequestScope(req, app, controller);
    const handler = controller.prototype[methodName] as Function;

    return app.runInRequestScope(requestScope, async () => {
      const ctx: BaseContext = {
        type: "http",
        method: methodName,
        fastify: { req, reply },
        controller,
        handler,
        getType: () => "http",
        getClass: () => controller,
        getHandler: () => handler,
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => reply,
        }),
        switchToRpc: () => ({
          getData: () => undefined,
          getContext: () => undefined,
        }),
        switchToWs: () => ({
          getSocket: () => undefined,
          getRequest: () => undefined,
          getMessage: () => undefined,
        }),
      };

      try {
        const instance = requestScope.resolve<TController>(controller);

        const guards = collectGuardsForHttp(controller, methodName, app.getGlobalGuards()).map((guardLike) =>
          resolveEnhancer<Guard>(requestScope, guardLike),
        );

        for (const guard of guards) {
          const ok = await guard.canActivate(ctx);
          if (!ok) {
            throw new ForbiddenException();
          }
        }

        const { args, metasByIndex } = buildArgs(req, reply, handler);

        const pipes = collectPipesForHttp(controller, methodName, app.getGlobalPipes()).map((pipeLike) =>
          resolveEnhancer<PipeTransform>(requestScope, pipeLike),
        );

        const transformedArgs: unknown[] = [...args];

        for (const [index, meta] of metasByIndex) {
          if (meta.source === "req" || meta.source === "res") {
            continue;
          }

          let value = args[index];
          for (const pipe of pipes) {
            value = await pipe.transform(value, ctx);
          }
          transformedArgs[index] = value;
        }

        const interceptors = collectInterceptorsForHttp(controller, methodName, app.getGlobalInterceptors()).map(
          (interceptorLike) => resolveEnhancer<Interceptor>(requestScope, interceptorLike),
        );

        const controllerHandler = (instance[methodName] as Function).bind(instance) as (
          ...args: unknown[]
        ) => Promise<unknown>;

        let idx = -1;

        const next = async (): Promise<unknown> => {
          idx++;
          if (idx < interceptors.length) {
            return interceptors[idx].intercept(ctx, next);
          }

          return controllerHandler(...transformedArgs);
        };

        const result = await next();

        if (!reply.sent && result !== undefined) {
          reply.send(result);
        }
      } catch (error) {
        reportHttpError(
          app,
          {
            method: req.method,
            url: req.url,
            controller: controller.name,
            handler: methodName,
          },
          error,
        );

        if (reply.sent) {
          return;
        }

        const filters = collectFiltersForHttp(controller, methodName, app.getGlobalFilters()).map((filterLike) =>
          resolveEnhancer<ExceptionFilter>(requestScope, filterLike),
        );

        const filtered = await runHttpFilters(error, filters, ctx, reply);

        if (filtered.handled || reply.sent) {
          return;
        }

        const mapped = toHttpError(filtered.error, {
          exposeInternalErrors: app.shouldExposeInternalErrors(),
        });
        reply.status(mapped.status).send(mapped.body);
      }
    });
  };
}
