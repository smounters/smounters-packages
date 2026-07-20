import "reflect-metadata";
import { Reflector } from "../core/reflector.js";
import { FILTERS_KEY } from "../decorators/filters.decorators.js";
import { GUARDS_KEY } from "../decorators/guards.decorators.js";
import { INTERCEPTORS_KEY } from "../decorators/interceptors.decorators.js";
import { PIPES_KEY } from "../decorators/pipes.decorators.js";

import type { Constructor, ExceptionFilterLike, GuardLike, InterceptorLike, PipeLike } from "../types.js";

const reflector = new Reflector();

function enhancerKey(value: unknown): unknown {
  if (typeof value === "function") {
    return value;
  }

  if (value && typeof value === "object") {
    const ctor = (value as { constructor?: unknown }).constructor;
    if (ctor && ctor !== Object) {
      return ctor;
    }
  }

  return value;
}

function uniqueByEnhancer<T>(values: T[]): T[] {
  return values.filter((value, index, arr) => {
    const key = enhancerKey(value);
    return arr.findIndex((other) => enhancerKey(other) === key) === index;
  });
}

function readClassAndMethodMeta<T>(metadataKey: string | symbol, controller: Constructor, method: string): T[] {
  const classValues = reflector.get<T[]>(metadataKey, controller) ?? [];
  const methodValues = reflector.get<T[]>(metadataKey, controller.prototype[method]) ?? [];

  return [...classValues, ...methodValues];
}

export function collectGuardsForRpc(controller: Constructor, method: string, global: GuardLike[]): GuardLike[] {
  const local = readClassAndMethodMeta<GuardLike>(GUARDS_KEY, controller, method);

  return [...global, ...local];
}

export function collectInterceptorsForRpc(
  controller: Constructor,
  method: string,
  global: InterceptorLike[],
): InterceptorLike[] {
  const local = readClassAndMethodMeta<InterceptorLike>(INTERCEPTORS_KEY, controller, method);

  return uniqueByEnhancer([...global, ...local]);
}

export function collectPipesForRpc(controller: Constructor, method: string, global: PipeLike[]): PipeLike[] {
  const local = readClassAndMethodMeta<PipeLike>(PIPES_KEY, controller, method);

  return [...global, ...local];
}

export function collectFiltersForRpc(
  controller: Constructor,
  method: string,
  global: ExceptionFilterLike[],
): ExceptionFilterLike[] {
  const local = readClassAndMethodMeta<ExceptionFilterLike>(FILTERS_KEY, controller, method);

  return uniqueByEnhancer([...global, ...local]);
}
