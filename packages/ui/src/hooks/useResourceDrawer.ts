import { useCallback, useState } from "react";

export interface ResourceDrawer<E, F> {
  open: boolean;
  /** Редактируемая сущность; null — создание. */
  editing: E | null;
  form: F;
  setForm: (form: F) => void;
  /** Частичное обновление — самый частый вызов в формах. */
  patch: (part: Partial<F>) => void;
  openNew: () => void;
  openEdit: (entity: E) => void;
  close: () => void;
}

export interface UseResourceDrawerOptions<E, F> {
  /** Пустая форма для создания. */
  empty: F;
  /** Сущность → поля формы (при открытии на редактирование). */
  toForm: (entity: E) => F;
}

/**
 * Состояние ящика создания/редактирования: open + editing + form + сброс. Эта тройка была скопирована
 * в 45 страниц, и ошибались в ней одинаково — забывали сбросить форму при переходе «правка → создание»,
 * из-за чего новая запись открывалась с чужими значениями.
 *
 * Отправку хук НЕ берёт: у каждой страницы своя пара мутаций и свой refetch, и попытка это обобщить
 * даёт параметризацию сложнее самого кода.
 */
export function useResourceDrawer<E, F>({ empty, toForm }: UseResourceDrawerOptions<E, F>): ResourceDrawer<E, F> {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<E | null>(null);
  const [form, setForm] = useState<F>(empty);

  const openNew = useCallback(() => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }, [empty]);

  const openEdit = useCallback(
    (entity: E) => {
      setEditing(entity);
      setForm(toForm(entity));
      setOpen(true);
    },
    [toForm],
  );

  const patch = useCallback((part: Partial<F>) => setForm((f) => ({ ...f, ...part })), []);
  const close = useCallback(() => setOpen(false), []);

  return { open, editing, form, setForm, patch, openNew, openEdit, close };
}
