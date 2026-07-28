// @smounters/ui — дизайн-слой на HeroUI v3: каркас приложения, таблица с настройками колонок, формы.
//
// Пакет НЕ знает ни про RPC, ни про каталоги переводов: где хранить настройки пользователя и как
// подписывать кнопки, задаёт приложение через <UiProvider>. Поэтому он ставится в любой проект, а не
// только в тот, где вырос.

export type { CellContext, ColumnDef } from "@tanstack/react-table";
export { createColumnHelper } from "@tanstack/react-table";
export {
  DataTable,
  type DataTableProps,
  Paginator,
  type PaginatorProps,
  TABLE_COLUMNS_SECTION,
} from "./components/DataTable";
export { EnumSelect, type EnumOption, type EnumSelectProps } from "./components/EnumSelect";
export { Field, FormDrawer, type FormDrawerProps, SELECT_CLASS } from "./components/FormDrawer";
export { type LanguageOption, LanguageSwitcher, type LanguageSwitcherProps } from "./components/LanguageSwitcher";
export { StatCard, type StatCardProps } from "./components/StatCard";
export { StatusPill, type StatusTone } from "./components/StatusPill";
export { ThemeSwitcher, type ThemeSwitcherLabels, type ThemeSwitcherProps } from "./components/ThemeSwitcher";
export { useDebounce } from "./hooks/useDebounce";
export { type Resizable, useResizable, type UseResizableOptions } from "./hooks/useResizable";
export { type ServerTableQuery, useServerTable } from "./hooks/useServerTable";
export { ICONS, Icon, type IconName } from "./icons";
export { AppLayout, type AppLayoutProps, LAYOUT_SECTION } from "./layout/AppLayout";
export { getPageTitle } from "./layout/get-page-title";
export { Navbar, type NavbarProps } from "./layout/Navbar";
export { PageTitleProvider, type PageTitleProviderProps, usePageTitleContext } from "./layout/PageTitleContext";
export { Sidebar, type SidebarProps } from "./layout/Sidebar";
export type { SidebarItem } from "./layout/types";
export { usePageTitle } from "./layout/use-page-title";
export {
  DEFAULT_LABELS,
  inMemorySettings,
  type PartialLabels,
  type UiLabels,
  UiProvider,
  type UiProviderProps,
  type UiSetting,
  type UseSettingHook,
  useUiLabels,
  useUiSetting,
} from "./provider";
