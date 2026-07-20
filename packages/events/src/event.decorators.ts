import "reflect-metadata";

export const ON_EVENT_KEY = Symbol.for("imperium:events:handlers");

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
    const existing: EventHandlerMeta[] = Reflect.getMetadata(ON_EVENT_KEY, target.constructor) ?? [];

    existing.push({
      pattern,
      methodName: propertyKey as string,
    });

    Reflect.defineMetadata(ON_EVENT_KEY, existing, target.constructor);
  };
}
