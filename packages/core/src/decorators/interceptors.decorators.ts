import "reflect-metadata";
import type { InterceptorLike } from "../types.js";
import { appendArrayMetadata } from "./metadata.decorators.js";

export const INTERCEPTORS_KEY = Symbol.for("imperium:interceptors");

export function UseInterceptors(...inters: InterceptorLike[]): ClassDecorator & MethodDecorator {
  return (target: object, propertyKey?: string | symbol) => {
    appendArrayMetadata(INTERCEPTORS_KEY, inters, target, propertyKey);
  };
}
