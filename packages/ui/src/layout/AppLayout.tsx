import { cn } from "@heroui/react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useResizable } from "../hooks/useResizable";
import { useUiLabels, useUiSetting } from "../provider";
import type { LanguageOption } from "../components/LanguageSwitcher";
import { getPageTitle } from "./get-page-title";
import { Navbar } from "./Navbar";
import { PageTitleProvider } from "./PageTitleContext";
import { Sidebar } from "./Sidebar";
import type { SidebarItem } from "./types";

/** Секция настроек и ключ, под которыми лежит состояние сайдбара. */
export const LAYOUT_SECTION = "layout";
const SIDEBAR_KEY = "sidebar";
const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;
const MOBILE_QUERY = "(max-width: 768px)";

interface SidebarState {
  width: number;
  collapsed: boolean;
}

const DEFAULT_SIDEBAR: SidebarState = { width: DEFAULT_WIDTH, collapsed: false };

export interface AppLayoutProps {
  sidebarItems: SidebarItem[];
  appName?: string | undefined;
  logo?: ReactNode | undefined;
  /** Заголовок, когда роут не совпал ни с одним пунктом меню. */
  defaultTitle?: string | undefined;
  /**
   * Прибитый к низу сайдбара блок (переключатель приложений, версия). Функцией — если у блока есть
   * свой компактный вид: в свёрнутом сайдбаре узлу иначе не узнать, что рисовать только иконки.
   */
  sidebarFooter?: ReactNode | ((compact: boolean) => ReactNode) | undefined;
  headerActions?: ReactNode | undefined;
  userEmail?: string | undefined;
  userBadge?: ReactNode | undefined;
  onSignOut?: (() => void) | undefined;
  /** Выбор языка в топбаре, рядом с темой. */
  locales?: LanguageOption[] | undefined;
  locale?: string | undefined;
  onLocaleChange?: ((locale: string) => void) | undefined;
  /** Полоса над контентом на всю ширину (например, баннер просмотра от имени клиента). */
  banner?: ReactNode | undefined;
}

/** Подвал сайдбара: узлом — как есть, функцией — с текущей свёрнутостью (у блока свой компактный вид). */
function renderFooter(footer: AppLayoutProps["sidebarFooter"], compact: boolean): ReactNode {
  return typeof footer === "function" ? footer(compact) : footer;
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

/**
 * Каркас приложения: сайдбар (на мобиле — выдвижной), топбар, прокручиваемый контент с `<Outlet/>`.
 * Ширина и свёрнутость сайдбара живут в настройках пользователя на сервере — переносятся между
 * браузерами и переживают переустановку.
 */
export function AppLayout({
  sidebarItems,
  appName,
  logo,
  defaultTitle = "",
  sidebarFooter,
  headerActions,
  userEmail,
  userBadge,
  onSignOut,
  locales,
  locale,
  onLocaleChange,
  banner,
}: AppLayoutProps) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const labels = useUiLabels();
  const { value: state, setValue: saveState } = useUiSetting<SidebarState>(LAYOUT_SECTION, SIDEBAR_KEY, DEFAULT_SIDEBAR);

  const onWidthCommit = useCallback((width: number) => saveState({ ...state, width }), [saveState, state]);
  const sidebar = useResizable({
    width: state.width ?? DEFAULT_WIDTH,
    onCommit: onWidthCommit,
    defaultWidth: DEFAULT_WIDTH,
    min: MIN_WIDTH,
    max: MAX_WIDTH,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: закрываем ящик на навигации
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const toggleSidebar = useCallback(() => {
    if (isMobile) setDrawerOpen((v) => !v);
    else saveState({ ...state, collapsed: !state.collapsed });
  }, [isMobile, saveState, state]);

  const routeTitle = useMemo(
    () => getPageTitle(location.pathname, sidebarItems, defaultTitle),
    [location.pathname, sidebarItems, defaultTitle],
  );

  const compact = state.collapsed && !isMobile;

  return (
    <div
      className={cn(
        "flex h-screen w-full overflow-hidden bg-background text-foreground",
        sidebar.dragging && "cursor-col-resize select-none",
      )}
    >
      <aside
        className={cn(
          "relative hidden shrink-0 border-r border-border bg-surface p-3 md:block",
          compact ? "w-16" : undefined,
          !sidebar.dragging && "transition-[width] duration-200",
        )}
        style={compact ? undefined : { width: sidebar.width }}
      >
        <Sidebar
          items={sidebarItems}
          compact={compact}
          appName={appName}
          logo={logo}
          footer={renderFooter(sidebarFooter, compact)}
        />
        {!compact && (
          // Ручка на правом крае; двойной клик возвращает дефолтную ширину.
          <button
            type="button"
            aria-label={labels.layout.resizeSidebar}
            tabIndex={-1}
            onPointerDown={sidebar.onPointerDown}
            onDoubleClick={sidebar.reset}
            className="group absolute inset-y-0 right-0 z-20 flex w-2 translate-x-1/2 cursor-col-resize touch-none items-stretch justify-center bg-transparent p-0"
          >
            <span
              className={cn(
                "h-full w-px bg-border transition-colors group-hover:bg-accent",
                sidebar.dragging && "bg-accent",
              )}
            />
          </button>
        )}
      </aside>

      {isMobile && drawerOpen && (
        <>
          <button
            type="button"
            aria-label="close"
            className="fixed inset-0 z-40 bg-backdrop md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-surface p-3 md:hidden">
            <Sidebar
              items={sidebarItems}
              compact={false}
              appName={appName}
              logo={logo}
              footer={renderFooter(sidebarFooter, false)}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </>
      )}

      <PageTitleProvider defaultTitle={routeTitle}>
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            onToggleSidebar={toggleSidebar}
            collapsed={compact}
            actions={headerActions}
            {...(userEmail !== undefined ? { userEmail } : {})}
            {...(userBadge !== undefined ? { userBadge } : {})}
            {...(onSignOut !== undefined ? { onSignOut } : {})}
            {...(locales !== undefined ? { locales } : {})}
            {...(locale !== undefined ? { locale } : {})}
            {...(onLocaleChange !== undefined ? { onLocaleChange } : {})}
          />
          {banner}
          <main className="min-h-0 flex-1 overflow-y-auto bg-background p-4">
            <Outlet />
          </main>
        </div>
      </PageTitleProvider>
    </div>
  );
}
