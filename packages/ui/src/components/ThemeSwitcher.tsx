import { Button, ButtonGroup, useTheme } from "@heroui/react";
import { ICONS, Icon } from "../icons";
import { useUiLabels } from "../provider";

type ThemeMode = "light" | "dark" | "system";

export interface ThemeSwitcherLabels {
  light: string;
  dark: string;
  system: string;
}

export interface ThemeSwitcherProps {
  labels?: Partial<ThemeSwitcherLabels>;
  size?: "sm" | "md" | "lg";
  className?: string | undefined;
}

const MODES: ReadonlyArray<{ mode: ThemeMode; icon: string; labelKey: keyof ThemeSwitcherLabels }> = [
  { mode: "light", icon: ICONS.sun, labelKey: "light" },
  { mode: "dark", icon: ICONS.moon, labelKey: "dark" },
  { mode: "system", icon: ICONS.system, labelKey: "system" },
];

/**
 * Светлая / тёмная / системная. Обёртка над `useTheme` HeroUI: он сам хранит выбор и ставит класс и
 * `data-theme` на <html>. Активен именно выбор пользователя, поэтому «Системная» остаётся выбранной,
 * во что бы она ни разрешилась.
 */
export function ThemeSwitcher({ labels, size = "sm", className }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const resolved = { ...useUiLabels().theme, ...labels };

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
            onPress={() => setTheme(mode)}
          >
            <Icon icon={icon} width={18} height={18} aria-hidden />
          </Button>
        );
      })}
    </ButtonGroup>
  );
}
