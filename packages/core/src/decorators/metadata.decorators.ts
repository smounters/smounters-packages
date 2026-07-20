import "reflect-metadata";
import type { MetadataKey } from "../types.js";

function getMetaTarget(target: object, propertyKey?: string | symbol): object {
  if (propertyKey === undefined) {
    return target;
  }

  const value = (target as Record<string | symbol, unknown>)[propertyKey];

  if (typeof value !== "object" && typeof value !== "function") {
    throw new Error("Decorator target is not an object");
  }

  return value!;
}

export function SetMetadata<T = unknown>(metadataKey: MetadataKey, metadataValue: T): ClassDecorator & MethodDecorator {
  return (target: object, propertyKey?: string | symbol) => {
    const metaTarget = getMetaTarget(target, propertyKey);
    Reflect.defineMetadata(metadataKey, metadataValue, metaTarget);
  };
}

export function appendArrayMetadata<T>(
  metadataKey: MetadataKey,
  values: readonly T[],
  target: object,
  propertyKey?: string | symbol,
): void {
  const metaTarget = getMetaTarget(target, propertyKey);
  const prev = (Reflect.getMetadata(metadataKey, metaTarget) as T[] | undefined) ?? [];

  Reflect.defineMetadata(metadataKey, [...prev, ...values], metaTarget);
}
