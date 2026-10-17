import type { ReactNode } from "react";

export type CalloutTone = "info" | "success" | "warning" | "danger" | "neutral";

// Имя не Alert (занято HeroUI) и не Notice — рядом уже живёт ErrorNotice для ошибок запроса.
const TONES: Record<CalloutTone, string> = {
  info: "border-info/40 bg-info/10",
  success: "border-success/40 bg-success/10",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-danger/40 bg-danger/10",
  neutral: "border-border bg-surface-secondary",
};

export interface CalloutProps {
  tone?: CalloutTone;
  /** Жирная первая строка — «Внимание», «Важно». */
  title?: ReactNode;
  children?: ReactNode;
  /** Плотный вид для подсказок внутри форм и панелей. */
  compact?: boolean;
  className?: string;
}

/** Плашка-предупреждение: рамка и фон по тону, текст обычным цветом (чтобы читался на любом фоне). */
export function Callout({ tone = "warning", title, children, compact, className }: CalloutProps) {
  const pad = compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm";
  return (
    <div className={`rounded-medium border text-foreground ${TONES[tone]} ${pad} ${className ?? ""}`}>
      {title && <strong className="mr-1">{title}</strong>}
      {children}
    </div>
  );
}
