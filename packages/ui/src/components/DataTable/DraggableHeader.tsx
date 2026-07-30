import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { flexRender, type Header } from "@tanstack/react-table";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useUiLabels } from "../../provider";

const TH = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted";

/**
 * Заголовок колонки: ручка «⠿» тащит колонку (dnd-kit), клик по подписи переключает сортировку, правый
 * край тянет ширину.
 *
 * `width` приходит СНАРУЖИ и только для колонок, которые пользователь ДЕЙСТВИТЕЛЬНО потянул. Брать
 * `header.getSize()` нельзя: при включённом ресайзе TanStack отдаёт для неразмеченной колонки свои
 * 150px, и таблица переставала растягиваться — семь колонок жались в 1050px, а остальная ширина экрана
 * оставалась пустой. Без ширины раскладку делает браузер, как и до появления ресайза.
 */
export function DraggableHeader<TData>({
  header,
  width,
  onResetWidth,
}: {
  header: Header<TData, unknown>;
  width?: number | undefined;
  /** Двойной клик по ручке: сбросить ширину. Нужен отдельно — `resetSize()` знает только про состояние
   *  таблицы, а сохранённую настройку пользователя надо убрать, иначе перезагрузка её вернёт. */
  onResetWidth?: ((columnId: string) => void) | undefined;
}) {
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
    width,
  };

  // Тянуть начинаем от ФАКТИЧЕСКОЙ ширины: у неразмеченной колонки TanStack считает её равной своим
  // 150px, и первое движение мышью схлопывало бы широкую колонку до этого значения. Здесь мы сначала
  // фиксируем то, что видно на экране, и только потом отдаём управление ресайзу.
  const startResize = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (width === undefined) {
      const th = (e.currentTarget as HTMLElement).closest("th");
      const measured = th ? Math.round(th.getBoundingClientRect().width) : undefined;
      if (measured) {
        header.getContext().table.setColumnSizing((prev) => ({ ...prev, [header.column.id]: measured }));
      }
    }
    header.getResizeHandler()(e);
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
          onDoubleClick={() => {
            header.column.resetSize();
            onResetWidth?.(header.column.id);
          }}
          onPointerDown={startResize}
          onTouchStart={header.getResizeHandler()}
          // Зона захвата ЦЕЛИКОМ внутри своего заголовка (без translate), а линия прижата к правому
          // краю — она и есть граница колонок. С вынесенной наружу половиной та часть перекрывалась
          // СОСЕДНИМ заголовком: каждый `th` позиционирован, то есть образует свой контекст наложения,
          // и `z-10` внутри него не перебивает следующий по документу элемент. Схватить можно было
          // только внутренние 4px из 8.
          className="group absolute inset-y-0 right-0 z-10 flex w-2 cursor-col-resize touch-none items-stretch justify-end bg-transparent p-0"
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
