import { useUiLabels } from "../../provider";
import type { Column, Table } from "@tanstack/react-table";
import { useEffect, useRef } from "react";
import { ICONS, Icon } from "../../icons";

function columnLabel<TData>(c: Column<TData, unknown>): string {
  const h = c.columnDef.header;
  return typeof h === "string" ? h : c.id;
}

/** Видимость колонок. Порядок меняется перетаскиванием заголовка (DraggableHeader). */
export function ColumnsMenu<TData>({
  table,
  label,
  onReset,
}: {
  table: Table<TData>;
  label?: string | undefined;
  onReset?: (() => void) | undefined;
}) {
  const labels = useUiLabels().table;
  const lbl = label ?? labels.columns;
  const ref = useRef<HTMLDetailsElement>(null);

  // Нативный <details> закрывается только по <summary> — добавляем клик мимо и Escape.
  useEffect(() => {
    const close = () => {
      if (ref.current) ref.current.open = false;
    };
    const onPointer = (e: PointerEvent) => {
      const el = ref.current;
      if (el?.open && e.target instanceof Node && !el.contains(e.target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const columns = table.getAllLeafColumns().filter((c) => c.getCanHide());
  if (columns.length === 0) return null;

  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={lbl}
        className="inline-flex size-9 cursor-pointer list-none items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-secondary [&::-webkit-details-marker]:hidden"
      >
        <Icon icon={ICONS.columns} width={18} height={18} aria-hidden />
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-60 rounded-medium border border-border bg-surface p-2 shadow-lg">
        <p className="px-1 pb-1 text-xs font-medium uppercase tracking-wide text-muted">{lbl}</p>
        <ul className="flex max-h-72 flex-col overflow-auto">
          {columns.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-medium px-1 py-1 text-sm text-foreground hover:bg-surface-secondary">
                <input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} />
                <span className="truncate">{columnLabel(c)}</span>
              </label>
            </li>
          ))}
        </ul>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="mt-1 w-full rounded-medium px-1 py-1 text-left text-xs text-muted hover:bg-surface-secondary hover:text-foreground"
          >
            {labels.resetColumns}
          </button>
        )}
      </div>
    </details>
  );
}
