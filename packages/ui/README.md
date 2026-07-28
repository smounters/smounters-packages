# @smounters/ui

Дизайн-слой на [HeroUI v3](https://heroui.com) + Tailwind v4: каркас приложения с ресайзящимся
сайдбаром, таблица с пользовательскими настройками колонок, выезжающая форма.

```bash
npm i @smounters/ui @heroui/react @heroui/styles react-router-dom
```

## Что внутри

| | |
|---|---|
| `AppLayout` / `Sidebar` / `Navbar` | каркас: сайдбар (ширина тянется мышью, сворачивается), топбар с заголовком страницы, контент через `<Outlet/>` |
| `DataTable` | TanStack Table + перетаскивание колонок (dnd-kit) + меню видимости + ресайз; порядок, ширины, видимость и сортировка сохраняются per-user |
| `FormDrawer` / `Field` | правая панель под создание/редактирование, ширина тянется за левый край |
| `Paginator`, `StatusPill`, `StatCard`, `ThemeSwitcher`, `LanguageSwitcher` | мелкие общие компоненты |
| `useResizable`, `useServerTable`, `useDebounce` | хуки |

## Подключение

```tsx
import "@smounters/ui/styles.css";
import { UiProvider, AppLayout } from "@smounters/ui";

<UiProvider labels={labels} useSetting={useSetting}>
  <AppLayout sidebarItems={items} appName="Console" />
</UiProvider>;
```

Пакет не знает ни про ваш RPC, ни про ваши переводы — обе связки приходят через `UiProvider`:

- **`useSetting`** — хук `(section, key, fallback) => { value, isLoaded, setValue }`. Через него
  таблица и сайдбар хранят состояние. В наших продуктах он ходит в `UserSettingsService` по
  ConnectRPC, но подойдёт что угодно, включая localStorage. Не передан — состояние живёт только в
  памяти вкладки. **Это хук**: реализация должна быть стабильной по идентичности и не зваться условно.
- **`labels`** — подписи кнопок и таблицы. По умолчанию английские (`DEFAULT_LABELS`);
  переопределяются частично, значения с подстановкой — функциями:

```ts
const labels = {
  actions: { save: t("actions.save") },
  table: { range: ({ from, to, total }) => t("table.range", { from, to, total }) },
};
```

## Тема

`@smounters/ui/styles.css` подключает Tailwind, стили HeroUI, палитру продуктов (`theme/palette.css`)
и структурные правки (`theme/base.css`: рамки полей, единый масштаб радиусов, focus-ring). Светлая и
тёмная темы — из коробки, переключатель `<ThemeSwitcher/>`.

Палитра общая намеренно: продукты должны выглядеть одинаково. Если приложению нужен свой акцент —
переопределяет токены после импорта:

```css
@import "@smounters/ui/styles.css";

:root, [data-theme="light"] { --accent: oklch(0.55 0.13 195); }
[data-theme="dark"] { --accent: oklch(0.72 0.13 195); }
```

## Настройки таблицы

`DataTable` требует `code` — стабильный идентификатор таблицы (`"trades.list"`). Под ним в секции
`table-columns` лежит `{ order, hidden, sorting, sizes }`. Код таблицы менять нельзя: он и есть ключ,
по которому у пользователя найдутся его колонки.
