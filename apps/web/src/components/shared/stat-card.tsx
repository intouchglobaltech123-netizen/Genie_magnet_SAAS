import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  hint,
  tone = "accent",
  children,
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number; // e.g. 0.12 → +12%
  deltaLabel?: string;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  tone?: "accent" | "success" | "warning" | "danger" | "gold" | "info";
  children?: React.ReactNode;
  className?: string;
}) {
  const toneCls = {
    accent: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    gold: "bg-accent-soft text-accent-strong",
    info: "bg-info-soft text-info",
  }[tone];
  const up = (delta ?? 0) >= 0;
  return (
    <Card className={cn("relative overflow-hidden p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-body font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", toneCls)}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="mt-2 text-heading font-semibold text-primary tabular dark:text-text-primary">{value}</div>
      {(delta !== undefined || hint) && (
        <div className="mt-1 flex items-center gap-2 text-body">
          {delta !== undefined && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-success" : "text-danger")}>
              {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(delta * 100).toFixed(0)}%
            </span>
          )}
          {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
      {children}
    </Card>
  );
}

/** Executive KPI tile — alias used by dashboards. */
export { StatCard as KpiCard };
