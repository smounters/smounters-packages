import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties, ReactNode } from "react";

const TD = "px-3 py-2 text-sm text-foreground";

/** Ячейка едет за своей колонкой: тот же id в общем SortableContext, что и у заголовка. */
export function DraggableCell({
  columnId,
  width,
  className,
  children,
}: {
  columnId: string;
  width?: number | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  const { isDragging, setNodeRef, transform } = useSortable({ id: columnId });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
    width,
  };
  return (
    <td ref={setNodeRef} style={style} className={`${TD} ${className ?? ""}`}>
      {children}
    </td>
  );
}
