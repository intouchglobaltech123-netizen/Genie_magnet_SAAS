import { cn } from "@/lib/utils";

export type ProgressTone = "accent" | "success" | "warning" | "danger" | "gold" | "info";

export function Progress({ value, className, tone = "accent" }: { value: number; className?: string; tone?: ProgressTone }) {
  const color = {
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    gold: "bg-gold",
    info: "bg-info",
  }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
