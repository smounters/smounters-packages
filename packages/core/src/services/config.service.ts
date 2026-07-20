import { CONFIG_TOKEN } from "../core/config.js";
import { Inject, Injectable } from "../decorators/index.js";

type ConfigMap = Record<string, unknown>;

@Injectable()
export class ConfigService<TConfig extends ConfigMap = ConfigMap> {
  constructor(@Inject(CONFIG_TOKEN) private readonly config: TConfig) {}

  getAll(): Readonly<TConfig> {
    return this.config;
  }

  get<K extends keyof TConfig>(key: K): TConfig[K] {
    return this.config[key];
  }

  has(key: PropertyKey): boolean {
    return key in this.config;
  }

  getOrThrow<K extends keyof TConfig>(key: K, message?: string): NonNullable<TConfig[K]> {
    const value = this.config[key];

    if (value === undefined || value === null) {
      throw new Error(message ?? `Missing config key: ${String(key)}`);
    }

    return value as NonNullable<TConfig[K]>;
  }
}
