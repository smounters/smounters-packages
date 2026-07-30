import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { Button } from "@heroui/react";
import {
  type ColumnDef,
  type ColumnSizingInfoState,
  type ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  type Updater,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useUiLabels, useUiSetting } from "../../provider";
import { ICONS, Icon } from "../../icons";
import { ColumnsMenu } from "./ColumnsMenu";
import { DraggableCell } from "./DraggableCell";
import { DraggableHeader } from "./DraggableHeader";
import { Paginator } from "./Paginator";

/** Секция настроек, в которой лежит состояние колонок; ключ — `code` таблицы. */
export const TABLE_COLUMNS_SECTION = "table-columns";

interface ColumnState {
  order: string[];
  hidden: string[];
  sorting: { id: string; desc: boolean }[];
  /** Ширины колонок в px; отсутствующая колонка — на дефолте. */
  sizes: Record<string, number>;
}

const EMPTY_STATE: ColumnState = { order: [], hidden: [], sorting: [], sizes: {} };

export interface DataTableProps<TData> {
  /** Стабильный код таблицы — ключ, под которым хранятся настройки колонок (например "trades.list"). */
  code: string;
  // biome-ignore lint/suspicious/noExplicitAny: тип значения у каждой колонки свой, таблице он безразличен
  columns: ColumnDef<TData, any>[];
  data: TData[];
  getRowId?: ((row: TData) => string) | undefined;
  /**
   * Выделение строк: рисует ведущую колонку с галочками и сообщает наружу id выбранных строк (по
   * `getRowId`, поэтому **без него не работает**). Выделение живёт в пределах страницы: сбрасывается
   * на новых данных (другая страница, фильтр, перезапрос), чтобы массовое действие никогда не
   * применилось к строкам, которых пользователь больше не видит.
   */
  enableSelection?: boolean | undefined;
  onSelectionChange?: ((ids: string[]) => void) | undefined;
  /** Увеличить число, чтобы снять выделение снаружи (например кнопкой «сбросить»). */
  selectionResetSignal?: number | undefined;
  isLoading?: boolean | undefined;
  /** Запрос упал — показываем строку ошибки, а не (вводящую в заблуждение) пустоту. */
  error?: unknown | undefined;
  emptyText?: string | undefined;
  title?: string | undefined;
  toolbar?: ReactNode | undefined;
  onRowClick?: ((row: TData) => void) | undefined;
  onRowEdit?: ((row: TData) => void) | undefined;
  onRowDelete?: ((row: TData) => void) | undefined;
  editLabel?: string | undefined;
  deleteLabel?: string | undefined;
  /** Сортировка на сервере: таблица не сортирует строки сама, а сообщает изменение наружу. */
  manualSorting?: boolean | undefined;
  onServerSort?: ((sort: { id: string; desc: boolean } | null) => void) | undefined;
  pagination?: {
    offset: number;
    limit: number;
    total: number;
    onOffsetChange: (offset: number) => void;
    onLimitChange?: ((limit: number) => void) | undefined;
  };
}

const resolve = <T,>(u: Updater<T>, prev: T): T => (typeof u === "function" ? (u as (p: T) => T)(prev) : u);

// Сохранённый порядок + новые колонки в конце: добавленная в код колонка не должна пропадать у тех,
// у кого порядок уже сохранён.
function mergeOrder(saved: string[], all: string[]): string[] {
  if (!saved.length) return all;
  const set = new Set(saved);
  return [...saved.filter((k) => all.includes(k)), ...all.filter((k) => !set.has(k))];
}

const TH = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted";
const TD = "px-3 py-2 text-sm text-foreground";

/**
 * Таблица проекта: движок TanStack Table + перетаскивание колонок (dnd-kit) + меню видимости +
 * ресайз колонок. Порядок, видимость, ширины и сортировка сохраняются per-user на сервере по `code`.
 */
export function DataTable<TData>({
  code,
  columns,
  data,
  getRowId,
  enableSelection,
  onSelectionChange,
  selectionResetSignal,
  isLoading,
  error,
  emptyText,
  title,
  toolbar,
  onRowClick,
  onRowEdit,
  onRowDelete,
  editLabel,
  deleteLabel,
  manualSorting,
  onServerSort,
  pagination,
}: DataTableProps<TData>) {
  const labels = useUiLabels();
  const empty = emptyText ?? labels.table.empty;
  const edit = editLabel ?? labels.actions.edit;
  const del = deleteLabel ?? labels.actions.delete;
  const allKeys = useMemo(() => columns.map((c) => c.id as string), [columns]);
  const { value: state, setValue: save } = useUiSetting<ColumnState>(TABLE_COLUMNS_SECTION, code, EMPTY_STATE);

  const columnOrder = useMemo(() => mergeOrder(state.order ?? [], allKeys), [state.order, allKeys]);
  const columnVisibility = useMemo<VisibilityState>(
    () => Object.fromEntries((state.hidden ?? []).map((k) => [k, false])),
    [state.hidden],
  );
  const sorting = (state.sorting ?? []) as SortingState;
  const hasActions = Boolean(onRowEdit || onRowDelete);

  // Ширины держим локально, пока тянут ручку: писать настройку на каждый кадр — это запрос в секунду
  // на пиксель. На сервер уходит результат, когда ручку отпустили.
  const [sizing, setSizing] = useState<ColumnSizingState>(() => state.sizes ?? {});
  const sizesKey = JSON.stringify(state.sizes ?? {});
  // biome-ignore lint/correctness/useExhaustiveDependencies: sizesKey — стабильная проекция state.sizes
  useEffect(() => {
    setSizing(JSON.parse(sizesKey) as ColumnSizingState);
  }, [sizesKey]);

  // Выделение — состояние страницы, а не пользователя: в настройки не пишется.
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable<TData>({
    data,
    columns,
    ...(getRowId ? { getRowId } : {}),
    state: { columnOrder, columnVisibility, sorting, columnSizing: sizing, rowSelection },
    enableRowSelection: !!enableSelection,
    onRowSelectionChange: setRowSelection,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    onColumnOrderChange: (u) => save({ ...state, order: resolve(u, columnOrder) }),
    onColumnVisibilityChange: (u) => {
      const v = resolve(u, columnVisibility);
      save({ ...state, order: columnOrder, hidden: allKeys.filter((k) => v[k] === false) });
    },
    onSortingChange: (u) => save({ ...state, order: columnOrder, sorting: resolve(u, sorting) }),
    onColumnSizingChange: (u) => setSizing((prev) => resolve(u, prev)),
    onColumnSizingInfoChange: (u) => {
      const info = resolve(u, table.getState().columnSizingInfo) as ColumnSizingInfoState;
      // Ручку отпустили → фиксируем ширины в настройках.
      if (!info.isResizingColumn && table.getState().columnSizingInfo.isResizingColumn) {
        save({ ...state, order: columnOrder, sizes: sizing });
      }
      table.setState((s) => ({ ...s, columnSizingInfo: info }));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: manualSorting ?? false,
    enableSortingRemoval: true,
    sortDescFirst: false,
  });

  // Новые данные (страница/фильтр/перезапрос) или сигнал снаружи → выделение снимается: массовое
  // действие не должно применяться к строкам, которых на экране уже нет.
  // biome-ignore lint/correctness/useExhaustiveDependencies: data и selectionResetSignal — триггеры сброса, в теле не читаются
  useEffect(() => {
    if (enableSelection) setRowSelection({});
  }, [data, enableSelection, selectionResetSignal]);

  // Сообщаем наружу id выбранных строк. onSelectionChange читаем через ref, чтобы зависеть только от
  // самого выделения: незамемоизированная функция родителя иначе даёт цикл (новый массив id →
  // setState у родителя → новая функция → эффект снова).
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const selectedKey = Object.keys(rowSelection)
    .filter((k) => rowSelection[k])
    .join(",");
  useEffect(() => {
    if (enableSelection) onSelectionChangeRef.current?.(selectedKey ? selectedKey.split(",") : []);
  }, [enableSelection, selectedKey]);

  // Серверная сортировка: сообщаем текущую наружу — на монтировании (когда подтянулась сохранённая) и
  // на каждой смене.
  const sortKey = sorting[0] ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}` : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: sortKey — стабильная проекция sorting[0]
  useEffect(() => {
    if (!manualSorting) return;
    const s = sorting[0];
    onServerSort?.(s ? { id: s.id, desc: !!s.desc } : null);
  }, [manualSorting, onServerSort, sortKey]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = columnOrder.indexOf(active.id as string);
    const to = columnOrder.indexOf(over.id as string);
    if (from < 0 || to < 0) return;
    const next = [...columnOrder];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    save({ ...state, order: next });
  };

  const colCount = table.getVisibleLeafColumns().length + (hasActions ? 1 : 0) + (enableSelection ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          <ColumnsMenu table={table} onReset={() => save(EMPTY_STATE)} />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={onDragEnd}
      >
        <div className="overflow-x-auto rounded-large border border-border bg-surface">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-border border-b">
                {/* Колонка выделения — вне SortableContext: её не перетаскивают и не прячут. */}
                {enableSelection && (
                  <th className={`${TH} w-10`}>
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-accent align-middle"
                      aria-label={labels.table.selectAll}
                      checked={table.getIsAllPageRowsSelected()}
                      ref={(el) => {
                        if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
                      }}
                      onChange={table.getToggleAllPageRowsSelectedHandler()}
                    />
                  </th>
                )}
                <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                  {table.getHeaderGroups()[0]?.headers.map((h) => (
                    <DraggableHeader key={h.id} header={h} />
                  ))}
                </SortableContext>
                {hasActions && <th className={TH} />}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className={`${TD} text-muted`} colSpan={colCount}>
                    {labels.table.loading}
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td className={`${TD} text-danger`} colSpan={colCount}>
                    {labels.table.loadError(
                      error instanceof Error ? error.message : labels.table.loadErrorFallback,
                    )}
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td className={`${TD} text-muted`} colSpan={colCount}>
                    {empty}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-border border-b last:border-0 hover:bg-surface-secondary ${onRowClick ? "cursor-pointer" : ""} ${row.getIsSelected() ? "bg-surface-secondary" : ""}`}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    role={onRowClick ? "button" : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onRowClick(row.original);
                            }
                          }
                        : undefined
                    }
                  >
                    {enableSelection && (
                      // biome-ignore lint/a11y/useKeyWithClickEvents: гасит всплытие клика по строке, сама галочка — настоящий контрол
                      <td className={`${TD} w-10`} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="size-4 cursor-pointer accent-accent align-middle"
                          aria-label={labels.table.selectRow}
                          checked={row.getIsSelected()}
                          disabled={!row.getCanSelect()}
                          onChange={row.getToggleSelectedHandler()}
                        />
                      </td>
                    )}
                    <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                      {row.getVisibleCells().map((cell) => (
                        <DraggableCell key={cell.id} columnId={cell.column.id} {...(sizing[cell.column.id] ? { width: sizing[cell.column.id] } : {})}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </DraggableCell>
                      ))}
                    </SortableContext>
                    {hasActions && (
                      // biome-ignore lint/a11y/useKeyWithClickEvents: гасит всплытие клика по строке, сами действия — кнопки
                      <td className={`${TD} whitespace-nowrap text-right`} onClick={(e) => e.stopPropagation()}>
                        {onRowEdit && (
                          <Button size="sm" variant="ghost" onPress={() => onRowEdit(row.original)} aria-label={edit}>
                            <Icon icon={ICONS.settings} width={16} height={16} />
                          </Button>
                        )}
                        {onRowDelete && (
                          <Button
                            size="sm"
                            variant="danger-soft"
                            onPress={() => onRowDelete(row.original)}
                            aria-label={del}
                          >
                            <Icon icon={ICONS.delete} width={16} height={16} />
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DndContext>

      {pagination && (
        <Paginator
          offset={pagination.offset}
          limit={pagination.limit}
          total={pagination.total}
          onOffsetChange={pagination.onOffsetChange}
          {...(pagination.onLimitChange ? { onLimitChange: pagination.onLimitChange } : {})}
        />
      )}
    </div>
  );
}
