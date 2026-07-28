import { useEffect } from "react";
import { usePageTitleContext } from "./PageTitleContext";

/** Заголовок текущей страницы: без аргумента — дефолт роута. Пишет и в `document.title`, и в топбар. */
export function usePageTitle(title?: string): void {
  const { defaultTitle, setPageTitle } = usePageTitleContext();

  useEffect(() => {
    const final = title || defaultTitle;
    document.title = final;
    setPageTitle(final);
  }, [title, defaultTitle, setPageTitle]);
}
