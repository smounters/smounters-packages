import "reflect-metadata";
import type { WsGatewayMeta, WsHandlerMeta, WsParamMeta, WsParamSource } from "../ws/types.js";
import { Injectable } from "./di.decorators.js";
import { appendArrayMetadata } from "./metadata.decorators.js";
import { WS_GATEWAY_KEY, WS_HANDLERS_KEY, WS_PARAMS_KEY } from "../core/tokens.js";

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

function setParamMeta(target: object, propertyKey: string | symbol | undefined, meta: WsParamMeta): void {
  appendArrayMetadata(WS_PARAMS_KEY, [meta], target, propertyKey);
}

function wsParamDecorator(source: WsParamSource): ParameterDecorator {
  return (target, propertyKey, index) => {
    setParamMeta(target, propertyKey ?? undefined, { index, source });
  };
}

export const WsConnection = () => wsParamDecorator("connection");
export const WsMessage = () => wsParamDecorator("message");
export const WsRequest = () => wsParamDecorator("request");
