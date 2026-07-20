import "reflect-metadata";
import type { WsGatewayMeta, WsHandlerMeta, WsParamMeta, WsParamSource } from "../ws/types.js";
import { Injectable } from "./di.decorators.js";

export const WS_GATEWAY_KEY = Symbol.for("imperium:ws:gateway");
export const WS_HANDLERS_KEY = Symbol.for("imperium:ws:handlers");
export const WS_PARAMS_KEY = Symbol.for("imperium:ws:params");

export function WsGateway(path = "/ws"): ClassDecorator {
  return (target) => {
    Injectable()(target as never);
    const meta: WsGatewayMeta = { path };
    Reflect.defineMetadata(WS_GATEWAY_KEY, meta, target);
  };
}

export function WsHandler(messageType: string): MethodDecorator {
  return (target, propertyKey) => {
    const handlers: WsHandlerMeta[] = Reflect.getMetadata(WS_HANDLERS_KEY, target.constructor) ?? [];
    handlers.push({ messageType, handlerName: propertyKey as string });
    Reflect.defineMetadata(WS_HANDLERS_KEY, handlers, target.constructor);
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

function setParamMeta(target: object, propertyKey: string | symbol | undefined, meta: WsParamMeta): void {
  const metaTarget = getMetaTarget(target, propertyKey);
  const existing = Reflect.getMetadata(WS_PARAMS_KEY, metaTarget) as WsParamMeta[] | undefined;
  const next: WsParamMeta[] = existing ? [...existing, meta] : [meta];
  Reflect.defineMetadata(WS_PARAMS_KEY, next, metaTarget);
}

function wsParamDecorator(source: WsParamSource): ParameterDecorator {
  return (target, propertyKey, index) => {
    setParamMeta(target as object, propertyKey ?? undefined, { index, source });
  };
}

export const WsConnection = () => wsParamDecorator("connection");
export const WsMessage = () => wsParamDecorator("message");
export const WsRequest = () => wsParamDecorator("request");
