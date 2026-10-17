import type { ReactNode } from "react";

// Цвета — токенами (--success/--warning/--danger/--accent), а не hex: в светлой и тёмной теме они
// разные ради контраста.
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE: Record<StatusTone, string> = {
  neutral: "border-border bg-surface text-muted",
  info: "border-accent/40 bg-accent/10 text-accent",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
};

export function StatusPill({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 font-medium text-xs ${TONE[tone]}`}>
      {children}
    </span>
  );
}
