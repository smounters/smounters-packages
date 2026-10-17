/** Контракт навигации: приложение отдаёт уже переведённые пункты, сам layout доменно-независим. */
export interface SidebarItem {
  key: string;
  title: string;
  /** Путь роута; у группирующего пункта отсутствует. */
  href?: string | undefined;
  /** Идентификатор иконки (обычно `ICONS.*`). */
  icon?: string | undefined;
  items?: SidebarItem[] | undefined;
}
