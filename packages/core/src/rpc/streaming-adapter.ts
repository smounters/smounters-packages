import type { HandlerContext } from "@connectrpc/connect";
import "reflect-metadata";

import type { AppContainer } from "../core/container.js";
import { ForbiddenException, toConnectError } from "../core/errors.js";
import type { RpcParamMeta } from "../core/types.js";
import { CATCH_EXCEPTIONS_KEY } from "../decorators/filters.decorators.js";
import { RPC_PARAMS_KEY } from "../decorators/rpc.decorators.js";
import type { BaseContext, Constructor, ExceptionFilter, Guard, PipeTransform } from "../types.js";

import { collectFiltersForRpc, collectGuardsForRpc, collectPipesForRpc } from "./utils.js";

type RpcRequestScope = ReturnType<AppContainer["createRequestScope"]>;

function reportRpcError(app: AppContainer, details: Record<string, unknown>, error: unknown): void {
  app.reportError(error, {
    type: "rpc",
    handler: details.handler as string | undefined,
    controller: details.controller as string | undefined,
    procedure: details.procedure,
  });
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

function buildRpcArgs(payload: unknown, context: HandlerContext, handler: Function): unknown[] {
  const metas: RpcParamMeta[] = Reflect.getMetadata(RPC_PARAMS_KEY, handler) ?? [];

  if (!metas.length) {
    return [payload];
  }

  const args: unknown[] = [];

  for (const meta of metas) {
    switch (meta.source) {
      case "data":
        args[meta.index] = getPayloadValue(payload, meta.key);
        break;
      case "context":
        args[meta.index] = context;
        break;
      case "headers":
        args[meta.index] = context.requestHeader;
        break;
      case "header":
        args[meta.index] = meta.key ? context.requestHeader.get(meta.key) : undefined;
        break;
      case "abort_signal":
        args[meta.index] = context.signal;
        break;
    }
  }

  return args;
}

function resolveEnhancer<T>(scope: RpcRequestScope, enhancer: Constructor<T> | T): T {
  if (typeof enhancer === "function") {
    return scope.resolve(enhancer as Constructor<T>);
  }

  return enhancer;
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

async function runRpcFilters(
  error: unknown,
  filters: ExceptionFilter[],
  ctx: BaseContext,
): Promise<{ handled: boolean; error: unknown; result?: unknown }> {
  let currentError = error;

  for (const filter of filters) {
    if (!canHandleException(currentError, filter)) {
      continue;
    }

    try {
      const result = await filter.catch(currentError, ctx);

      if (result !== undefined) {
        return {
          handled: true,
          error: currentError,
          result,
        };
      }
    } catch (nextError) {
      currentError = nextError;
    }
  }

  return {
    handled: false,
    error: currentError,
  };
}

export function createStreamingRpcHandler<TController extends Record<string, unknown>>(
  app: AppContainer,
  controller: Constructor<TController>,
  methodName: keyof TController & string,
) {
  return async function* (req: unknown, context: HandlerContext): AsyncIterable<unknown> {
    const scope = app.createRequestScope(controller);
    const handler = controller.prototype[methodName] as Function;

    const ctx: BaseContext = {
      type: "rpc",
      method: methodName,
      headers: context.requestHeader,
      rpc: {
        data: req,
        context,
      },
      controller,
      handler,
      getType: () => "rpc",
      getClass: () => controller,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => undefined,
        getResponse: () => undefined,
      }),
      switchToRpc: () => ({
        getData: <T = unknown>() => req as T,
        getContext: <T = unknown>() => context as T,
      }),
      switchToWs: () => ({
        getSocket: () => undefined,
        getRequest: () => undefined,
        getMessage: () => undefined,
      }),
    };

    try {
      await app.runInRequestScope(scope, async () => {
        // Resolve instance inside request scope
      });

      // We need to run guards/pipes inside the scope, then yield outside of runInRequestScope
      // because async generators cannot be fully consumed inside a single runInRequestScope call.
      // Instead, we set up the scope context and run guards/pipes, then yield from the generator.

      const instance = scope.resolve(controller);

      const guards = collectGuardsForRpc(controller, methodName, app.getGlobalGuards()).map((guardLike) =>
        resolveEnhancer<Guard>(scope, guardLike),
      );

      for (const guard of guards) {
        const ok = await guard.canActivate(ctx);
        if (!ok) {
          throw new ForbiddenException();
        }
      }

      let payload: unknown = req;

      const pipes = collectPipesForRpc(controller, methodName, app.getGlobalPipes()).map((pipeLike) =>
        resolveEnhancer<PipeTransform>(scope, pipeLike),
      );

      for (const pipe of pipes) {
        payload = await pipe.transform(payload, ctx);
      }

      const args = buildRpcArgs(payload, context, handler);
      const generator = (instance[methodName] as Function).apply(instance, args) as AsyncIterable<unknown>;

      yield* generator;
    } catch (error) {
      reportRpcError(
        app,
        {
          controller: controller.name,
          handler: methodName,
          procedure: context.method.name,
        },
        error,
      );

      const filters = collectFiltersForRpc(controller, methodName, app.getGlobalFilters()).map((filterLike) =>
        resolveEnhancer<ExceptionFilter>(scope, filterLike),
      );

      const filtered = await runRpcFilters(error, filters, ctx);

      if (filtered.handled) {
        return;
      }

      throw toConnectError(filtered.error, {
        exposeInternalErrors: app.shouldExposeInternalErrors(),
      });
    } finally {
      try {
        await app.disposeRequestScope(scope);
      } catch (disposeError) {
        reportRpcError(
          app,
          {
            controller: controller.name,
            handler: methodName,
            procedure: context.method.name,
          },
          disposeError,
        );
      }
    }
  };
}
