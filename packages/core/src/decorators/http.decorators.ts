import "reflect-metadata";
import type { HttpMethod, HttpParamMeta, HttpParamSource, HttpRouteMeta } from "../core/types.js";
import { Injectable } from "./di.decorators.js";

export const HTTP_ROUTES_KEY = Symbol.for("imperium:http:routes");
export const HTTP_CONTROLLER_KEY = Symbol.for("imperium:http:controller");
export const PARAMS_KEY = Symbol.for("imperium:http:params");

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

function setParamMeta(target: object, propertyKey: string | symbol | undefined, meta: HttpParamMeta): void {
  const metaTarget = getMetaTarget(target, propertyKey);

  const existing = Reflect.getMetadata(PARAMS_KEY, metaTarget) as HttpParamMeta[] | undefined;

  const next: HttpParamMeta[] = existing ? [...existing, meta] : [meta];

  Reflect.defineMetadata(PARAMS_KEY, next, metaTarget);
}

function paramDecorator(source: HttpParamSource, key?: string): ParameterDecorator {
  return (target, propertyKey, index) => {
    setParamMeta(target as object, propertyKey ?? undefined, {
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
