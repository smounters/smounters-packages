import "reflect-metadata";
import { collectEnhancers } from "../core/enhancers.js";
import { FILTERS_KEY, GUARDS_KEY, INTERCEPTORS_KEY, PIPES_KEY } from "../core/tokens.js";
import type { Constructor, ExceptionFilterLike, GuardLike, InterceptorLike, PipeLike } from "../types.js";

export function collectGuardsForHttp(controller: Constructor, method: string, global: GuardLike[]): GuardLike[] {
  return collectEnhancers(GUARDS_KEY, controller, method, global);
}

export function collectInterceptorsForHttp(
  controller: Constructor,
  method: string,
  global: InterceptorLike[],
): InterceptorLike[] {
  return collectEnhancers(INTERCEPTORS_KEY, controller, method, global, true);
}

export function collectPipesForHttp(controller: Constructor, method: string, global: PipeLike[]): PipeLike[] {
  return collectEnhancers(PIPES_KEY, controller, method, global);
}

export function collectFiltersForHttp(
  controller: Constructor,
  method: string,
  global: ExceptionFilterLike[],
): ExceptionFilterLike[] {
  return collectEnhancers(FILTERS_KEY, controller, method, global, true);
}
