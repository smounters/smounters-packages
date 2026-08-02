import { EnumSelect } from "../EnumSelect";
import { useUiLabels } from "../../provider";
import { ICONS, Icon } from "../../icons";

export interface PaginatorProps {
  offset: number;
  limit: number;
  total: number;
  onOffsetChange: (offset: number) => void;
  /** Есть → рисуем выбор размера страницы. */
  onLimitChange?: ((limit: number) => void) | undefined;
  pageSizes?: number[] | undefined;
}

const ICON_BTN =
  "inline-flex size-8 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-40 disabled:hover:bg-surface outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** Пагинатор таблицы. Серверный: отдаёт наружу новый offset/limit, данные перезапрашивает вызывающий. */
export function Paginator({
  offset,
  limit,
  total,
  onOffsetChange,
  onLimitChange,
  pageSizes = [10, 15, 25, 50, 100],
}: PaginatorProps) {
  const { table } = useUiLabels();
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(pages, Math.floor(offset / limit) + 1);
  const go = (p: number) => onOffsetChange((Math.max(1, Math.min(pages, p)) - 1) * limit);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted">
      <div className="flex items-center gap-2">
        {onLimitChange && (
          <>
            <span>{table.perPage}</span>
            <EnumSelect
              value={limit}
              options={pageSizes.map((n) => ({ value: n, label: String(n) }))}
              onChange={onLimitChange}
              ariaLabel={table.rowsPerPage}
              className="w-20"
            />
          </>
        )}
        <span className="whitespace-nowrap">
          {table.range({ from: total === 0 ? 0 : offset + 1, to: Math.min(offset + limit, total), total })}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button type="button" className={ICON_BTN} onClick={() => go(1)} disabled={page <= 1} aria-label={table.first}>
          <Icon icon={ICONS.chevronLeft} width={14} height={14} />
          <Icon icon={ICONS.chevronLeft} width={14} height={14} className="-ml-2.5" />
        </button>
        <button
          type="button"
          className={ICON_BTN}
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          aria-label={table.prev}
        >
          <Icon icon={ICONS.chevronLeft} width={16} height={16} />
        </button>
        <span className="whitespace-nowrap px-2 text-foreground">
          {page} / {pages}
        </span>
        <button
          type="button"
          className={ICON_BTN}
          onClick={() => go(page + 1)}
          disabled={page >= pages}
          aria-label={table.next}
        >
          <Icon icon={ICONS.chevronRight} width={16} height={16} />
        </button>
        <button
          type="button"
          className={ICON_BTN}
          onClick={() => go(pages)}
          disabled={page >= pages}
          aria-label={table.last}
        >
          <Icon icon={ICONS.chevronRight} width={14} height={14} />
          <Icon icon={ICONS.chevronRight} width={14} height={14} className="-ml-2.5" />
        </button>
      </div>
    </div>
  );
}
