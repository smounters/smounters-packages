# Changelog

## 2.0.2 - 2026-07-28

### Added
- Первый релиз `@smounters/ui`: `AppLayout`/`Sidebar`/`Navbar`, `DataTable` с сохраняемыми
  настройками колонок (порядок, видимость, ширины, сортировка), `FormDrawer`/`Field`, `Paginator`,
  `StatusPill`, `StatCard`, `ThemeSwitcher`, `LanguageSwitcher`, хуки `useResizable`,
  `useServerTable`, `useDebounce`.
- Палитра и структурные стили HeroUI v3 — `@smounters/ui/styles.css`.
- `UiProvider`: подписи и хранилище настроек приходят от приложения, поэтому пакет не зависит ни от
  конкретного RPC-контракта, ни от каталогов переводов.
