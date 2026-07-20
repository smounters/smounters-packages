import "reflect-metadata";
import { Injectable } from "../decorators/di.decorators.js";
import type { MetadataKey } from "../types.js";

type MetadataTarget = object | Function | undefined;

@Injectable()
export class Reflector {
  get<T = unknown>(metadataKey: MetadataKey, target: MetadataTarget): T | undefined {
    if (!target) {
      return undefined;
    }

    return Reflect.getMetadata(metadataKey, target) as T | undefined;
  }

  getAllAndOverride<T = unknown>(metadataKey: MetadataKey, targets: MetadataTarget[]): T | undefined {
    for (const target of targets) {
      const value = this.get<T>(metadataKey, target);
      if (value !== undefined) {
        return value;
      }
    }

    return undefined;
  }

  getAllAndMerge<T = unknown[]>(metadataKey: MetadataKey, targets: MetadataTarget[]): T {
    const result: unknown[] = [];

    for (const target of targets) {
      const value = this.get<unknown>(metadataKey, target);

      if (Array.isArray(value)) {
        result.push(...value);
      }
    }

    return result as T;
  }
}
