import { createContext, type ReactNode, useContext, useMemo } from "react";

/**
 * Единственные две вещи, которые пакет не может решить сам: где хранить настройки пользователя и на
 * каком языке подписывать кнопки. Обе приходят снаружи — поэтому здесь нет ни зависимости от
 * конкретного RPC-контракта, ни от каталогов переводов приложения.
 */
export interface UiSetting<T> {
  value: T;
  isLoaded: boolean;
  setValue: (value: T) => void;
}

/**
 * Хук доступа к настройке (section/key). Приложение реализует его своим транспортом: в наших
 * продуктах это `UserSettingsService` поверх Connect-Query, но подойдёт что угодно, включая
 * localStorage. Правило одно — это ХУК, его нельзя звать условно.
 */
export type UseSettingHook = <T>(section: string, key: string, fallback: T) => UiSetting<T>;

/** Настройки не хранятся — компоненты работают в памяти вкладки. */
export const inMemorySettings: UseSettingHook = <T,>(_section: string, _key: string, fallback: T): UiSetting<T> => ({
  value: fallback,
  isLoaded: true,
  setValue: () => undefined,
});

export interface UiLabels {
  actions: {
    save: string;
    cancel: string;
    edit: string;
    delete: string;
    resize: string;
    signOut: string;
    showSecret: string;
    hideSecret: string;
    confirm: string;
  };
  table: {
    columns: string;
    resetColumns: string;
    empty: string;
    loadError: (message: string) => string;
    loadErrorFallback: string;
    dragColumn: string;
    resizeColumn: string;
    /** Подписи галочек выделения строк (`enableSelection`). */
    selectAll: string;
    selectRow: string;
    perPage: string;
    rowsPerPage: string;
    range: (r: { from: number; to: number; total: number }) => string;
    first: string;
    prev: string;
    next: string;
    last: string;
  };
  layout: {
    expandSidebar: string;
    collapseSidebar: string;
    userMenu: string;
    resizeSidebar: string;
  };
  theme: { light: string; dark: string; system: string };
  language: { label: string };
}

export const DEFAULT_LABELS: UiLabels = {
  actions: {
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    resize: "Resize",
    signOut: "Sign out",
    showSecret: "Show",
    hideSecret: "Hide",
    confirm: "Confirm",
  },
  table: {
    columns: "Columns",
    resetColumns: "Reset columns",
    empty: "Nothing here yet",
    loadError: (message) => `Failed to load: ${message}`,
    loadErrorFallback: "unknown error",
    dragColumn: "Drag to reorder",
    resizeColumn: "Drag to resize",
    selectAll: "Select all rows on this page",
    selectRow: "Select row",
    perPage: "Per page",
    rowsPerPage: "Rows per page",
    range: ({ from, to, total }) => `${from}–${to} of ${total}`,
    first: "First page",
    prev: "Previous page",
    next: "Next page",
    last: "Last page",
  },
  layout: {
    expandSidebar: "Expand sidebar",
    collapseSidebar: "Collapse sidebar",
    userMenu: "Account",
    resizeSidebar: "Resize sidebar",
  },
  theme: { light: "Light", dark: "Dark", system: "System" },
  language: { label: "Language" },
};

/** Частичные подписи: приложение переопределяет только то, что переводит. */
export type PartialLabels = {
  [K in keyof UiLabels]?: Partial<UiLabels[K]>;
};

/**
 * Что сделать после смены темы. HeroUI хранит выбор per-origin, поэтому продукт, разложенный по
 * поддоменам, пишет здесь свою куку на общий домен — и тема переносится между приложениями. Живёт в
 * провайдере, а не в пропсе: переключатель темы рисует ещё и `Navbar` внутри каркаса, куда приложение
 * пропс не передаёт.
 */
export type ThemeChangeHandler = (mode: string) => void;

interface UiContextValue {
  labels: UiLabels;
  useSetting: UseSettingHook;
  onThemeChange?: ThemeChangeHandler | undefined;
}

const UiContext = createContext<UiContextValue | null>(null);

export interface UiProviderProps {
  children: ReactNode;
  labels?: PartialLabels;
  /** Без него настройки живут только в памяти вкладки и не переживают перезагрузку. */
  useSetting?: UseSettingHook;
  /** Вызывается после каждой смены темы — сюда приложение вешает своё хранение (например куку). */
  onThemeChange?: ThemeChangeHandler | undefined;
}

export function UiProvider({ children, labels, useSetting = inMemorySettings, onThemeChange }: UiProviderProps) {
  const value = useMemo<UiContextValue>(
    () => ({
      labels: {
        actions: { ...DEFAULT_LABELS.actions, ...labels?.actions },
        table: { ...DEFAULT_LABELS.table, ...labels?.table },
        layout: { ...DEFAULT_LABELS.layout, ...labels?.layout },
        theme: { ...DEFAULT_LABELS.theme, ...labels?.theme },
        language: { ...DEFAULT_LABELS.language, ...labels?.language },
      },
      useSetting,
      onThemeChange,
    }),
    [labels, useSetting, onThemeChange],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

/** Подписи. Без провайдера — английские дефолты: компонент не должен падать из-за забытой обёртки. */
export function useUiLabels(): UiLabels {
  return useContext(UiContext)?.labels ?? DEFAULT_LABELS;
}

/** Обработчик смены темы из провайдера; без него переключатель просто ничего не делает сверх HeroUI. */
export function useUiThemeChange(): ThemeChangeHandler | undefined {
  return useContext(UiContext)?.onThemeChange;
}

export function useUiSetting<T>(section: string, key: string, fallback: T): UiSetting<T> {
  const ctx = useContext(UiContext);
  const hook = ctx?.useSetting ?? inMemorySettings;
  return hook(section, key, fallback);
}
