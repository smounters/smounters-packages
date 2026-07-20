import "reflect-metadata";
import type { PipeLike } from "../types.js";
import { appendArrayMetadata } from "./metadata.decorators.js";

export const PIPES_KEY = Symbol.for("imperium:pipes");

export function UsePipes(...pipes: PipeLike[]): ClassDecorator & MethodDecorator {
  return (target: object, propertyKey?: string | symbol) => {
    appendArrayMetadata(PIPES_KEY, pipes, target, propertyKey);
  };
}
