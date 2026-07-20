import "reflect-metadata";
import { injectable } from "tsyringe";

import type { EventHandlerMeta } from "./event.decorators.js";
import { ON_EVENT_KEY } from "./event.decorators.js";

interface RegisteredHandler {
  pattern: string;
  regex: RegExp;
  callback: (payload: unknown) => Promise<void> | void;
  listenerName: string;
  methodName: string;
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]+");
  return new RegExp(`^${escaped}$`);
}

@injectable()
export class EventService {
  private readonly handlers: RegisteredHandler[] = [];
  private logger: { error: (...args: unknown[]) => void } = console;
  private onError?: (error: unknown, context: { type: "events"; handler: string; controller: string }) => void;

  setLogger(logger: { error: (...args: unknown[]) => void }): void {
    this.logger = logger;
  }

  setOnError(
    callback: (error: unknown, context: { type: "events"; handler: string; controller: string }) => void,
  ): void {
    this.onError = callback;
  }

  /**
   * Register an event listener instance. Scans @OnEvent() metadata
   * and binds methods as handlers.
   */
  registerListener(instance: object, listenerName: string): void {
    const constructor = instance.constructor;
    const metas: EventHandlerMeta[] = Reflect.getMetadata(ON_EVENT_KEY, constructor) ?? [];

    for (const meta of metas) {
      const method = (instance as Record<string, unknown>)[meta.methodName];

      if (typeof method !== "function") {
        throw new Error(`@OnEvent() target ${listenerName}.${meta.methodName} is not a function`);
      }

      this.handlers.push({
        pattern: meta.pattern,
        regex: patternToRegex(meta.pattern),
        callback: method.bind(instance) as (payload: unknown) => Promise<void> | void,
        listenerName,
        methodName: meta.methodName,
      });
    }
  }

  /**
   * Check if a class has any @OnEvent() decorated methods.
   */
  static hasEventHandlers(target: Function): boolean {
    const metas: EventHandlerMeta[] | undefined = Reflect.getMetadata(ON_EVENT_KEY, target);
    return (metas?.length ?? 0) > 0;
  }

  /**
   * Emit an event. All matching handlers are called concurrently.
   * Errors in individual handlers are caught and logged — they don't
   * block other handlers or the caller.
   */
  async emit(event: string, payload?: unknown): Promise<void> {
    const matching = this.handlers.filter((h) => h.regex.test(event));

    if (matching.length === 0) {
      return;
    }

    const promises = matching.map(async (h) => h.callback(payload));
    const results = await Promise.allSettled(promises);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const handler = matching[i];
      if (result?.status === "rejected" && handler) {
        this.logger.error(
          `[imperium-events] Handler ${handler.listenerName}.${handler.methodName} ` + `failed for event "${event}":`,
          result.reason,
        );
        this.onError?.(result.reason, {
          type: "events",
          handler: handler.methodName,
          controller: handler.listenerName,
        });
      }
    }
  }

  /**
   * Get all registered handlers (for introspection/testing).
   */
  getHandlers(): readonly { pattern: string; listenerName: string; methodName: string }[] {
    return this.handlers.map((h) => ({
      pattern: h.pattern,
      listenerName: h.listenerName,
      methodName: h.methodName,
    }));
  }
}
