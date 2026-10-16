import "reflect-metadata";
import { inject, injectable, injectAll, Lifecycle } from "tsyringe";
import type { InjectionToken, ModuleMeta } from "../types.js";
import { MODULE_KEY } from "../core/tokens.js";

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
