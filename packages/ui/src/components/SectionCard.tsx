import type { ReactNode } from "react";

export interface SectionCardProps {
  /** Заголовок секции. Пусто — шапка не рисуется. */
  title?: ReactNode;
  /** Кнопки справа в шапке. Требуют title — без него шапки нет. */
  actions?: ReactNode;
  children?: ReactNode;
  /** Просторные поля (p-6) — для заглушек «ничего нет» и одиночных сообщений. */
  roomy?: boolean;
  /** Мелкий заголовок (h3) — для карточек внутри колонки, как на столе оператора. */
  small?: boolean;
  /** Раскладка содержимого. Без заголовка по умолчанию НЕ оборачиваем — карточка остаётся одним div. */
  bodyClassName?: string;
  className?: string;
}

/**
 * Карточка-секция страницы: рамка, фон, отступы, необязательная шапка с заголовком и кнопками.
 * Имя не `Card` — оно занято HeroUI.
 */
export function SectionCard({ title, actions, children, roomy, small, bodyClassName, className }: SectionCardProps) {
  const pad = roomy ? "p-6" : "p-4";
  const body = bodyClassName ?? (title ? "flex flex-col gap-3" : null);
  const Heading = small ? "h3" : "h2";
  return (
    <div className={`rounded-large border border-border bg-surface ${pad} ${className ?? ""}`}>
      {title && (
        <div className={`flex items-center justify-between gap-2 ${small ? "mb-2" : "mb-3"}`}>
          <Heading className={`font-semibold text-foreground ${small ? "text-sm" : "text-base"}`}>{title}</Heading>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {body === null ? children : <div className={body}>{children}</div>}
    </div>
  );
}
