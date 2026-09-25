import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-body font-medium leading-5 whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-text-secondary",
        accent: "bg-primary-soft text-primary", // brand (Royal) — kept as `accent` for existing callers
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        gold: "bg-accent-soft text-accent-strong", // Quicksand highlight — use sparingly
        outline: "border border-border-strong text-text-secondary",
        solid: "bg-primary text-primary-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  dot,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS_TONES: [RegExp, BadgeTone][] = [
  [/overdue|failed|reject|critical|error|lost|blocked|dangerous/i, "danger"],
  [/cancel|inactive|draft|closed|archived|planned|n\/a/i, "neutral"],
  [/partial|pending|attention|expir|warning|review|awaiting|due|hold|paused|renewal/i, "warning"],
  [/paid|approved|complete|done|active|published|won|passed|success|released|locked|signed|present/i, "success"],
  [/processing|new|open|in progress|sent|scheduled|info|upcoming/i, "info"],
];

/** Picks the semantic tone from the status label, so every module colours statuses the same way. */
export function statusTone(status: string): BadgeTone {
  return STATUS_TONES.find(([re]) => re.test(status))?.[1] ?? "neutral";
}

export function StatusBadge({ status, tone, className }: { status: string; tone?: BadgeTone; className?: string }) {
  return (
    <Badge tone={tone ?? statusTone(status)} dot className={className}>
      {status}
    </Badge>
  );
}
