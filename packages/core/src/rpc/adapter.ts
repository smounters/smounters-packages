import type { HandlerContext } from "@connectrpc/connect";
import "reflect-metadata";

import type { AppContainer } from "../core/container.js";
import { ForbiddenException, toConnectError } from "../core/errors.js";
import type { Constructor, ExceptionFilter, Guard, Interceptor, PipeTransform } from "../types.js";
import { resolveEnhancer } from "../core/enhancers.js";
import {
  buildRpcArgs,
  buildRpcContext,
  collectFiltersForRpc,
  collectGuardsForRpc,
  collectInterceptorsForRpc,
  collectPipesForRpc,
  reportRpcError,
  runRpcFilters,
} from "./utils.js";

type RpcResponse = Record<string, unknown>;

export function createRpcHandler(
  app: AppContainer,
  controller: Constructor,
  methodName: string,
) {
  return async function (req: unknown, context: HandlerContext): Promise<RpcResponse> {
    const scope = app.createRequestScope(controller);
    const handler = controller.prototype[methodName] as Function;
    const ctx = buildRpcContext(controller, methodName, handler, context, req);

    try {
      const instance = scope.resolve(controller) as Record<string, unknown>;

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

      const interceptors = collectInterceptorsForRpc(controller, methodName, app.getGlobalInterceptors()).map(
        (interceptorLike) => resolveEnhancer<Interceptor>(scope, interceptorLike),
      );

      const args = buildRpcArgs(payload, context, handler);
      const controllerHandler = (instance[methodName] as Function).bind(instance) as (
        ...args: unknown[]
      ) => Promise<RpcResponse> | RpcResponse;

      let idx = -1;

      const next = async (): Promise<RpcResponse> => {
        idx++;
        if (idx < interceptors.length) {
          return (await interceptors[idx].intercept(ctx, next)) as RpcResponse;
        }

        return controllerHandler(...args);
      };

      return await next();
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
        return filtered.result! as RpcResponse;
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
