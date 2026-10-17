import { Input } from "@heroui/react";
import { type KeyboardEvent, type ReactNode, useId, useMemo, useRef, useState } from "react";

export interface SearchSelectOption {
  key: string;
  label: string;
  hint?: string;
  /**
   * Значок слева от подписи: эмодзи, `<img>`, узел иконочного набора — что угодно.
   *
   * Нужен там, где вариантов много и они однородны по форме: список из шести десятков названий
   * читается построчно, а значок даёт глазу зацепку. Подписи он не заменяет и в поиске не участвует.
   */
  icon?: ReactNode;
}

export interface SearchSelectProps {
  value: string;
  onChange: (key: string) => void;
  options: SearchSelectOption[];
  label?: string | undefined;
  placeholder?: string | undefined;
  emptyText?: string | undefined;
  isDisabled?: boolean | undefined;
  /**
   * Поиск идёт на сервере: компонент отдаёт введённый текст наружу и НЕ фильтрует список сам.
   * Нужно там, где вариантов больше, чем разумно выгружать в браузер (организации платформы).
   */
  query?: string | undefined;
  onQueryChange?: ((query: string) => void) | undefined;
  maxVisible?: number | undefined;
}

/**
 * Выбор одного значения с поиском в том же поле.
 *
 * Появился вместо связки «выпадающий список + отдельное поле поиска рядом»: два элемента ради одного
 * выбора выглядят как недоделка, и не сразу понятно, что поле сужает именно этот список, а не таблицу
 * под ним. Здесь набор текста и выбор — одно место.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  label,
  placeholder,
  emptyText = "—",
  isDisabled,
  query,
  onQueryChange,
  maxVisible = 50,
}: SearchSelectProps) {
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const serverSide = onQueryChange !== undefined;
  const text = serverSide ? (query ?? "") : typed;
  const setText = (v: string) => (serverSide ? onQueryChange?.(v) : setTyped(v));

  const selected = options.find((o) => o.key === value);
  const matches = useMemo(() => {
    const q = fold(text);
    // При серверном поиске список уже отфильтрован — фильтровать второй раз значит прятать то, что
    // сервер намеренно вернул (например совпадение по полю, которого нет в подписи).
    const list = serverSide || !q ? options : options.filter((o) => fold(o.label).includes(q));
    return list.slice(0, maxVisible);
  }, [options, text, serverSide, maxVisible]);

  /**
   * Место под значок резервируется, как только его подал ХОТЬ ОДИН вариант.
   *
   * Иначе отступ появлялся бы вместе с выбором и текст в поле прыгал бы вбок на каждый выбор — и
   * ещё раз назад при открытии списка, где значка нет.
   */
  // Boolean(...) обязателен: ReactNode в типах React 19 включает Promise, и предикат, возвращающий
  // сам узел, линтер справедливо считает возвратом промиса из синхронного колбэка.
  const hasIcons = options.some((o) => Boolean(o.icon));

  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
    if (serverSide) onQueryChange?.("");
    else setTyped("");
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && matches[0]) {
      e.preventDefault();
      pick(matches[0].key);
      return;
    }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-muted text-xs">{label}</span>}
      <div className="relative">
        {/*
          Значок выбранного варианта кладётся ПОВЕРХ поля, а не внутрь него: значение `<input>` —
          строка, узел туда не положить ничем. Пока список открыт, значок убран: в поле тогда не
          выбранное, а набранный запрос, и старая иконка рядом с ним врала бы.
        */}
        {hasIcons && !open && selected?.icon && (
          <span
            aria-hidden
            className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 flex size-5 items-center justify-center"
          >
            {selected.icon}
          </span>
        )}
        {/* Отступ справа под стрелку: без него длинное название организации уезжает прямо под значок. */}
        <Input
          ref={inputRef}
          fullWidth
          className={hasIcons ? "pr-9 pl-10" : "pr-9"}
          aria-label={label ?? ""}
          aria-controls={listId}
          aria-expanded={open}
          value={open ? text : (selected?.label ?? "")}
          disabled={isDisabled ?? false}
          placeholder={placeholder ?? ""}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setText("");
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {/* Стрелка встроенной SVG, а не из иконочного набора: пакет не должен тянуть чужой набор и уж тем
            более ходить за значком в сеть. Поворачивается при раскрытии — неподвижная не отличает
            открытый список от закрытого. */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {open && (
          <ul
            id={listId}
            className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-medium border border-border bg-surface py-1 shadow-medium"
          >
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-muted text-sm">{emptyText}</li>
            ) : (
              matches.map((o) => (
                <li key={o.key}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-secondary ${
                      o.key === value ? "text-accent" : "text-foreground"
                    }`}
                    // onMouseDown: onBlur поля гасит список раньше, чем сработал бы onClick.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(o.key);
                    }}
                  >
                    {/* Пустая ячейка у варианта без значка — иначе подписи в списке разъезжаются. */}
                    {hasIcons && (
                      <span aria-hidden className="flex size-5 shrink-0 items-center justify-center">
                        {o.icon}
                      </span>
                    )}
                    <span className="truncate">{o.label}</span>
                    {o.hint && <span className="ml-auto shrink-0 text-muted text-xs">{o.hint}</span>}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Приведение к виду, по которому сравниваем: регистр и диакритика снимаются.
 *
 * Без снятия диакритики поиск не находит ровно то, что чаще всего ищут с телефона: «plomeria» не
 * совпадает с «Plomería», «Jose» — с «José». Набирать ударения на мобильной клавиатуре никто не
 * будет, а совпадений от этого становится только больше — ни один прежний результат не пропадает.
 */
function fold(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
