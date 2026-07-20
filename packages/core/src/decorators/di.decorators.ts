import "reflect-metadata";
import { inject, injectAll, injectable, Lifecycle } from "tsyringe";
import type { InjectionToken, ModuleMeta } from "../types.js";

export const MODULE_KEY = Symbol.for("imperium:module");

export function Module(meta: ModuleMeta): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(MODULE_KEY, meta, target);
  };
}

export const Injectable = injectable;
export const Inject = inject;
export const InjectAll = injectAll;
export const Scope = Lifecycle;

export function Optional(token: InjectionToken<unknown>): ParameterDecorator {
  return inject(token, { isOptional: true });
}
