import "reflect-metadata";
import type { GuardLike } from "../types.js";
import { appendArrayMetadata } from "./metadata.decorators.js";

export const GUARDS_KEY = Symbol.for("imperium:guards");

export function UseGuards(...guards: GuardLike[]): ClassDecorator & MethodDecorator {
  return (target: object, propertyKey?: string | symbol) => {
    appendArrayMetadata(GUARDS_KEY, guards, target, propertyKey);
  };
}
