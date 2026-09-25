"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, hoursLabel } from "@/lib/utils";
import { SHIFT_MINUTES } from "./config";
import { summarise } from "./compute";
import type { DaySheet } from "./seed";
import { clock12, spanMinutes, toMin } from "./time";

const DAY_START = 9 * 60;
const DAY_END = 19 * 60;

export function DaySummary({ sheet }: { sheet: DaySheet | undefined }) {
  const s = summarise(sheet);
  const ratio = Math.min(1, s.total / SHIFT_MINUTES);
  const over = s.total > SHIFT_MINUTES;
  const R = 44;
  const C = 2 * Math.PI * R;
  const ringTone = over ? "var(--color-warning)" : ratio >= 0.94 ? "var(--color-success)" : "var(--color-primary)";

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Day summary</CardTitle>
          <CardDescription>Auto-calculated — no manual totalling</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-5">
          <div className="relative size-[108px] shrink-0">
            <svg viewBox="0 0 108 108" className="size-full -rotate-90">
              <circle cx="54" cy="54" r={R} fill="none" stroke="var(--color-muted)" strokeWidth="9" />
              <circle
                cx="54"
                cy="54"
                r={R}
                fill="none"
                stroke={ringTone}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - ratio)}
                style={{ transition: "stroke-dashoffset 600ms ease, stroke 300ms" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-subheading font-semibold tracking-tight tabular">{hoursLabel(s.total)}</span>
              <span className="text-body text-muted-foreground">of 8h shift</span>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-3">
            <Mini label="Completed" value={s.completed} cls="text-success" />
            <Mini label="Pending" value={s.pending} cls={s.pending ? "text-warning" : undefined} />
            <Mini label="Errors" value={s.errors} cls={s.errors ? "text-danger" : undefined} />
            <Mini
              label={s.gap >= 0 ? "Short by" : "Extra"}
              value={hoursLabel(Math.abs(s.gap))}
              cls={Math.abs(s.gap) > 30 ? "text-warning" : "text-muted-foreground"}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-body">
            <span className="font-medium">Productive vs non-productive</span>
            <span className="text-muted-foreground tabular">
              {s.total ? Math.round((s.productive / s.total) * 100) : 0}% productive
            </span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-success transition-all duration-500" style={{ width: `${s.total ? (s.productive / s.total) * 100 : 0}%` }} />
            <div className="h-full bg-chart-4/70 transition-all duration-500" style={{ width: `${s.total ? (s.nonProductive / s.total) * 100 : 0}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-body text-muted-foreground tabular">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-success" /> {hoursLabel(s.productive)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-chart-4" /> {hoursLabel(s.nonProductive)}
            </span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-body font-medium">Day timeline</div>
          <div className="relative h-7 overflow-hidden rounded-lg bg-muted">
            {(sheet?.rows ?? []).map((r, i) => {
              const a = toMin(r.start);
              const m = spanMinutes(r.start, r.end);
              if (a === null || m === null) return null;
              const left = ((Math.max(a, DAY_START) - DAY_START) / (DAY_END - DAY_START)) * 100;
              const width = (m / (DAY_END - DAY_START)) * 100;
              return (
                <Tooltip key={r.id} content={`#${i + 1} · ${clock12(r.start)} – ${clock12(r.end)} · ${r.status}`}>
                  <div
                    className={cn(
                      "absolute top-1 bottom-1 rounded-md transition-all",
                      !r.productive ? "bg-chart-4/60" : r.status === "Completed" ? "bg-success/80" : "bg-warning/80",
                    )}
                    style={{ left: `calc(${left}% + 1px)`, width: `calc(${width}% - 2px)` }}
                  />
                </Tooltip>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-body text-muted-foreground tabular">
            <span>9 AM</span>
            <span>11</span>
            <span>1 PM</span>
            <span>3</span>
            <span>5</span>
            <span>7 PM</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, cls }: { label: string; value: React.ReactNode; cls?: string }) {
  return (
    <div>
      <div className="text-body text-muted-foreground">{label}</div>
      <div className={cn("text-subheading font-semibold leading-tight tracking-tight tabular", cls)}>{value}</div>
    </div>
  );
}
