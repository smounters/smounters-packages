import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export interface PageTitleContextValue {
  pageTitle: string;
  setPageTitle: (title: string) => void;
  /** Заголовок, выведенный из роута (совпадение по сайдбару или дефолт приложения). */
  defaultTitle: string;
}

const PageTitleContext = createContext<PageTitleContextValue | undefined>(undefined);

export interface PageTitleProviderProps {
  children: ReactNode;
  defaultTitle: string;
}

export function PageTitleProvider({ children, defaultTitle }: PageTitleProviderProps) {
  const [custom, setCustom] = useState<string | null>(null);

  // Сменился роут → снимаем заголовок, поставленный прошлой страницей.
  // biome-ignore lint/correctness/useExhaustiveDependencies: сброс завязан только на defaultTitle
  useEffect(() => {
    setCustom(null);
  }, [defaultTitle]);

  const value = useMemo<PageTitleContextValue>(
    () => ({ pageTitle: custom ?? defaultTitle, setPageTitle: setCustom, defaultTitle }),
    [custom, defaultTitle],
  );

  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>;
}

export function usePageTitleContext(): PageTitleContextValue {
  const ctx = useContext(PageTitleContext);
  if (!ctx) throw new Error("usePageTitleContext must be used within <PageTitleProvider>");
  return ctx;
}
