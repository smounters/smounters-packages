import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";

export interface UseResizableOptions {
  /** Сохранённая ширина (px). */
  width: number;
  /** Вызывается ОДИН раз на отпускании: пишем в настройки результат, а не каждый кадр перетаскивания. */
  onCommit: (width: number) => void;
  defaultWidth: number;
  min: number;
  max: number;
  /** Ручка слева растёт при движении курсора влево. По умолчанию — правая. */
  edge?: "left" | "right";
}

export interface Resizable {
  width: number;
  dragging: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
  /** Сброс к дефолту — вешать на двойной клик по ручке. */
  reset: () => void;
}

/** Перетаскивание за край. Указатель слушаем на window: курсор уходит с тонкой ручки на первом же пикселе. */
export function useResizable({ width, onCommit, defaultWidth, min, max, edge = "right" }: UseResizableOptions): Resizable {
  const clamp = useCallback((w: number) => Math.min(max, Math.max(min, w)), [min, max]);
  const [dragged, setDragged] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const current = clamp(dragged ?? width);
  const currentRef = useRef(current);
  currentRef.current = current;

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = currentRef.current;
      const sign = edge === "left" ? -1 : 1;
      setDragging(true);

      const onMove = (ev: PointerEvent) => {
        const next = clamp(startWidth + sign * (ev.clientX - startX));
        if (frame.current != null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => setDragged(next));
      };
      const onUp = () => {
        setDragging(false);
        setDragged(null);
        onCommit(currentRef.current);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [clamp, edge, onCommit],
  );

  const reset = useCallback(() => {
    setDragged(null);
    onCommit(defaultWidth);
  }, [defaultWidth, onCommit]);

  return { width: current, dragging, onPointerDown, reset };
}
