import type { HandlerContext } from "@connectrpc/connect";
import "reflect-metadata";

import type { AppContainer } from "../core/container.js";
import { collectEnhancers, getPayloadValue, canHandleException } from "../core/enhancers.js";
import type { RpcParamMeta } from "../types.js";
import { FILTERS_KEY, GUARDS_KEY, INTERCEPTORS_KEY, PIPES_KEY, RPC_PARAMS_KEY } from "../core/tokens.js";
import type {
  BaseContext,
  Constructor,
  ExceptionFilter,
  ExceptionFilterLike,
  GuardLike,
  InterceptorLike,
  PipeLike,
} from "../types.js";

export function collectGuardsForRpc(controller: Constructor, method: string, global: GuardLike[]): GuardLike[] {
  return collectEnhancers(GUARDS_KEY, controller, method, global);
}

export function collectInterceptorsForRpc(
  controller: Constructor,
  method: string,
  global: InterceptorLike[],
): InterceptorLike[] {
  return collectEnhancers(INTERCEPTORS_KEY, controller, method, global, true);
}

export function collectPipesForRpc(controller: Constructor, method: string, global: PipeLike[]): PipeLike[] {
  return collectEnhancers(PIPES_KEY, controller, method, global);
}

export function collectFiltersForRpc(
  controller: Constructor,
  method: string,
  global: ExceptionFilterLike[],
): ExceptionFilterLike[] {
  return collectEnhancers(FILTERS_KEY, controller, method, global, true);
}

function reportRpcError(app: AppContainer, details: Record<string, unknown>, error: unknown): void {
  app.reportError(error, {
    type: "rpc",
    handler: details.handler as string | undefined,
    controller: details.controller as string | undefined,
    procedure: details.procedure,
  });
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

function buildRpcContext(
  controller: Constructor,
  methodName: string,
  handler: Function,
  context: HandlerContext,
  req: unknown,
): BaseContext {
  return {
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
}

export {
  buildRpcArgs,
  buildRpcContext,
  reportRpcError,
  runRpcFilters,
};
