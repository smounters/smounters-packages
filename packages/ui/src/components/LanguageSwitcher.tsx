import { Dropdown } from "@heroui/react";
import type { Key } from "react";
import { ICONS, Icon } from "../icons";
import { useUiLabels } from "../provider";

export interface LanguageOption {
  /** Код языка (`ru`, `en`). */
  code: string;
  /** Название на самом себе — «Русский», а не «Russian». */
  label: string;
}

export interface LanguageSwitcherProps {
  locales: LanguageOption[];
  locale: string;
  onLocaleChange: (locale: string) => void;
  className?: string;
}

const TRIGGER_CLS =
  "inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-secondary outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** Выбор языка. Список и текущее значение приходят снаружи: где хранится выбор — дело приложения. */
export function LanguageSwitcher({ locales, locale, onLocaleChange, className }: LanguageSwitcherProps) {
  const label = useUiLabels().language.label;

  const onAction = (key: Key) => {
    const next = String(key);
    if (locales.some((l) => l.code === next)) onLocaleChange(next);
  };

  return (
    <Dropdown>
      <Dropdown.Trigger aria-label={label} className={className ? `${TRIGGER_CLS} ${className}` : TRIGGER_CLS}>
        <Icon icon={ICONS.globe} width={18} height={18} aria-hidden />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={label} selectionMode="single" selectedKeys={[locale]} onAction={onAction}>
          {locales.map((l) => (
            <Dropdown.Item key={l.code} id={l.code} textValue={l.label}>
              {l.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
