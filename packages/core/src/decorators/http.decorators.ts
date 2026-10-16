import "reflect-metadata";
import type { HttpMethod, HttpParamMeta, HttpParamSource, HttpRouteMeta } from "../types.js";
import { Injectable } from "./di.decorators.js";
import { appendArrayMetadata } from "./metadata.decorators.js";
import { HTTP_CONTROLLER_KEY, HTTP_ROUTES_KEY, PARAMS_KEY } from "../core/tokens.js";

export function HttpController(prefix = ""): ClassDecorator {
  return (target) => {
    Injectable()(target as never);
    Reflect.defineMetadata(HTTP_CONTROLLER_KEY, { prefix }, target);
  };
}

function methodDecorator(method: HttpMethod) {
  return (path: string): MethodDecorator => {
    return (target, propertyKey) => {
      const existing: HttpRouteMeta[] = Reflect.getMetadata(HTTP_ROUTES_KEY, target.constructor) ?? [];

      existing.push({
        method,
        path,
        handlerName: propertyKey as string,
      });

      Reflect.defineMetadata(HTTP_ROUTES_KEY, existing, target.constructor);
    };
  };
}

export const Get = methodDecorator("GET");
export const Post = methodDecorator("POST");
export const Put = methodDecorator("PUT");
export const Patch = methodDecorator("PATCH");
export const Delete = methodDecorator("DELETE");

function setParamMeta(target: object, propertyKey: string | symbol | undefined, meta: HttpParamMeta): void {
  appendArrayMetadata(PARAMS_KEY, [meta], target, propertyKey);
}

function paramDecorator(source: HttpParamSource, key?: string): ParameterDecorator {
  return (target, propertyKey, index) => {
    setParamMeta(target, propertyKey ?? undefined, {
      index,
      source,
      key,
    });
  };
}

export const Body = (key?: string) => paramDecorator("body", key);
export const Query = (key?: string) => paramDecorator("query", key);
export const Param = (key?: string) => paramDecorator("param", key);
export const Header = (key: string) => paramDecorator("header", key);
export const Req = () => paramDecorator("req");
export const Res = () => paramDecorator("res");
