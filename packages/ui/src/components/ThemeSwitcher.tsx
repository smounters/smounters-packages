import { Button, ButtonGroup, Dropdown, useTheme } from "@heroui/react";
import { ICONS, Icon } from "../icons";
import { useUiLabels, useUiThemeChange } from "../provider";

type ThemeMode = "light" | "dark" | "system";

export interface ThemeSwitcherLabels {
  light: string;
  dark: string;
  system: string;
}

export interface ThemeSwitcherProps {
  labels?: Partial<ThemeSwitcherLabels>;
  size?: "sm" | "md" | "lg";
  /**
   * `group` (по умолчанию) — сегментированный переключатель из трёх кнопок; `menu` — одна круглая
   * иконка с выпадающим списком. Второй вариант для узких мест: в мобильной шапке три сегмента не
   * помещаются.
   */
  variant?: "group" | "menu";
  className?: string | undefined;
}

const TRIGGER_CLS =
  "inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-secondary outline-none focus-visible:ring-2 focus-visible:ring-focus";

const MODES: readonly { mode: ThemeMode; icon: string; labelKey: keyof ThemeSwitcherLabels }[] = [
  { mode: "light", icon: ICONS.sun, labelKey: "light" },
  { mode: "dark", icon: ICONS.moon, labelKey: "dark" },
  { mode: "system", icon: ICONS.system, labelKey: "system" },
];

/**
 * Светлая / тёмная / системная. Обёртка над `useTheme` HeroUI: он сам хранит выбор и ставит класс и
 * `data-theme` на <html>. Активен именно выбор пользователя, поэтому «Системная» остаётся выбранной,
 * во что бы она ни разрешилась.
 *
 * Хранение HeroUI — per-origin (localStorage). Если продукт разложен по поддоменам и тему надо
 * переносить между ними, приложение передаёт `onThemeChange` в `<UiProvider>` и пишет там свою куку;
 * этот компонент вызовет его после каждой смены — в том числе когда его рисует не приложение, а
 * `Navbar` внутри каркаса.
 */
export function ThemeSwitcher({ labels, size = "sm", variant = "group", className }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const resolved = { ...useUiLabels().theme, ...labels };
  const onThemeChange = useUiThemeChange();

  const select = (mode: ThemeMode) => {
    onThemeChange?.(mode);
    setTheme(mode);
  };

  if (variant === "menu") {
    const activeIcon = MODES.find((m) => m.mode === theme)?.icon ?? ICONS.system;
    return (
      <Dropdown>
        <Dropdown.Trigger aria-label="Theme" className={className ? `${TRIGGER_CLS} ${className}` : TRIGGER_CLS}>
          <Icon icon={activeIcon} width={18} height={18} aria-hidden />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            aria-label="Theme"
            selectionMode="single"
            selectedKeys={theme ? [theme] : []}
            onAction={(k) => select(String(k) as ThemeMode)}
          >
            {MODES.map(({ mode, icon, labelKey }) => (
              <Dropdown.Item key={mode} id={mode} textValue={resolved[labelKey]}>
                <span className="flex items-center gap-2">
                  <Icon icon={icon} width={16} height={16} aria-hidden />
                  {resolved[labelKey]}
                </span>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    );
  }

  return (
    <ButtonGroup size={size} variant="outline" {...(className ? { className } : {})} aria-label="Theme">
      {MODES.map(({ mode, icon, labelKey }) => {
        const isActive = theme === mode;
        return (
          <Button
            key={mode}
            isIconOnly
            variant={isActive ? "primary" : "outline"}
            aria-label={resolved[labelKey]}
            aria-pressed={isActive}
            onPress={() => select(mode)}
          >
            <Icon icon={icon} width={18} height={18} aria-hidden />
          </Button>
        );
      })}
    </ButtonGroup>
  );
}
