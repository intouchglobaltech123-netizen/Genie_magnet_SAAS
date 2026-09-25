import * as React from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Minimal, professional empty state: icon, short title, one line of guidance, one action. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-secondary text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-5" />
      </span>
      <div className="space-y-0.5">
        <p className="text-body font-semibold text-text-primary">{title}</p>
        {description && <p className="max-w-sm text-body text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

/** Skeleton block for loading states — keeps layout stable instead of spinners. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-skeleton rounded-md bg-muted", className)} aria-hidden />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn("h-9", i % 3 === 2 ? "w-4/5" : "w-full")} />
      ))}
    </div>
  );
}

/** Inline alert for info / warning / error / success messages. */
export function Alert({
  tone = "info",
  title,
  children,
  icon: Icon,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const cls = {
    info: "border-info/25 bg-info-soft text-info",
    success: "border-success/25 bg-success-soft text-success",
    warning: "border-warning/25 bg-warning-soft text-warning",
    danger: "border-danger/25 bg-danger-soft text-danger",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border px-4 py-3", cls, className)}>
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 text-body">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-text-secondary">{children}</div>}
      </div>
    </div>
  );
}
