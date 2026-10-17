import { useEffect } from "react";
import { usePageTitleContext } from "./PageTitleContext";

/** Заголовок текущей страницы: без аргумента — дефолт роута. Пишет и в `document.title`, и в топбар. */
export function usePageTitle(title?: string): void {
  const { defaultTitle, setPageTitle } = usePageTitleContext();

  useEffect(() => {
    // Именно проверка на ПУСТОТУ, а не `??`: экран, передавший "" (например пока грузится название
    // записи), должен получить заголовок роута, а не пустую вкладку.
    const final = title !== undefined && title !== "" ? title : defaultTitle;
    document.title = final;
    setPageTitle(final);
  }, [title, defaultTitle, setPageTitle]);
}
