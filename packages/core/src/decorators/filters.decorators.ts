import "reflect-metadata";
import type { Constructor, ExceptionFilterLike } from "../types.js";
import { Injectable } from "./di.decorators.js";
import { appendArrayMetadata } from "./metadata.decorators.js";
import { CATCH_EXCEPTIONS_KEY, FILTERS_KEY } from "../core/tokens.js";

export function UseFilters(...filters: ExceptionFilterLike[]): ClassDecorator & MethodDecorator {
  return (target: object, propertyKey?: string | symbol) => {
    appendArrayMetadata(FILTERS_KEY, filters, target, propertyKey);
  };
}

export function Catch(...exceptions: Constructor[]): ClassDecorator {
  return (target) => {
    Injectable()(target as never);
    Reflect.defineMetadata(CATCH_EXCEPTIONS_KEY, exceptions, target);
  };
}
