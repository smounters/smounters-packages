import { Dropdown } from "@heroui/react";
import type { Key, ReactNode } from "react";
import { type LanguageOption, LanguageSwitcher } from "../components/LanguageSwitcher";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { ICONS, Icon } from "../icons";
import { useUiLabels } from "../provider";
import { usePageTitleContext } from "./PageTitleContext";

export interface NavbarProps {
  onToggleSidebar: () => void;
  collapsed: boolean;
  /** Что показать в меню аккаунта; без него меню не рисуется. */
  userEmail?: string | undefined;
  /** Метка рядом с почтой в меню аккаунта (роль, тариф). */
  userBadge?: ReactNode | undefined;
  onSignOut?: (() => void) | undefined;
  /** Место под специфику приложения (например, статус бота). */
  actions?: ReactNode | undefined;
  /** Переключатель языка рядом с темой. Без списка языков не рисуется. */
  locales?: LanguageOption[] | undefined;
  locale?: string | undefined;
  onLocaleChange?: ((locale: string) => void) | undefined;
}

const ICON_BTN =
  "inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-secondary outline-none focus-visible:ring-2 focus-visible:ring-focus";

export function Navbar({
  onToggleSidebar,
  collapsed,
  userEmail,
  userBadge,
  onSignOut,
  actions,
  locales,
  locale,
  onLocaleChange,
}: NavbarProps) {
  const labels = useUiLabels();
  const { pageTitle } = usePageTitleContext();

  const onUserAction = (key: Key) => {
    if (key === "signOut") onSignOut?.();
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={collapsed ? labels.layout.expandSidebar : labels.layout.collapseSidebar}
        className={ICON_BTN}
      >
        <Icon icon={ICONS.menu} width={20} height={20} aria-hidden />
      </button>

      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">{pageTitle}</h1>

      <div className="flex items-center gap-2">
        {actions}
        {locales && locales.length > 0 && locale && onLocaleChange && (
          <LanguageSwitcher locales={locales} locale={locale} onLocaleChange={onLocaleChange} />
        )}
        <ThemeSwitcher />

        {userEmail && (
          <Dropdown>
            <Dropdown.Trigger aria-label={labels.layout.userMenu} className={ICON_BTN}>
              <Icon icon={ICONS.user} width={22} height={22} aria-hidden />
            </Dropdown.Trigger>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu aria-label={labels.layout.userMenu} onAction={onUserAction}>
                <Dropdown.Item id="email" isDisabled textValue={userEmail}>
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm text-muted">{userEmail}</span>
                    {userBadge}
                  </span>
                </Dropdown.Item>
                <Dropdown.Item id="signOut" textValue={labels.actions.signOut}>
                  <span className="flex items-center gap-2">
                    <Icon icon={ICONS.logout} width={18} height={18} aria-hidden />
                    {labels.actions.signOut}
                  </span>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}
      </div>
    </header>
  );
}
