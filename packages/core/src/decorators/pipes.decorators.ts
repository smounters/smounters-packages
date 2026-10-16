import "reflect-metadata";
import type { PipeLike } from "../types.js";
import { appendArrayMetadata } from "./metadata.decorators.js";
import { PIPES_KEY } from "../core/tokens.js";

export function UsePipes(...pipes: PipeLike[]): ClassDecorator & MethodDecorator {
  return (target: object, propertyKey?: string | symbol) => {
    appendArrayMetadata(PIPES_KEY, pipes, target, propertyKey);
  };
}
