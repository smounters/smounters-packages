import "reflect-metadata";
import { type DependencyContainer } from "tsyringe";

import { CATCH_EXCEPTIONS_KEY } from "./tokens.js";
import { Reflector } from "./reflector.js";
import type { Constructor, ExceptionFilter } from "../types.js";

const reflector = new Reflector();

/**
 * Ключ энхансера для дедупликации: конструктор/класс — по ссылке,
 * инстанс — по конструктору, примитивы — по значению.
 */
export function enhancerKey(value: unknown): unknown {
  if (typeof value === "function") {
    return value;
  }

  if (value && typeof value === "object") {
    const ctor = (value as { constructor?: unknown }).constructor;
    if (ctor && ctor !== Object) {
      return ctor;
    }
  }

  return value;
}

/**
 * Оставляет только первое вхождение энхансера (по enhancerKey), сохраняя порядок.
 */
export function uniqueByEnhancer<T>(values: T[]): T[] {
  return values.filter((value, index, arr) => {
    const key = enhancerKey(value);
    return arr.findIndex((other) => enhancerKey(other) === key) === index;
  });
}

/**
 * Добавляет энхансер, если такого ключа ещё нет в массиве.
 */
export function pushUniqueEnhancer<T>(values: T[], value: T): T[] {
  const key = enhancerKey(value);

  if (values.some((current) => enhancerKey(current) === key)) {
    return values;
  }

  return [...values, value];
}

/**
 * Извлекает значение из payload по ключу (или возвращает весь payload, если ключа нет).
 * Общая утилита для HTTP и RPC адаптеров.
 */
export function getPayloadValue(payload: unknown, key?: string): unknown {
  if (!key) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  return (payload as Record<string, unknown>)[key];
}

/**
 * Проверяет, может ли фильтр обработать ошибку (по списку исключений в метаданных @Catch).
 * Общая утилита для HTTP и RPC адаптеров.
 */
export function canHandleException(error: unknown, filter: ExceptionFilter): boolean {
  const exceptions = Reflect.getMetadata(CATCH_EXCEPTIONS_KEY, filter.constructor) as Constructor[] | undefined;

  if (!exceptions || exceptions.length === 0) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return exceptions.some((ExceptionType) => error instanceof ExceptionType);
}

/**
 * Разрешает энхансер: если это конструктор — резолвит из DI-скопа,
 * если уже инстанс — возвращает как есть.
 * Общая утилита для HTTP и RPC адаптеров.
 */
export function resolveEnhancer<T>(scope: DependencyContainer, enhancer: Constructor<T> | T): T {
  if (typeof enhancer === "function") {
    return scope.resolve(enhancer as Constructor<T>);
  }

  return enhancer;
}

function readClassAndMethodMeta<T>(metadataKey: string | symbol, controller: Constructor, method: string): T[] {
  const classValues = reflector.get<T[]>(metadataKey, controller) ?? [];
  const methodValues = reflector.get<T[]>(metadataKey, controller.prototype[method]) ?? [];

  return [...classValues, ...methodValues];
}

/**
 * Собирает энхансеры (гуарды, интерсепторы, пайпы, фильтры):
 * глобальные + локальные (на классе и на методе).
 * `unique = true` 제거ет дубли по enhancerKey.
 */
export function collectEnhancers<T>(
  metadataKey: string | symbol,
  controller: Constructor,
  method: string,
  global: readonly T[],
  unique = false,
): T[] {
  const local = readClassAndMethodMeta<T>(metadataKey, controller, method);
  const merged = [...global, ...local];

  return unique ? uniqueByEnhancer(merged) : merged;
}
