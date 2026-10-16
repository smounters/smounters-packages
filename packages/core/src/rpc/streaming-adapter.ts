import type { HandlerContext } from "@connectrpc/connect";
import "reflect-metadata";

import type { AppContainer } from "../core/container.js";
import { ForbiddenException, toConnectError } from "../core/errors.js";
import type { Constructor, ExceptionFilter, Guard, PipeTransform } from "../types.js";
import { resolveEnhancer } from "../core/enhancers.js";
import {
  buildRpcArgs,
  buildRpcContext,
  collectFiltersForRpc,
  collectGuardsForRpc,
  collectPipesForRpc,
  reportRpcError,
  runRpcFilters,
} from "./utils.js";

export function createStreamingRpcHandler(
  app: AppContainer,
  controller: Constructor,
  methodName: string,
) {
  return async function* (req: unknown, context: HandlerContext): AsyncIterable<unknown> {
    const scope = app.createRequestScope(controller);
    const handler = controller.prototype[methodName] as Function;
    const ctx = buildRpcContext(controller, methodName, handler, context, req);

    try {
      // Keep the request scope alive for the whole streaming session.
      await app.runInRequestScope(scope, async () => {
        // Resolve instance inside request scope
      });

      // We need to run guards/pipes inside the scope, then yield outside of runInRequestScope
      // because async generators cannot be fully consumed inside a single runInRequestScope call.
      // Instead, we set up the scope context and run guards/pipes, then yield from the generator.

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
