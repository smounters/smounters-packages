import "reflect-metadata";
import type { Constructor, OnApplicationShutdown, OnModuleInit } from "@smounters/core/core";
import { Inject, Injectable, Module } from "@smounters/core/decorators";
// НЕ `import type`: LoggerService — DI-токен конструктора CronBootstrap. Под emitDecoratorMetadata
// `import type` стирает рантайм-значение, design:paramtypes становится Object, и контейнер падает на
// старте: «TypeInfo not known for Object». Правило Biome useImportType переписывает это само — поэтому
// линтер для пакетов с DI выключен в biome.json (та же причина, что и для apps/backend).
import { LoggerService } from "@smounters/core/services";
import type { DependencyContainer } from "tsyringe";

import { CronService } from "./cron.service.js";

const CRON_TARGETS = Symbol.for("imperium:cron:targets");

export interface CronModuleOptions {
  providers: Constructor[];
}

@Injectable()
class CronBootstrap implements OnModuleInit, OnApplicationShutdown {
  constructor(
    private readonly cronService: CronService,
    private readonly logger: LoggerService,
    @Inject(CRON_TARGETS) private readonly targets: Constructor[],
    @Inject("cron:container") private readonly container: DependencyContainer,
  ) {}

  onModuleInit(): void {
    this.cronService.setLogger(this.logger);

    for (const target of this.targets) {
      const instance = this.container.resolve(target);
      this.cronService.registerProvider(instance as object, target.name);
    }
  }

  onApplicationShutdown(): void {
    this.cronService.stopAll();
  }
}

@Module({})
export class CronModule {
  static register(options: CronModuleOptions) {
    const cronTargets: Constructor[] = options.providers.filter((p) => CronService.hasCronJobs(p));

    return {
      module: CronModule,
      providers: [
        CronService,
        CronBootstrap,
        ...cronTargets,
        { provide: CRON_TARGETS, useValue: cronTargets },
        {
          provide: "cron:container",
          useFactory: (container: DependencyContainer) => container,
        },
      ],
      exports: [CronService],
    };
  }
}
