import { Button } from "@heroui/react";
import { useUiLabels } from "../provider";
import {
  type FormEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { ICONS, Icon } from "../icons";

// Ширина правой панели — одна на все формы, тянется за левый край.
//
// Ключ НЕЙТРАЛЬНЫЙ: до 2.1.0 здесь стоял `trading:drawerWidth` — префикс одного конкретного
// приложения, случайно уехавший в общий пакет. Хранилище тут localStorage, а не настройки
// пользователя: ширину надо знать в первом же кадре, иначе панель откроется дефолтной и дёрнется,
// пока летит запрос.
const DRAWER_WIDTH_KEY = "ui:drawerWidth";
const DRAWER_MIN_WIDTH = 360;
const DRAWER_DEFAULT_WIDTH = 448;

function readDrawerWidth(): number {
  const v = Number(window.localStorage.getItem(DRAWER_WIDTH_KEY));
  return v >= DRAWER_MIN_WIDTH ? v : DRAWER_DEFAULT_WIDTH;
}

/** Общий класс для нативных <select>: у HeroUI Select слишком тяжёлый API для простых перечислений. */
export const SELECT_CLASS =
  "app-select appearance-none rounded-medium border border-border bg-surface py-2 pl-3 pr-9 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** Строка формы. Именно <div>, а не <label>: контрол внутри произвольный и несёт доступность сам. */
export function Field({ label, hint, children }: { label: string; hint?: string | undefined; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
      {hint && <span className="text-muted text-xs">{hint}</span>}
    </div>
  );
}

export interface FormDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  busy?: boolean | undefined;
  submitDisabled?: boolean | undefined;
  submitLabel?: string | undefined;
  cancelLabel?: string | undefined;
  error?: string | null | undefined;
  children: ReactNode;
}

/** Правая выезжающая панель под создание/редактирование. Внутри настоящая <form> — Enter отправляет. */
export function FormDrawer({
  open,
  title,
  onClose,
  onSubmit,
  busy,
  submitDisabled,
  submitLabel,
  cancelLabel,
  error,
  children,
}: FormDrawerProps) {
  const { actions } = useUiLabels();
  const [width, setWidth] = useState(readDrawerWidth);
  const widthRef = useRef(width);
  widthRef.current = width;

  const startResize = useCallback((e: ReactPointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMove = (ev: PointerEvent) => {
      const max = Math.min(window.innerWidth - 40, 1400);
      setWidth(Math.max(DRAWER_MIN_WIDTH, Math.min(max, startW + (startX - ev.clientX))));
    };
    const onUp = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.localStorage.setItem(DRAWER_WIDTH_KEY, String(widthRef.current));
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  if (!open) return null;
  const submit = submitLabel ?? actions.save;
  const cancel = cancelLabel ?? actions.cancel;
  const handle = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label={cancel} className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex h-full max-w-[95vw] flex-col bg-surface shadow-xl" style={{ width }}>
        <button
          type="button"
          aria-label={actions.resize}
          onPointerDown={startResize}
          className="absolute top-0 bottom-0 left-0 z-10 w-1.5 cursor-col-resize bg-transparent hover:bg-focus/40"
        />
        <div className="flex items-center justify-between border-border border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <Button isIconOnly size="sm" variant="ghost" onPress={onClose} aria-label={cancel}>
            <Icon icon={ICONS.chevronRight} width={18} height={18} />
          </Button>
        </div>
        <form onSubmit={handle} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
          {error && <p className="px-5 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 border-border border-t px-5 py-4">
            <Button type="button" variant="ghost" onPress={onClose} isDisabled={busy ?? false}>
              {cancel}
            </Button>
            <Button type="submit" isDisabled={(busy ?? false) || (submitDisabled ?? false)}>
              {busy ? "…" : submit}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
