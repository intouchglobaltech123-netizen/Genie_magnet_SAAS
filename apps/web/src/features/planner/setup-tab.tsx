"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Lock, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { calcSetup, corpusProjection, monthlyReport } from "@/features/planner/calc";
import { usePlanner } from "@/features/planner/store";
import { axisProps, kindMeta, SectionLabel, tooltipStyle, years } from "@/features/planner/ui";
import { cn, inr, inrCompact } from "@/lib/utils";

function NumField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  locked,
}: {
  label: string;
  value: number | string;
  onChange?: (v: string) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
  locked?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-2">
        <Label>{label}</Label>
        {locked && (
          <span className="inline-flex items-center gap-1 text-body text-muted-foreground">
            <Lock className="size-3" /> Fixed
          </span>
        )}
      </div>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-muted-foreground">{prefix}</span>}
        <Input
          value={value}
          readOnly={locked}
          inputMode="decimal"
          onChange={(e) => onChange?.(e.target.value)}
          className={cn("tabular", prefix && "pl-7", suffix && "pr-12", locked && "bg-muted text-muted-foreground")}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <p className="text-body text-muted-foreground">{hint}</p>}
    </div>
  );
}

const num = (v: string) => {
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function SetupTab() {
  const setup = usePlanner((s) => s.setup);
  const log = usePlanner((s) => s.log);
  const update = usePlanner((s) => s.updateSetup);
  const c = calcSetup(setup);
  const report = useMemo(() => monthlyReport(log, setup), [log, setup]);
  const projection = useMemo(() => corpusProjection(setup, report.leak), [setup, report.leak]);

  const rows = [
    { label: "Years to retirement", value: `${c.yearsToRetire} years`, formula: "Retirement age − current age" },
    { label: "Monthly lifestyle expense", value: inr(c.monthlyLifestyle), formula: "50% of monthly income" },
    { label: "Annual lifestyle expense (today)", value: inr(c.annualLifestyle), formula: "Monthly × 12" },
    { label: "Monthly expense at retirement", value: inr(c.monthlyAtRetirement), formula: `Inflated at ${setup.inflation}% for ${c.yearsToRetire} yrs` },
    { label: "Annual expense at retirement", value: inr(c.annualAtRetirement), formula: "Monthly × 12" },
  ];

  const savings = Math.max(0, setup.monthlyIncome - report.total);
  const actual = [
    { k: "Need" as const, v: report.needs },
    { k: "Want" as const, v: report.wants },
    { k: "Craving" as const, v: report.cravings },
    { k: "Savings" as const, v: savings },
  ];
  const actualTotal = Math.max(1, actual.reduce((s, a) => s + a.v, 0));

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Your details</CardTitle>
            <CardDescription>Everything else calculates automatically.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <NumField label="Your name" value={setup.name} onChange={(v) => update({ name: v })} />
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Current age" value={setup.age} suffix="yrs" onChange={(v) => update({ age: num(v) })} />
            <NumField label="Retire at" value={setup.retireAge} suffix="yrs" onChange={(v) => update({ retireAge: num(v) })} />
          </div>
          <NumField label="Monthly income" prefix="₹" value={setup.monthlyIncome.toLocaleString("en-IN")} onChange={(v) => update({ monthlyIncome: num(v) })} />
          <NumField
            label="Current monthly SIP / investment"
            prefix="₹"
            value={setup.monthlySip.toLocaleString("en-IN")}
            onChange={(v) => update({ monthlySip: num(v) })}
            hint="Used to project when you reach your corpus."
          />
          <div className="border-t border-border pt-4">
            <SectionLabel>Assumptions</SectionLabel>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Inflation" value={setup.inflation} suffix="%" locked />
              <NumField label="Return" value={setup.expectedReturn} suffix="%" locked />
              <NumField label="Post-ret." value={setup.postRetirementReturn} suffix="%" locked />
            </div>
            <p className="mt-2 text-body text-muted-foreground">Way To Fortune fixes these so every member plans on the same honest basis.</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card className="overflow-hidden">
          <div className="glow-accent grid grid-cols-1 gap-6 p-6 md:grid-cols-[1.1fr_1fr]">
            <div>
              <div className="flex items-center gap-2 text-body font-medium text-muted-foreground">
                <Sparkles className="size-4 text-accent-strong" /> Retirement corpus {setup.name || "you"} needs
              </div>
              <div className="mt-2 text-heading font-semibold leading-none tracking-tight tabular">{inr(c.corpus)}</div>
              <div className="mt-2 text-body text-muted-foreground">
                25 × annual expense at retirement · {inrCompact(c.corpus)} by age {setup.retireAge}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-card/70 p-3">
                  <div className="text-body text-muted-foreground">Retire at (with leakage)</div>
                  <div className="mt-0.5 text-heading font-semibold tabular">{Number.isFinite(report.retireAgeWithLeak) ? report.retireAgeWithLeak.toFixed(1) : "—"}</div>
                </div>
                <div className="rounded-xl border border-success/30 bg-success-soft p-3">
                  <div className="text-body text-success">Retire at (leak stopped)</div>
                  <div className="mt-0.5 text-heading font-semibold text-success tabular">
                    {Number.isFinite(report.retireAgeLeakStopped) ? report.retireAgeLeakStopped.toFixed(1) : "—"}
                  </div>
                </div>
              </div>
            </div>
            <div className="divide-y divide-border rounded-xl border border-border bg-card/80">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-body">{r.label}</div>
                    <div className="text-body text-muted-foreground">{r.formula}</div>
                  </div>
                  <div className="shrink-0 text-body font-semibold tabular">{r.value}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Corpus growth</CardTitle>
              <CardDescription>
                SIP of {inr(setup.monthlySip)}/mo at {setup.expectedReturn}% vs the same SIP plus this month&apos;s leakage ({inr(report.leak)}) redirected
              </CardDescription>
            </div>
            <Badge tone="success">
              <TrendingUp /> {years(report.yearsLost)} earlier
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projection} margin={{ left: 4, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
                  <XAxis dataKey="age" {...axisProps} tickFormatter={(v) => `${v}`} />
                  <YAxis {...axisProps} width={56} tickFormatter={(v) => inrCompact(v)} />
                  <Tooltip
                    {...tooltipStyle}
                    labelFormatter={(v) => `Age ${v}`}
                    formatter={(v, n) => [inr(Number(v)), n === "withLeakStopped" ? "Leak stopped → invested" : "Current SIP"]}
                  />
                  <ReferenceLine y={c.corpus} stroke="var(--color-chart-3)" strokeDasharray="5 4" label={{ value: `Target ${inrCompact(c.corpus)}`, fill: "var(--color-accent-strong)", fontSize: 12, position: "insideTopLeft" }} />
                  <Area type="monotone" dataKey="withLeakStopped" stroke="var(--color-chart-2)" strokeWidth={2} fill="var(--color-chart-2)" fillOpacity={0.08} />
                  <Area type="monotone" dataKey="invested" stroke="var(--color-chart-1)" strokeWidth={2} fill="var(--color-chart-1)" fillOpacity={0.08} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Need · Want · Craving · Savings</CardTitle>
              <CardDescription>How savings quietly disappear — and where your month actually went</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { title: "Disciplined", parts: [["Need", 50], ["Savings", 50]] as const, note: "Needs covered, the rest invested" },
              { title: "Drifting", parts: [["Need", 50], ["Want", 25], ["Savings", 25]] as const, note: "Wants start eating savings" },
              { title: "Leaking", parts: [["Need", 50], ["Want", 25], ["Craving", 25]] as const, note: "Cravings take the rest — savings zero" },
            ].map((s) => (
              <div key={s.title} className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[110px_1fr_220px]">
                <div className="text-body font-medium">{s.title}</div>
                <div className="flex h-7 overflow-hidden rounded-lg">
                  {s.parts.map(([k, w]) => (
                    <div key={k} className="flex min-w-0 items-center justify-center truncate px-1 text-body font-medium" style={{ width: `${w}%`, background: kindMeta[k].color, color: kindMeta[k].fg }}>
                      {k}
                    </div>
                  ))}
                </div>
                <div className="text-body text-muted-foreground">{s.note}</div>
              </div>
            ))}
            <div className="mt-2 grid grid-cols-1 items-center gap-3 border-t border-border pt-4 sm:grid-cols-[110px_1fr_220px]">
              <div className="text-body font-semibold">Your month</div>
              <div className="flex h-9 overflow-hidden rounded-lg bg-muted">
                {actual.map((a) =>
                  a.v > 0 ? (
                    <div
                      key={a.k}
                      title={`${a.k}: ${inr(a.v)}`}
                      className="flex items-center justify-center overflow-hidden text-body font-medium transition-all duration-500"
                      style={{ width: `${(a.v / actualTotal) * 100}%`, background: kindMeta[a.k].color, color: kindMeta[a.k].fg }}
                    >
                      {a.v / actualTotal > 0.09 && `${Math.round((a.v / actualTotal) * 100)}%`}
                    </div>
                  ) : null,
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-body">
                {actual.map((a) => (
                  <span key={a.k} className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: kindMeta[a.k].color }} />
                    <span className="text-muted-foreground">{a.k}</span> <span className="font-medium tabular">{inrCompact(a.v)}</span>
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
