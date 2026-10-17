import "reflect-metadata";
import { EVENTS_HANDLERS_TOKEN } from "./event.tokens.js";

export interface EventHandlerMeta {
  pattern: string;
  methodName: string;
}

/**
 * Mark a method to handle events matching the given pattern.
 *
 * Supports exact match (`"trade.opened"`) and wildcard (`"trade.*"`).
 *
 * @param pattern - Event name or wildcard pattern
 */
export function OnEvent(pattern: string): MethodDecorator {
  return (target, propertyKey) => {
    const existing: EventHandlerMeta[] = Reflect.getMetadata(EVENTS_HANDLERS_TOKEN, target.constructor) ?? [];

    existing.push({
      pattern,
      methodName: propertyKey as string,
    });

    Reflect.defineMetadata(EVENTS_HANDLERS_TOKEN, existing, target.constructor);
  };
}
