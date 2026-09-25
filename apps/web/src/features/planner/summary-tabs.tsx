"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, Flame, Hourglass, Smile, TrendingDown, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/ui/feedback";
import { monthlyReport, weeklySummary } from "@/features/planner/calc";
import { usePlanner } from "@/features/planner/store";
import { axisProps, kindMeta, SectionLabel, tooltipStyle, years } from "@/features/planner/ui";
import { cn, inr, inrCompact } from "@/lib/utils";

export function WeeklyTab() {
  const log = usePlanner((s) => s.log);
  const weeks = useMemo(() => weeklySummary(log), [log]);
  const chart = weeks.map((w) => ({ name: w.label, Spend: w.spend, Leakage: w.leak }));
  const best = weeks.filter((w) => w.spend > 0).sort((a, b) => a.leakScore - b.leakScore)[0];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {weeks.map((w) => (
          <Card key={w.label} className={cn("p-4", w.spend === 0 && "opacity-60")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-body font-semibold">{w.label}</div>
                <div className="text-body text-muted-foreground">{w.period}</div>
              </div>
              {best && best.label === w.label && <Badge tone="success">Best week</Badge>}
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-heading font-semibold tabular">{w.leakScore}%</span>
              <span className="text-body text-muted-foreground">leakage score</span>
            </div>
            <Progress value={w.leakScore} tone={w.leakScore > 40 ? "danger" : w.leakScore > 20 ? "warning" : "success"} className="mt-2" />
            <div className="mt-3 grid grid-cols-2 gap-2 text-body">
              <div>
                <div className="text-muted-foreground">Spent</div>
                <div className="font-medium tabular">{inr(w.spend)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Leaked</div>
                <div className="font-medium text-danger tabular">{inr(w.leak)}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Weekly leakage summary</CardTitle>
              <CardDescription>Auto-calculated from your 30-day log</CardDescription>
            </div>
          </CardHeader>
          <Table>
            <THead>
              <TR>
                <TH>Week</TH>
                <TH numeric>Total spend</TH>
                <TH numeric>Leakage</TH>
                <TH numeric>15-yr @ 12%</TH>
                <TH numeric>Score</TH>
                <TH>Top emotion</TH>
                <TH numeric>Mood avg</TH>
              </TR>
            </THead>
            <TBody>
              {weeks.map((w) => (
                <TR key={w.label}>
                  <TD>
                    <div className="font-medium">{w.label}</div>
                    <div className="text-body text-muted-foreground">{w.period}</div>
                  </TD>
                  <TD numeric>{inr(w.spend)}</TD>
                  <TD numeric className="font-medium text-danger">{inr(w.leak)}</TD>
                  <TD numeric>{inrCompact(w.opp)}</TD>
                  <TD numeric>{w.leakScore}%</TD>
                  <TD className="text-body">{w.topEmotion ?? "—"}</TD>
                  <TD numeric>{w.mood ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Spend vs leakage</CardTitle>
              <CardDescription>By week</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} barGap={4}>
                  <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} width={48} tickFormatter={(v) => inrCompact(v)} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: "var(--color-muted)" }} formatter={(v) => inr(Number(v))} />
                  <Bar dataKey="Spend" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Leakage" fill="var(--color-danger)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function MonthlyTab() {
  const log = usePlanner((s) => s.log);
  const setup = usePlanner((s) => s.setup);
  const update = usePlanner((s) => s.updateSetup);
  const r = useMemo(() => monthlyReport(log, setup), [log, setup]);

  const pie = [
    { name: "Need", value: r.needs },
    { name: "Want", value: r.wants },
    { name: "Craving", value: r.cravings },
  ].filter((p) => p.value > 0);
  const emotions = r.emotions.filter((e) => e.count > 0).sort((a, b) => b.spent - a.spent);
  const maxEmotion = Math.max(1, ...emotions.map((e) => e.spent));
  const leakTypes = r.leakTypes.filter((l) => l.count > 0).sort((a, b) => b.leak - a.leak);

  return (
    <div className="space-y-5">
      {/* Headline */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-body font-medium text-danger">
              <Flame className="size-4" /> This month&apos;s leakage
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
              <span className="text-heading font-semibold leading-none tracking-tight tabular">{inr(r.leak)}</span>
              <span className="text-body text-muted-foreground">{(r.leakScore * 100).toFixed(1)}% of {inr(r.total)} spent</span>
            </div>
            <p className="mt-3 max-w-lg text-body text-muted-foreground">
              If {setup.name || "you"} invested this leakage every month at 12% for 15 years, it would grow to{" "}
              <span className="font-semibold text-foreground">{inr(r.fv15)}</span>.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-secondary p-5">
            <div className="text-body font-semibold uppercase tracking-wider text-muted-foreground">The retirement freedom calculation</div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <div className="text-body text-muted-foreground">Stop leakage → retire at</div>
                <div className="text-heading font-semibold text-success tabular">{Number.isFinite(r.retireAgeLeakStopped) ? r.retireAgeLeakStopped.toFixed(1) : "—"}</div>
              </div>
              <div>
                <div className="text-body text-muted-foreground">Keep leaking → retire at</div>
                <div className="text-heading font-semibold tabular">{Number.isFinite(r.retireAgeWithLeak) ? r.retireAgeWithLeak.toFixed(1) : "—"}</div>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-body text-danger">
              <span className="font-semibold">{years(r.yearsLost)}</span> of freedom lost to leakage
            </div>
          </div>
        </div>
      </Card>

      {/* Section 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total spent" value={inr(r.total)} icon={Wallet} tone="info" hint={`${log.length} entries`} />
        <StatCard label="Leakage score" value={`${(r.leakScore * 100).toFixed(1)}%`} icon={TrendingDown} tone="danger" hint="Leakage ÷ total spend" />
        <StatCard label="48-hr rule used" value={`${r.ruleUsed}×`} icon={Hourglass} tone="success" hint="Wants you paused on" />
        <StatCard label="Avg mood after" value={r.mood ?? "—"} icon={Smile} tone="gold" hint="1 = regret · 5 = happy" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Where it went</CardTitle>
              <CardDescription>Need · Want · Craving</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
                    {pie.map((p) => (
                      <Cell key={p.name} fill={kindMeta[p.name as "Need"].color} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v) => inr(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-body text-muted-foreground">Spent</div>
                <div className="text-subheading font-semibold tabular">{inrCompact(r.total)}</div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {(["Need", "Want", "Craving"] as const).map((k) => {
                const v = k === "Need" ? r.needs : k === "Want" ? r.wants : r.cravings;
                return (
                  <div key={k} className="flex items-center justify-between text-body">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: kindMeta[k].color }} />
                      {k}s
                    </span>
                    <span className="tabular">
                      {inr(v)} <span className="text-muted-foreground">· {r.total ? Math.round((v / r.total) * 100) : 0}%</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Emotion spending profile</CardTitle>
              <CardDescription>What you felt before you spent</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {emotions.length === 0 && <EmptyState compact icon={Smile} title="No entries yet" description="Log spends in the Daily Log to see which feelings drive them." />}
            {emotions.map((e) => (
              <div key={e.emotion}>
                <div className="flex items-center justify-between text-body">
                  <span>
                    {e.emotion} <span className="text-muted-foreground">· {e.count}×</span>
                  </span>
                  <span className="shrink-0 tabular">
                    {inr(e.spent)}
                    {e.leak > 0 && <span className="text-danger"> · {inrCompact(e.leak)} leaked</span>}
                  </span>
                </div>
                <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-primary/25" style={{ width: `${(e.spent / maxEmotion) * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 rounded-full bg-danger" style={{ width: `${(e.leak / maxEmotion) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Leak types</CardTitle>
              <CardDescription>Which flow pattern is draining you</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {leakTypes.length === 0 ? (
              <EmptyState compact icon={TrendingDown} title="No leaks logged" description="Leak types appear once a Want or Craving counts as leakage." />
            ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leakTypes} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="type" {...axisProps} width={92} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: "var(--color-muted)" }} formatter={(v, n) => [inr(Number(v)), n === "leak" ? "Leakage" : "Spent"]} />
                  <Bar dataKey="spent" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} barSize={8} />
                  <Bar dataKey="leak" fill="var(--color-danger)" radius={[0, 4, 4, 0]} barSize={8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 3 */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Opportunity cost & retirement impact</CardTitle>
            <CardDescription>Same maths as the Way To Fortune monthly report</CardDescription>
          </div>
          <CalendarClock className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="divide-y divide-border rounded-xl border border-border">
            {[
              ["Your monthly leakage", inr(r.leak)],
              ["If invested monthly @ 12% for 15 years", inr(r.fv15)],
              ["Monthly income", inr(setup.monthlyIncome)],
              ["Monthly lifestyle expense (50%)", inr(r.setup.monthlyLifestyle)],
              [`Monthly expense at retirement (inflation @ ${setup.inflation}%)`, inr(r.setup.monthlyAtRetirement)],
              ["Annual expense at retirement", inr(r.setup.annualAtRetirement)],
              ["Corpus required (25× annual expense)", inr(r.setup.corpus)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5 text-body">
                <span className="min-w-0 text-muted-foreground">{k}</span>
                <span className="shrink-0 font-medium tabular">{v}</span>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div>
              <SectionLabel>Your current monthly SIP / investment</SectionLabel>
              <div className="relative max-w-60">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-muted-foreground">₹</span>
                <Input
                  className="pl-7 tabular"
                  value={setup.monthlySip.toLocaleString("en-IN")}
                  onChange={(e) => update({ monthlySip: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border p-4">
                <div className="text-body text-muted-foreground">Years to corpus — without stopping leakage</div>
                <div className="mt-1 text-heading font-semibold tabular">{years(r.yearsWithLeak, 2)}</div>
              </div>
              <div className="rounded-xl border border-success/30 bg-success-soft p-4">
                <div className="text-body text-success">Years to corpus — leakage stopped & invested</div>
                <div className="mt-1 text-heading font-semibold text-success tabular">{years(r.yearsLeakStopped, 2)}</div>
              </div>
            </div>
            <p className="text-body text-muted-foreground">
              Change the SIP to see the freedom gap move. Ages use your current age ({setup.age}) plus the years needed to reach {inrCompact(r.setup.corpus)}.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
