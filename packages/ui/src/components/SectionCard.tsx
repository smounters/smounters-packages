import type { ReactNode } from "react";

export interface SectionCardProps {
  /** Заголовок секции. Пусто — шапка не рисуется. */
  title?: ReactNode;
  /** Кнопки справа в шапке. Требуют title — без него шапки нет. */
  actions?: ReactNode;
  children?: ReactNode;
  /** Просторные поля (p-6) — для заглушек «ничего нет» и одиночных сообщений. */
  roomy?: boolean;
  /** Своя раскладка содержимого вместо колонки с отступом (например grid). */
  bodyClassName?: string;
  className?: string;
}

/**
 * Карточка-секция страницы: рамка, фон, отступы, необязательная шапка с заголовком и кнопками.
 * Имя не `Card` — оно занято HeroUI.
 */
export function SectionCard({ title, actions, children, roomy, bodyClassName, className }: SectionCardProps) {
  const pad = roomy ? "p-6" : "p-4";
  const body = bodyClassName ?? "flex flex-col gap-3";
  return (
    <div className={`rounded-large border border-border bg-surface ${pad} ${className ?? ""}`}>
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold text-base text-foreground">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={body}>{children}</div>
    </div>
  );
}
