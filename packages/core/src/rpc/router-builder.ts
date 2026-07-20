import type { ConnectRouter } from "@connectrpc/connect";
import "reflect-metadata";

import type { AppContainer } from "../core/container.js";
import type { RpcMethodMeta } from "../core/types.js";
import { RPC_METHODS_KEY, RPC_SERVICE_KEY } from "../decorators/rpc.decorators.js";
import type { Constructor } from "../types.js";
import { createRpcHandler } from "./adapter.js";
import { createStreamingRpcHandler } from "./streaming-adapter.js";

type RpcControllerShape = Record<string, unknown>;

type RpcMethodImpl = Parameters<ConnectRouter["rpc"]>[1];

export function buildConnectRoutes(di: AppContainer) {
  return (router: ConnectRouter): void => {
    for (const ctrl of di.getControllers()) {
      const controller = ctrl as Constructor<RpcControllerShape>;
      const service = Reflect.getMetadata(RPC_SERVICE_KEY, controller);

      if (!service) {
        continue;
      }

      const methods = (Reflect.getMetadata(RPC_METHODS_KEY, controller) as RpcMethodMeta[] | undefined) ?? [];

      for (const { method, handlerName } of methods) {
        if (method.methodKind === "unary") {
          router.rpc(method, createRpcHandler(di, controller, handlerName) as RpcMethodImpl);
        } else if (method.methodKind === "server_streaming") {
          router.rpc(method, createStreamingRpcHandler(di, controller, handlerName) as RpcMethodImpl);
        } else {
          const serviceName = method.parent.name;
          const rpcName = method.name;

          throw new Error(
            `Client streaming and bidi streaming are not supported: ${serviceName}.${rpcName} (${method.methodKind}) ` +
              `at ${controller.name}.${handlerName}. Use unary or server_streaming.`,
          );
        }
      }
    }
  };
}
