import type { SidebarItem } from "./types";

function findExactTitle(items: SidebarItem[], pathname: string): string {
  for (const item of items) {
    if (item.href === pathname) return item.title;
    if (item.items) {
      const nested = findExactTitle(item.items, pathname);
      if (nested) return nested;
    }
  }
  return "";
}

/**
 * Заголовок страницы по пути: точное совпадение с пунктом меню → самый длинный префикс (чтобы
 * `/trades/42` дал «Сделки») → фолбэк.
 */
export function getPageTitle(pathname: string, items: SidebarItem[], fallback = ""): string {
  const exact = findExactTitle(items, pathname);
  if (exact) return exact;

  const segments = pathname.split("/").filter(Boolean);
  for (let i = segments.length - 1; i > 0; i--) {
    const partial = `/${segments.slice(0, i).join("/")}`;
    const match = findExactTitle(items, partial);
    if (match) return match;
  }

  return fallback;
}
