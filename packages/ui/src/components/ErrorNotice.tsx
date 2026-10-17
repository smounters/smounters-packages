// Ошибка запроса — не валидация поля, поэтому имя не пересекается с ErrorMessage/FieldError у HeroUI.

/**
 * Первое непустое сообщение об ошибке. Ровно этот `(a.error ?? b.error)?.message ?? null` был скопирован
 * по формам десятки раз; здесь он один и принимает сколько угодно мутаций.
 */
export function errorText(...sources: ({ message?: string } | null | undefined)[]): string | null {
  for (const s of sources) {
    if (s?.message) return s.message;
  }
  return null;
}

export interface ErrorNoticeProps {
  /** Объект ошибки, строка или null. Пусто — компонент не рисуется. */
  error?: { message?: string } | string | null | undefined;
  className?: string | undefined;
}

export function ErrorNotice({ error, className }: ErrorNoticeProps) {
  const text = typeof error === "string" ? error : error?.message;
  if (!text) return null;
  return (
    <p role="alert" className={`text-danger text-sm ${className ?? ""}`}>
      {text}
    </p>
  );
}
