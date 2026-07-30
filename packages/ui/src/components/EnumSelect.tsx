import { ListBox, Select } from "@heroui/react";
import type { Key } from "react";

export interface EnumOption<T extends string | number> {
  value: T;
  label: string;
}

export interface EnumSelectProps<T extends string | number> {
  value: T;
  options: readonly EnumOption<T>[];
  onChange: (value: T) => void;
  /** Подпись для screen reader'а, если рядом нет видимого лейбла. */
  ariaLabel?: string | undefined;
  placeholder?: string | undefined;
  isDisabled?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Выбор из перечисления. Существует ровно по одной причине: у нативного `<select>` выпадающий список
 * рисует ОС, и `color-scheme` она уважает не везде — на Windows он остаётся светлым посреди тёмной
 * темы. Здесь список — обычный DOM, поэтому выглядит одинаково всюду.
 *
 * Значения наружу отдаются В ИСХОДНОМ ТИПЕ (число остаётся числом): react-aria оперирует строковыми
 * ключами, и без обратного приведения каждый вызывающий писал бы `Number(...)` руками.
 */
export function EnumSelect<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  isDisabled,
  className,
}: EnumSelectProps<T>) {
  const onSelectionChange = (key: Key | null) => {
    if (key === null) return;
    const picked = options.find((o) => String(o.value) === String(key));
    if (picked) onChange(picked.value);
  };

  return (
    <Select
      selectedKey={String(value)}
      onSelectionChange={onSelectionChange}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      {...(isDisabled !== undefined ? { isDisabled } : {})}
      {...(className ? { className } : {})}
    >
      <Select.Trigger>
        <Select.Value>{({ selectedText }) => (selectedText ? selectedText : (placeholder ?? ""))}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={String(o.value)} id={String(o.value)} textValue={o.label}>
              {o.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
