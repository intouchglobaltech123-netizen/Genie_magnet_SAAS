"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { monthlyFinance } from "@/lib/mock/finance";
import { cn, inrCompact, pct } from "@/lib/utils";
import { ASPIRATION } from "./goals-data";

const tooltipStyle = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    boxShadow: "0 8px 24px -8px rgba(0,0,0,0.18)",
    fontSize: 12,
    padding: "8px 10px",
  },
  labelStyle: { color: "var(--color-muted-foreground)", marginBottom: 4, fontWeight: 500 },
  itemStyle: { color: "var(--color-foreground)", padding: 0 },
  cursor: { fill: "var(--color-muted)" },
};
const axisProps = { tickLine: false, axisLine: false, tick: { fill: "var(--color-muted-foreground)", fontSize: 11 } } as const;

export function AspirationHero() {
  const a = ASPIRATION;
  const fyProgress = a.ytdRevenue / a.revenueGoal;
  const vsPlan = a.ytdRevenue / a.ytdGoal;
  const chart = monthlyFinance.map((m) => ({ month: m.month, Goal: m.goalRevenue, Actual: m.actualRevenue }));

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_1.4fr]">
        {/* Left — the aspiration */}
        <div className="relative border-b border-border p-6 lg:border-b-0 lg:border-r">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-soft/70 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2 text-body font-medium text-muted-foreground">
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Target className="size-3.5" />
              </span>
              Business Aspiration
              <Badge tone="outline">{a.fy}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-heading font-semibold leading-none tracking-tight tabular">{inrCompact(a.revenueGoal)}</span>
              <span className="text-subheading text-muted-foreground">revenue</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-heading font-semibold tracking-tight tabular">{pct(a.netMarginGoal)}</span>
              <span className="text-subheading text-muted-foreground">net margin</span>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <div className="mb-1.5 flex items-baseline justify-between text-body">
                  <span className="text-muted-foreground">FY revenue so far</span>
                  <span className="tabular">
                    <span className="font-semibold">{inrCompact(a.ytdRevenue)}</span>
                    <span className="text-muted-foreground"> of {inrCompact(a.revenueGoal)}</span>
                  </span>
                </div>
                <Progress value={fyProgress * 100} tone="accent" className="h-2" />
                <div className="mt-1.5 flex justify-between text-body text-muted-foreground">
                  <span className="tabular">{pct(fyProgress)} of FY goal · 6 of 12 months</span>
                  <span className="tabular">Sep month-to-date</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-body text-muted-foreground">YTD vs goal-to-date</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-heading font-semibold tracking-tight tabular">{pct(vsPlan, 1)}</span>
                    <Badge tone={vsPlan >= 0.95 ? "success" : "warning"} dot>
                      {vsPlan >= 0.95 ? "On track" : "At risk"}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-body text-muted-foreground tabular">
                    {inrCompact(a.ytdRevenue)} vs {inrCompact(a.ytdGoal)} · gap {inrCompact(a.ytdGoal - a.ytdRevenue)}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-body text-muted-foreground">Net margin YTD</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-heading font-semibold tracking-tight tabular">{pct(a.ytdMargin, 1)}</span>
                    <span className="text-body text-muted-foreground">goal {pct(a.netMarginGoal)}</span>
                  </div>
                  <Progress value={(a.ytdMargin / a.netMarginGoal) * 100} tone="warning" className="mt-2" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right — quarterly break-up */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-subheading font-semibold tracking-tight">Quarterly break-up</div>
              <div className="text-body text-muted-foreground">Goal vs actual · Indian FY Apr–Mar</div>
            </div>
            <div className="flex items-center gap-3 text-body text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-chart-5/40" /> Goal
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-primary" /> Actual
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {a.quarters.map((q) => {
              const p = q.actual / q.goal;
              return (
                <div
                  key={q.q}
                  className={cn(
                    "rounded-xl border p-3",
                    q.state === "in-progress" ? "border-primary/40 bg-primary-soft/40" : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-body font-semibold">{q.q}</span>
                    {q.state === "done" && <Badge tone="success">Closed</Badge>}
                    {q.state === "in-progress" && <Badge tone="accent">In progress</Badge>}
                    {q.state === "upcoming" && <Badge tone="neutral">Upcoming</Badge>}
                  </div>
                  <div className="text-body text-muted-foreground">{q.months}</div>
                  <div className="mt-3 text-subheading font-semibold tracking-tight tabular">
                    {q.state === "upcoming" ? "—" : inrCompact(q.actual)}
                  </div>
                  <div className="text-body text-muted-foreground tabular">of {inrCompact(q.goal)}</div>
                  <Progress
                    value={p * 100}
                    tone={q.state === "done" ? (p >= 0.97 ? "success" : "warning") : "accent"}
                    className="mt-2"
                  />
                  <div className="mt-1 text-body text-muted-foreground tabular">
                    {q.state === "upcoming" ? "Starts " + (q.q === "Q3" ? "1 Oct" : "1 Jan") : `${Math.round(p * 100)}%${q.state === "in-progress" ? " · Sep MTD" : ""}`}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} barGap={2} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" {...axisProps} />
                <YAxis hide />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v) => (typeof v === "number" ? inrCompact(v) : "—")}
                />
                <Bar dataKey="Goal" fill="var(--color-chart-5)" fillOpacity={0.35} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Actual" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Card>
  );
}
