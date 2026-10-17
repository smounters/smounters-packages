import { Button } from "@heroui/react";

export interface DateRange {
  from: string;
  to: string;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (r: DateRange) => void;
  labels?: { from?: string; to?: string; last7?: string; last30?: string; thisMonth?: string };
  className?: string;
}

const inputCls =
  "rounded-medium border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function DateRangePicker({ value, onChange, labels, className }: DateRangePickerProps) {
  const set = (patch: Partial<DateRange>) => onChange({ ...value, ...patch });
  const lastDays = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onChange({ from: isoDate(from), to: isoDate(to) });
  };
  const thisMonth = () => {
    const now = new Date();
    onChange({ from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) });
  };
  return (
    <div className={`flex flex-wrap items-end gap-2 ${className ?? ""}`}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted text-xs">{labels?.from ?? "From"}</span>
        <input type="date" className={inputCls} value={value.from} onChange={(e) => set({ from: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted text-xs">{labels?.to ?? "To"}</span>
        <input type="date" className={inputCls} value={value.to} onChange={(e) => set({ to: e.target.value })} />
      </label>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onPress={() => lastDays(7)}>
          {labels?.last7 ?? "7d"}
        </Button>
        <Button size="sm" variant="outline" onPress={() => lastDays(30)}>
          {labels?.last30 ?? "30d"}
        </Button>
        <Button size="sm" variant="outline" onPress={thisMonth}>
          {labels?.thisMonth ?? "Month"}
        </Button>
      </div>
    </div>
  );
}
