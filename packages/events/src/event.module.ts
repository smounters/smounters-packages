import "reflect-metadata";

import type { Constructor, OnModuleInit } from "@smounters/core/core";
import { Inject, Injectable, Module } from "@smounters/core/decorators";
import type { DependencyContainer } from "tsyringe";

import { EventService } from "./event.service.js";
import { EVENTS_CONTAINER, EVENTS_LISTENERS_TOKEN } from "./event.tokens.js";

export interface EventModuleOptions {
  /**
   * Providers that contain @OnEvent() decorated methods.
   * Automatically registered as DI providers and scanned for event handlers.
   */
  listeners: Constructor[];
}

@Injectable()
class EventBootstrap implements OnModuleInit {
  constructor(
    private readonly eventService: EventService,
    @Inject(EVENTS_LISTENERS_TOKEN) private readonly listeners: Constructor[],
    @Inject(EVENTS_CONTAINER) private readonly container: DependencyContainer,
  ) {}

  onModuleInit(): void {
    for (const listener of this.listeners) {
      const instance = this.container.resolve(listener);
      this.eventService.registerListener(instance as object, listener.name);
    }
  }
}

@Module({})
export class EventModule {
  static register(options: EventModuleOptions) {
    const eventListeners: Constructor[] = options.listeners.filter((l) => EventService.hasEventHandlers(l));

    return {
      module: EventModule,
      providers: [
        EventService,
        EventBootstrap,
        ...eventListeners,
        { provide: EVENTS_LISTENERS_TOKEN, useValue: eventListeners },
        {
          provide: "events:container",
          useFactory: (container: DependencyContainer) => container,
        },
      ],
      exports: [EventService],
    };
  }
}
