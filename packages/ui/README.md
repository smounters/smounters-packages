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

## Токены и переопределение

`@smounters/ui/styles.css` подключает Tailwind, стили HeroUI, палитру продуктов
(`theme/palette.css`) и структурные правки (`theme/base.css`: рамки полей, единый масштаб радиусов,
focus-ring, стрелка нативного `<select>`). Светлая и тёмная темы — из коробки, переключатель
`<ThemeSwitcher/>` (он же ставит `data-theme` на `<html>`).

**Базовые токены** (задаются на `:root, [data-theme="light"]` и отдельно на `[data-theme="dark"]`):

| токен | что красит |
|---|---|
| `--accent` / `--accent-foreground` | акцент: активный пункт меню, primary-кнопки, ссылки |
| `--background` / `--foreground` | фон страницы и основной текст |
| `--success` / `--warning` / `--danger` | статусы (`StatusPill`, кнопки удаления, ошибки) |
| `--radius-small` / `--radius-medium` / `--radius-large` | контролы и поверхности |
| `--field-border` / `--field-border-width` | рамка инпутов |

Остальное (`--surface`, `--surface-secondary`, `--border`, `--muted`, `--focus`, hover- и
soft-варианты) HeroUI выводит из базовых через `color-mix()` — их трогать обычно не нужно.

### Переопределить существующий

Приложение импортирует пакет, а СВОИ токены объявляет после — по каскаду выигрывают они. Обе темы
задаются отдельно: одного `:root` мало, иначе тёмная останется на палитре пакета.

```css
@import "@smounters/ui/styles.css";

:root,
[data-theme="light"] {
  --accent: oklch(0.55 0.13 195);
}
[data-theme="dark"] {
  --accent: oklch(0.72 0.13 195);
}
```

### Добавить новый

Своё понятие (у торгового терминала это, например, «лонг» и «шорт») объявляется в два слоя:
переменная на тему — чтобы значение зависело от светлой/тёмной, и `@theme` — чтобы Tailwind
СГЕНЕРИРОВАЛ утилиты (`text-long`, `bg-long/10`, `border-long`). Без второго слоя переменная есть, а
классов нет.

```css
:root, [data-theme="light"] { --long: oklch(0.52 0.15 150); }
[data-theme="dark"]         { --long: oklch(0.78 0.15 150); }

/* мягкие варианты — СВОИМИ токенами, а не через `/10` (почему — ниже) */
:root, [data-theme="light"], [data-theme="dark"] {
  --long-soft: color-mix(in oklch, var(--long) 12%, transparent);
  --long-border: color-mix(in oklch, var(--long) 40%, transparent);
}

@theme inline {
  --color-long: var(--long);
  --color-long-soft: var(--long-soft);
  --color-long-border: var(--long-border);
}
```

`inline` обязателен: без него Tailwind подставит значение на момент сборки, и утилита перестанет
реагировать на смену темы.

**Грабли, о которых стоит знать заранее:** у токена-ссылки (`var(...)`) **не работает модификатор
прозрачности**. Tailwind не знает цвет на сборке и молча выбрасывает модификатор — `bg-long/10`
собирается в `background-color: var(--long)`, то есть в сплошную заливку вместо подложки. Ошибки при
сборке не будет, увидите только глазами. Поэтому мягкий фон и рамку задавайте отдельными токенами
через `color-mix()`, как выше.

### Своя палитра целиком

Продукту под чужим брендом импортировать нашу палитру незачем — есть вход без неё:

```css
@import "@smounters/ui/styles-unthemed.css";
/* дальше свои --accent/--background/--foreground/--success/--warning/--danger на обе темы */
```

Отдельно доступны и части: `@smounters/ui/theme/palette.css`, `@smounters/ui/theme/base.css`.

## Настройки таблицы

`DataTable` требует `code` — стабильный идентификатор таблицы (`"trades.list"`). Под ним в секции
`table-columns` лежит `{ order, hidden, sorting, sizes }`. Код таблицы менять нельзя: он и есть ключ,
по которому у пользователя найдутся его колонки.
