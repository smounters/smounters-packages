# Changelog

## 2.0.3 - 2026-07-28

### Added
- `@smounters/ui/styles-unthemed.css` — всё то же, но без палитры продуктов: для продукта под чужим
  брендом. Отдельно доступны части: `theme/palette.css`, `theme/base.css`.
- README: перечень базовых токенов, рецепты переопределения и добавления своих (включая грабли с
  модификатором прозрачности у токенов-ссылок).

## 2.0.2 - 2026-07-28

### Added
- Первый релиз `@smounters/ui`: `AppLayout`/`Sidebar`/`Navbar`, `DataTable` с сохраняемыми
  настройками колонок (порядок, видимость, ширины, сортировка), `FormDrawer`/`Field`, `Paginator`,
  `StatusPill`, `StatCard`, `ThemeSwitcher`, `LanguageSwitcher`, хуки `useResizable`,
  `useServerTable`, `useDebounce`.
- Палитра и структурные стили HeroUI v3 — `@smounters/ui/styles.css`.
- `UiProvider`: подписи и хранилище настроек приходят от приложения, поэтому пакет не зависит ни от
  конкретного RPC-контракта, ни от каталогов переводов.
