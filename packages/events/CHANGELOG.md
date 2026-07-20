# Changelog

## 2.0.1 - 2026-07-20

### Changed
- Форматирование приведено к Biome (переносы длинных сигнатур). Изменений поведения нет,
  публичный API не изменился.
- Репозиторий переехал из `smounters/imperium` в `smounters/smounters-public`.

## 2.0.0 - 2026-06-11

### Changed
- **BREAKING:** пакет переименован `@smounters/imperium-events` → `@smounters/events`,
  зависимость — на `@smounters/core`. API не менялся.

> Записи за 0.1.0 … 1.2.1 не велись.

## 0.1.0 - 2026-03-30

- Initial release.
- `@OnEvent(pattern)` method decorator with wildcard support.
- `EventModule.register({ listeners })` dynamic module.
- `EventService` with `emit()` and `getHandlers()`.
- Concurrent handler execution with per-handler error isolation.
- Zero runtime dependencies.
