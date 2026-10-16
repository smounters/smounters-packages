import "reflect-metadata";
import type { GuardLike } from "../types.js";
import { appendArrayMetadata } from "./metadata.decorators.js";
import { GUARDS_KEY } from "../core/tokens.js";

export function UseGuards(...guards: GuardLike[]): ClassDecorator & MethodDecorator {
  return (target: object, propertyKey?: string | symbol) => {
    appendArrayMetadata(GUARDS_KEY, guards, target, propertyKey);
  };
}
