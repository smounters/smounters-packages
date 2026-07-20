import "reflect-metadata";
import type {
  RpcMethodDescriptor,
  RpcMethodMeta,
  RpcParamMeta,
  RpcParamSource,
  RpcServiceDescriptor,
} from "../core/types.js";
import { Injectable } from "./di.decorators.js";

// Symbol.for() ensures a single global symbol even if the module is loaded
// from multiple paths (e.g. duplicate installs, hoisted vs nested node_modules).
export const RPC_SERVICE_KEY = Symbol.for("imperium:rpc:service");
export const RPC_METHODS_KEY = Symbol.for("imperium:rpc:methods");
export const RPC_PARAMS_KEY = Symbol.for("imperium:rpc:params");

export function RpcService(service: RpcServiceDescriptor): ClassDecorator {
  return (target) => {
    Injectable()(target as never);
    Reflect.defineMetadata(RPC_SERVICE_KEY, service, target);
  };
}

export function RpcMethod(method: RpcMethodDescriptor): MethodDecorator {
  return (target, propertyKey) => {
    const existing: RpcMethodMeta[] = Reflect.getMetadata(RPC_METHODS_KEY, target.constructor) ?? [];

    existing.push({
      method,
      handlerName: propertyKey as string,
    });

    Reflect.defineMetadata(RPC_METHODS_KEY, existing, target.constructor);
  };
}

function getMetaTarget(target: object, propertyKey?: string | symbol): object {
  if (propertyKey === undefined) {
    return target;
  }

  const value = (target as Record<string | symbol, unknown>)[propertyKey];

  if (typeof value !== "object" && typeof value !== "function") {
    throw new Error("Decorator target is not an object");
  }

  return value!;
}

function setParamMeta(target: object, propertyKey: string | symbol | undefined, meta: RpcParamMeta): void {
  const metaTarget = getMetaTarget(target, propertyKey);

  const existing = Reflect.getMetadata(RPC_PARAMS_KEY, metaTarget) as RpcParamMeta[] | undefined;
  const next: RpcParamMeta[] = existing ? [...existing, meta] : [meta];

  Reflect.defineMetadata(RPC_PARAMS_KEY, next, metaTarget);
}

function rpcParamDecorator(source: RpcParamSource, key?: string): ParameterDecorator {
  return (target, propertyKey, index) => {
    setParamMeta(target as object, propertyKey ?? undefined, {
      index,
      source,
      key,
    });
  };
}

export const RpcData = (key?: string) => rpcParamDecorator("data", key);
export const RpcContext = () => rpcParamDecorator("context");
export const RpcHeaders = () => rpcParamDecorator("headers");
export const RpcHeader = (key: string) => rpcParamDecorator("header", key);
export const RpcAbortSignal = () => rpcParamDecorator("abort_signal");
