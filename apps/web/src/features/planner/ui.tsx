"use client";

import type { CSSProperties } from "react";
import { Annoyed, Frown, Laugh, Meh, Smile } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import type { Intensity, SpendKind } from "@/features/planner/calc";
import { cn } from "@/lib/utils";

export const kindMeta: Record<SpendKind | "Savings", { color: string; soft: string; text: string; desc: string }> = {
  Need: { color: "var(--chart-2)", soft: "bg-[color-mix(in_srgb,var(--chart-2)_14%,transparent)]", text: "text-[var(--chart-2)]", desc: "Essential — rent, food, transport, medicine" },
  Want: { color: "var(--chart-3)", soft: "bg-[color-mix(in_srgb,var(--chart-3)_16%,transparent)]", text: "text-[var(--chart-3)]", desc: "Nice to have — 50% counts as leakage if the 48-hr rule was skipped" },
  Craving: { color: "var(--chart-4)", soft: "bg-[color-mix(in_srgb,var(--chart-4)_14%,transparent)]", text: "text-[var(--chart-4)]", desc: "Emotional urge — 100% counts as leakage" },
  Savings: { color: "var(--chart-1)", soft: "bg-accent-soft", text: "text-accent", desc: "Money left to invest" },
};

export function KindPill({ kind, className }: { kind: SpendKind; className?: string }) {
  const m = kindMeta[kind];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-medium", m.soft, m.text, className)}>
      <span className="size-1.5 rounded-full" style={{ background: m.color }} />
      {kind}
    </span>
  );
}

export const moodFaces = [
  { v: 1, icon: Frown, label: "Regret" },
  { v: 2, icon: Annoyed, label: "Uneasy" },
  { v: 3, icon: Meh, label: "Neutral" },
  { v: 4, icon: Smile, label: "Good" },
  { v: 5, icon: Laugh, label: "Happy" },
] as const;

const moodTone = ["", "text-danger", "text-warning", "text-muted-foreground", "text-success", "text-success"];

export function MoodFace({ mood, className }: { mood: number; className?: string }) {
  const f = moodFaces.find((x) => x.v === mood);
  if (!f) return <span className="text-muted-foreground">—</span>;
  const Icon = f.icon;
  return (
    <Tooltip content={`Mood after: ${mood} · ${f.label}`}>
      <span className={cn("inline-flex", moodTone[mood], className)}>
        <Icon className="size-4" />
      </span>
    </Tooltip>
  );
}

export function MoodPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-input bg-card p-0.5">
      {moodFaces.map((f) => {
        const Icon = f.icon;
        const active = value === f.v;
        return (
          <Tooltip key={f.v} content={`${f.v} · ${f.label}`}>
            <button
              type="button"
              onClick={() => onChange(f.v)}
              className={cn(
                "inline-flex size-7 cursor-pointer items-center justify-center rounded-md transition",
                active ? cn("bg-muted", moodTone[f.v]) : "text-muted-foreground/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

export const intensityTone: Record<Intensity, "danger" | "warning" | "success"> = { HIGH: "danger", MEDIUM: "warning", LOW: "success" };

export function IntensityChip({ intensity }: { intensity: Intensity }) {
  return (
    <Badge tone={intensityTone[intensity]} dot>
      {intensity}
    </Badge>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: React.ReactNode; activeCls?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-lg border border-input bg-card p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 cursor-pointer rounded-md px-2.5 text-[12.5px] font-medium transition",
            value === o.value ? (o.activeCls ?? "bg-primary text-primary-foreground") : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function years(n: number, digits = 1) {
  return Number.isFinite(n) ? `${n.toFixed(digits)} yrs` : "—";
}

export const tooltipStyle: { contentStyle: CSSProperties; labelStyle: CSSProperties; itemStyle: CSSProperties } = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    boxShadow: "0 8px 24px -8px rgba(0,0,0,0.18)",
    fontSize: 12,
    padding: "8px 10px",
  },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 4, fontWeight: 500 },
  itemStyle: { color: "var(--foreground)", padding: 0 },
};

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
} as const;

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>;
}
