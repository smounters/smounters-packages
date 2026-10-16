import "reflect-metadata";
import type { InterceptorLike } from "../types.js";
import { appendArrayMetadata } from "./metadata.decorators.js";
import { INTERCEPTORS_KEY } from "../core/tokens.js";

export function UseInterceptors(...inters: InterceptorLike[]): ClassDecorator & MethodDecorator {
  return (target: object, propertyKey?: string | symbol) => {
    appendArrayMetadata(INTERCEPTORS_KEY, inters, target, propertyKey);
  };
}
