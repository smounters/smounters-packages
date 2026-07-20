# Changelog

## 2.0.1 - 2026-07-20

### Fixed
- **`CronModule` больше не падает на старте под `emitDecoratorMetadata`.** `LoggerService`
  импортировался как `import type`, из-за чего рантайм-значение стиралось, `design:paramtypes`
  становился `Object` и DI-контейнер выбрасывал «TypeInfo not known for Object».

### Changed
- Форматирование приведено к Biome. Публичный API не изменился.
- Репозиторий переехал из `smounters/imperium` в `smounters/smounters-public`.

## 2.0.0 - 2026-06-11

### Changed
- **BREAKING:** пакет переименован `@smounters/imperium-cron` → `@smounters/cron`,
  зависимость — на `@smounters/core`. API не менялся.

> Записи за 0.1.0 … 1.2.1 не велись.

## 0.1.0 - 2026-03-30

- Initial release.
- `@Cron(expression, options?)` method decorator.
- `CronModule.register({ providers })` dynamic module.
- `CronService` with `getJobs()` and `stopAll()`.
- Auto-stop on application shutdown via `OnApplicationShutdown`.
- Built on croner v10.
