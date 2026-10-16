import "reflect-metadata";
import { RPC_METHODS_KEY, RPC_PARAMS_KEY, RPC_SERVICES_KEY } from "../core/tokens.js";
import type {
  RpcMethodDescriptor,
  RpcMethodMeta,
  RpcParamMeta,
  RpcParamSource,
  RpcServiceDescriptor,
} from "../types.js";
import { Injectable } from "./di.decorators.js";
import { appendArrayMetadata } from "./metadata.decorators.js";

export function RpcService(service: RpcServiceDescriptor): ClassDecorator {
  return (target) => {
    Injectable()(target as never);
    Reflect.defineMetadata(RPC_SERVICES_KEY, service, target);
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

function setParamMeta(target: object, propertyKey: string | symbol | undefined, meta: RpcParamMeta): void {
  appendArrayMetadata(RPC_PARAMS_KEY, [meta], target, propertyKey);
}

function rpcParamDecorator(source: RpcParamSource, key?: string): ParameterDecorator {
  return (target, propertyKey, index) => {
    setParamMeta(target, propertyKey ?? undefined, {
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
