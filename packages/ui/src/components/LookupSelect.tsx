import { EnumSelect } from "./EnumSelect";

export interface LookupSelectProps<T> {
  value: string;
  onChange: (value: string) => void;
  /** Строки из запроса. undefined на время загрузки — список пуст, поле остаётся доступным. */
  items: readonly T[] | undefined;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  /** Первый пункт «ничего не выбрано». Пусто — пункта нет, значение обязательно. */
  placeholder?: string | undefined;
  isDisabled?: boolean | undefined;
  ariaLabel?: string | undefined;
  className?: string | undefined;
}

/**
 * Выбор ССЫЛКИ на другую запись (проект, оффер, склад) — список приезжает запросом, в отличие от
 * EnumSelect, где варианты известны в коде. Пустой ключ означает «не выбрано»: именно так эти поля
 * лежат в формах, поэтому placeholder — обычный пункт списка, а не отдельное состояние.
 */
export function LookupSelect<T>({
  value,
  onChange,
  items,
  getKey,
  getLabel,
  placeholder,
  isDisabled,
  ariaLabel,
  className,
}: LookupSelectProps<T>) {
  const options = [
    ...(placeholder ? [{ value: "", label: placeholder }] : []),
    ...(items ?? []).map((it) => ({ value: getKey(it), label: getLabel(it) })),
  ];
  return (
    <EnumSelect
      value={value}
      options={options}
      onChange={onChange}
      isDisabled={isDisabled}
      ariaLabel={ariaLabel}
      className={className}
    />
  );
}
