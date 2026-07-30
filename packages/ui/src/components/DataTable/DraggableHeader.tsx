import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useUiLabels } from "../../provider";
import { flexRender, type Header } from "@tanstack/react-table";
import type { CSSProperties } from "react";

const TH = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted";

/** Заголовок колонки: ручка «⠿» тащит колонку (dnd-kit), клик по подписи переключает сортировку. */
export function DraggableHeader<TData>({ header }: { header: Header<TData, unknown> }) {
  const { table } = useUiLabels();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.column.id,
  });
  const sorted = header.column.getIsSorted();
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: "relative",
    zIndex: isDragging ? 1 : 0,
    width: header.getSize() === Number.MAX_SAFE_INTEGER ? undefined : header.getSize(),
  };

  return (
    <th ref={setNodeRef} style={style} className={TH} {...attributes}>
      <div className="flex select-none items-center gap-1">
        <span
          {...listeners}
          title={table.dragColumn}
          className="shrink-0 cursor-grab text-muted/50 hover:text-muted active:cursor-grabbing"
        >
          ⠿
        </span>
        {header.column.getCanSort() ? (
          <button
            type="button"
            onClick={header.column.getToggleSortingHandler()}
            className="flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground"
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
            <span className="text-[10px] leading-none">{sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "↕"}</span>
          </button>
        ) : (
          <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
        )}
      </div>
      {header.column.getCanResize() && (
        // Ручка ширины: тянется мышью, двойной клик возвращает исходную, ширина уезжает в настройки.
        // Оформление такое же, как у ручек сайдбара и правой панели: широкая невидимая зона захвата, а
        // видна ЛИНИЯ в один пиксель, подсвечивающаяся акцентом. Подсвечивать всю полосу нельзя — на
        // фоне тонких границ таблицы это выглядит грубо.
        <button
          type="button"
          aria-label={table.resizeColumn}
          tabIndex={-1}
          onDoubleClick={() => header.column.resetSize()}
          onPointerDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className="group absolute inset-y-0 right-0 z-10 flex w-2 translate-x-1/2 cursor-col-resize touch-none items-stretch justify-center bg-transparent p-0"
        >
          <span
            className={`h-full w-px transition-colors ${
              header.column.getIsResizing() ? "bg-accent" : "bg-transparent group-hover:bg-accent"
            }`}
          />
        </button>
      )}
    </th>
  );
}
