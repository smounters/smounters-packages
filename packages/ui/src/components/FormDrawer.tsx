import { Button, cn } from "@heroui/react";
import { useUiLabels } from "../provider";
import {
  cloneElement,
  type FormEvent,
  isValidElement,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useId,
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

/**
 * Общий класс для нативных <select>: у HeroUI Select слишком тяжёлый API для простых перечислений.
 *
 * Состояние `disabled` обязано быть ВИДНЫМ: без него заблокированный список выглядит как рабочий, и
 * клик по нему читается как поломка интерфейса, а не как «это поле менять нельзя».
 */
export const SELECT_CLASS =
  "app-select appearance-none rounded-medium border border-border bg-surface py-2 pl-3 pr-9 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60";

const LABELLABLE = new Set(["input", "select", "textarea"]);

/**
 * Можно ли подставить `id` ребёнку и связать с ним подпись.
 *
 * Голый тег — только если он вообще умеет быть подписанным. Компонент — да: внутри почти всегда
 * поле HeroUI, и оно `id` пробрасывает. Ограничение одними голыми тегами было проверено живьём и
 * не сработало: поля фильтра заказов и настроек шлюза лежат в `Field` через <Input>, то есть через
 * компонент, и остались без имени.
 */

/**
 * Строка формы.
 *
 * Обёртка — <div>, а не <label>: внутрь кладут и составные контролы (пикеры со своим выпадающим
 * списком), и оборачивание их в <label> отправляло бы клик по элементу списка на первый попавшийся
 * контрол.
 *
 * Но и просто нарисовать подпись <span>'ом нельзя — она тогда ни с чем не связана. Расчёт на то,
 * что «контрол внутри несёт доступность сам», не оправдался: вызывающие передают поле, рассчитывая
 * на подпись отсюда, и оно остаётся вовсе без имени — диктор называет его «поле ввода», а клик по
 * подписи не ставит курсор.
 *
 * Связывание идёт двумя способами, и это НЕ вкусовщина:
 *
 * - голый input/select/textarea — `id` + <label for>. Тег известен, атрибут точно доедет, клик по
 *   подписи ставит курсор.
 * - компонент — подпись получает `id`, а ребёнок `aria-labelledby`. Через <label for> так нельзя:
 *   составной компонент может `id` не пробросить, и тогда `for` указывает в пустоту — проверено
 *   живьём на экране настроек шлюза, где `label[for="_r_o_"]` не имел цели вовсе. Это ХУЖЕ
 *   несвязанной подписи. Проглоченный `aria-labelledby` не оставляет висящей ссылки: подпись просто
 *   остаётся подписью, как было до правки.
 *
 * Ребёнок, у которого уже есть своё имя, не трогается.
 */
export function Field({ label, hint, children }: { label: string; hint?: string | undefined; children: ReactNode }) {
  const id = useId();
  const named =
    isValidElement<{ id?: string; "aria-label"?: string; "aria-labelledby"?: string }>(children) &&
    (children.props.id !== undefined ||
      children.props["aria-label"] !== undefined ||
      children.props["aria-labelledby"] !== undefined);
  const host = isValidElement(children) && typeof children.type === "string";
  const bindable = isValidElement(children) && !named;
  const byFor = bindable && host && LABELLABLE.has(children.type as string);

  const control = bindable
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, byFor ? { id } : { "aria-labelledby": id })
    : children;

  return (
    <div className="flex flex-col gap-1 text-sm">
      {byFor ? (
        <label className="text-muted" htmlFor={id}>
          {label}
        </label>
      ) : (
        <span className="text-muted" id={bindable ? id : undefined}>
          {label}
        </span>
      )}
      {control}
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
  /**
   * Дополнительное действие формы (например «Проверить соединение»). Встаёт в подвал рядом с
   * «Сохранить», а не в тело: это действие над формой целиком, и место ему там же, где остальные её
   * кнопки. «Отмена» при этом уходит к левому краю — уводить необратимое действие подальше от
   * подтверждающих полезно и само по себе.
   */
  footerActions?: ReactNode;
  children: ReactNode;
}

/** Крутящийся индикатор в кнопке: пока бэкенд проверяет введённое (токен бота, доступ к чату), форма
 * молчала по нескольку секунд и выглядела зависшей — многоточие вместо подписи это не читалось. */
function BusySpinner() {
  return (
    <svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
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
  footerActions,
  children,
}: FormDrawerProps) {
  const { actions } = useUiLabels();
  const [width, setWidth] = useState(readDrawerWidth);
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  const startResize = useCallback((e: ReactPointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    setDragging(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMove = (ev: PointerEvent) => {
      const max = Math.min(window.innerWidth - 40, 1400);
      setWidth(Math.max(DRAWER_MIN_WIDTH, Math.min(max, startW + (startX - ev.clientX))));
    };
    const onUp = () => {
      setDragging(false);
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
        {/* Ручка на левом крае. Тот же язык, что у сайдбара: широкая невидимая зона захвата, а видна
            ЛИНИЯ в один пиксель, которая подсвечивается акцентом. Раньше здесь подсвечивалась вся
            полоса в 6px — на фоне тонких границ остального интерфейса это выглядело грубо. */}
        <button
          type="button"
          aria-label={actions.resize}
          tabIndex={-1}
          onPointerDown={startResize}
          className="group absolute inset-y-0 left-0 z-10 flex w-2 -translate-x-1/2 cursor-col-resize touch-none items-stretch justify-center bg-transparent p-0"
        >
          <span
            className={cn("h-full w-px bg-border transition-colors group-hover:bg-accent", dragging && "bg-accent")}
          />
        </button>
        <div className="flex items-center justify-between border-border border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <Button isIconOnly size="sm" variant="ghost" onPress={onClose} aria-label={cancel}>
            <Icon icon={ICONS.chevronRight} width={18} height={18} />
          </Button>
        </div>
        {/* onSubmit ждёт void-функцию, а наш обработчик асинхронный: явно «выбрасываем» промис, иначе
            необработанное отклонение проглатывается формой. */}
        <form
          onSubmit={(e) => {
            void handle(e);
          }}
          aria-busy={busy ?? false}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
          {/* Полоса ошибки — прямо над подвалом: ближе всего к кнопке, которая её вызвала. */}
          {error && <p className="px-5 pb-2 text-sm text-danger">{error}</p>}
          <div className="flex items-center justify-between gap-6 border-border border-t px-5 py-4">
            <Button type="button" variant="ghost" onPress={onClose} isDisabled={busy ?? false}>
              {cancel}
            </Button>
            <div className="flex items-center gap-2">
              {footerActions}
              <Button type="submit" isDisabled={(busy ?? false) || (submitDisabled ?? false)}>
                {busy && <BusySpinner />}
                {submit}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
