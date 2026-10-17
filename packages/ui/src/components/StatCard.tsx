import type { ReactNode } from "react";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "success" | "danger" | "muted" | "accent";
  className?: string;
}

const TONE: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  danger: "text-danger",
  muted: "text-muted",
  accent: "text-accent",
};

/** Плитка метрики для шапки экрана (KPI-строка). */
export function StatCard({ label, value, hint, tone = "default", className }: StatCardProps) {
  return (
    <div className={`rounded-medium border border-border bg-surface px-4 py-3 ${className ?? ""}`}>
      <div className="text-muted text-xs uppercase tracking-wide">{label}</div>
      <div className={`mt-1 font-semibold text-lg ${TONE[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-muted text-xs">{hint}</div>}
    </div>
  );
}
