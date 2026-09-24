"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Megaphone, RotateCcw, Users, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, inr, inrCompact } from "@/lib/utils";
import { CAPACITY_HISTORY, FUNNEL_HISTORY, nowStamp } from "./goals-data";
import { useGoals } from "./goals-store";

const tooltipStyle = {
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
  cursor: { fill: "var(--muted)" },
};
const axisProps = { tickLine: false, axisLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 11 } } as const;

type Inputs = typeof FUNNEL_HISTORY & typeof CAPACITY_HISTORY;
type Key = keyof Inputs;
const HISTORY: Inputs = { ...FUNNEL_HISTORY, ...CAPACITY_HISTORY };

const L = 100_000;
const pctFmt = (v: number) => `${Math.round(v * 100)}%`;

interface SliderDef {
  key: Key;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  historyLabel?: string;
}

const REVENUE_SLIDERS: SliderDef[] = [
  { key: "revenueTarget", label: "FY revenue target", min: 80 * L, max: 200 * L, step: 5 * L, fmt: inrCompact, historyLabel: "Business Aspiration" },
  { key: "baseBook", label: "Existing retainer book (annualised)", min: 40 * L, max: 120 * L, step: L, fmt: inrCompact },
  { key: "retention", label: "Renewal retention", min: 0.5, max: 1, step: 0.01, fmt: pctFmt },
  { key: "churn", label: "Mid-year churn / downgrades", min: 0, max: 0.2, step: 0.01, fmt: pctFmt },
];
const FUNNEL_SLIDERS: SliderDef[] = [
  { key: "avgDeal", label: "Avg deal value (annualised retainer)", min: 2 * L, max: 15 * L, step: 0.5 * L, fmt: inrCompact },
  { key: "winRate", label: "Win rate (proposal → won)", min: 0.1, max: 0.6, step: 0.01, fmt: pctFmt },
  { key: "proposalRate", label: "Proposal rate (qualified → proposal)", min: 0.2, max: 0.8, step: 0.01, fmt: pctFmt },
  { key: "qualRate", label: "Qualification rate (lead → qualified)", min: 0.1, max: 0.6, step: 0.01, fmt: pctFmt },
  { key: "cpl", label: "Cost per lead (Meta ads)", min: 200, max: 1200, step: 25, fmt: inr },
];
const CAPACITY_SLIDERS: SliderDef[] = [
  { key: "editors", label: "Editors", min: 1, max: 6, step: 1, fmt: (v) => String(v) },
  { key: "productiveHrs", label: "Productive hrs / editor / month", min: 100, max: 180, step: 5, fmt: (v) => `${v}h` },
  { key: "hrsPerVideo", label: "Avg edit hrs per video", min: 3, max: 8, step: 0.5, fmt: (v) => `${v}h` },
  { key: "unitsPerClient", label: "Videos / month per new client", min: 2, max: 12, step: 1, fmt: (v) => String(v) },
];

export function RevenueBreakdown() {
  const [v, setV] = React.useState<Inputs>(HISTORY);
  const [manual, setManual] = React.useState<Set<Key>>(new Set());
  const updateGoal = useGoals((s) => s.updateGoal);

  const set = (k: Key, val: number) => {
    setV((s) => ({ ...s, [k]: val }));
    setManual((m) => new Set(m).add(k));
  };
  const reset = (k: Key) => {
    setV((s) => ({ ...s, [k]: HISTORY[k] }));
    setManual((m) => {
      const n = new Set(m);
      n.delete(k);
      return n;
    });
  };
  const resetAll = () => {
    setV(HISTORY);
    setManual(new Set());
    toast("All inputs reset to history");
  };

  // ── Model ──
  const renewals = v.baseBook * v.retention;
  const churnAmt = v.baseBook * v.churn;
  const kept = renewals - churnAmt;
  const newNeeded = Math.max(0, v.revenueTarget - kept);
  const deals = Math.ceil(newNeeded / v.avgDeal);
  const proposals = Math.ceil(deals / v.winRate);
  const qualified = Math.ceil(proposals / v.proposalRate);
  const leads = Math.ceil(qualified / v.qualRate);
  const leadsPerMonth = Math.ceil(leads / v.months);
  const adBudget = leads * v.cpl;
  const adPerMonth = adBudget / v.months;

  const keptLoad = v.currentLoad * (v.retention - v.churn);
  const newLoad = deals * v.unitsPerClient;
  const required = Math.round(keptLoad + newLoad);
  const capacity = Math.floor((v.editors * v.productiveHrs) / v.hrsPerVideo);
  const util = required / Math.max(1, capacity);
  const capTone: "success" | "warning" | "danger" = util <= 0.85 ? "success" : util <= 1 ? "warning" : "danger";
  const hires = Math.max(0, Math.ceil(((required - capacity) * v.hrsPerVideo) / v.productiveHrs));

  const waterfall = [
    { name: "Base book", base: 0, value: v.baseBook, color: "var(--chart-5)", sign: "" },
    { name: "Not renewed", base: renewals, value: v.baseBook - renewals, color: "var(--danger)", sign: "−" },
    { name: "Churn", base: kept, value: churnAmt, color: "var(--warning)", sign: "−" },
    { name: "New sales", base: kept, value: newNeeded, color: "var(--accent)", sign: "+" },
    { name: "FY target", base: 0, value: v.revenueTarget, color: "var(--success)", sign: "" },
  ];

  const funnel = [
    { label: "Leads (MQL)", value: leads, note: `${pctFmt(v.qualRate)} become sales-qualified` },
    { label: "Sales-qualified", value: qualified, note: `${pctFmt(v.proposalRate)} get a proposal` },
    { label: "Proposals", value: proposals, note: `${pctFmt(v.winRate)} are won` },
    { label: "Deals won", value: deals, note: `× ${inrCompact(v.avgDeal)} avg = ${inrCompact(deals * v.avgDeal)}` },
  ];

  function applyToGoals() {
    const at = nowStamp();
    const by = "Janarthanan";
    updateGoal("g-sales-clients", { target: deals }, { at, by, text: `Target set to ${deals} from Revenue breakdown.` });
    updateGoal("g-sales-revenue", { target: Math.round(newNeeded) }, { at, by, text: `Target set to ${inrCompact(newNeeded)} from Revenue breakdown.` });
    updateGoal("i-priya-proposals", { target: proposals }, { at, by, text: `Target set to ${proposals} from Revenue breakdown.` });
    updateGoal("g-mkt-leads", { target: leads }, { at, by, text: `Target set to ${leads} MQLs from Revenue breakdown.` });
    toast.success("Sales & Marketing targets updated", {
      description: `${deals} clients · ${inrCompact(newNeeded)} new · ${proposals} proposals · ${leads} MQLs — see Goal tree`,
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      {/* Inputs */}
      <Card className="h-fit">
        <CardHeader>
          <div>
            <CardTitle>Assumptions</CardTitle>
            <CardDescription>Pre-filled from FY 2025-26 history. Move a slider to override.</CardDescription>
          </div>
          <Button variant="ghost" size="xs" onClick={resetAll} disabled={manual.size === 0}>
            <RotateCcw /> Reset all
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <SliderGroup title="Revenue mix" defs={REVENUE_SLIDERS} v={v} manual={manual} set={set} reset={reset} />
          <SliderGroup title="Sales funnel" defs={FUNNEL_SLIDERS} v={v} manual={manual} set={set} reset={reset} />
          <SliderGroup title="Editing capacity" defs={CAPACITY_SLIDERS} v={v} manual={manual} set={set} reset={reset} />
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-4">
        {/* Waterfall */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Where {inrCompact(v.revenueTarget)} comes from</CardTitle>
              <CardDescription>
                Renewals (base × retention) − churn + new sales = FY target
              </CardDescription>
            </div>
            <Button size="sm" variant="accent" onClick={applyToGoals}>
              <Wand2 /> Apply to goals
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Renewals kept" value={inrCompact(kept)} sub={`${inrCompact(renewals)} renewed − ${inrCompact(churnAmt)} churn`} dot="bg-chart-5" />
              <Metric label="New sales needed" value={inrCompact(newNeeded)} sub={`${Math.round((newNeeded / v.revenueTarget) * 100)}% of target`} dot="bg-accent" />
              <Metric label="Lost from base book" value={inrCompact(v.baseBook - kept)} sub="Not renewed + churn" dot="bg-danger" />
            </div>

            {/* composition bar */}
            <div className="mt-5">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full bg-chart-5" animate={{ width: `${(kept / v.revenueTarget) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                <motion.div className="h-full bg-accent" animate={{ width: `${(newNeeded / v.revenueTarget) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[11.5px] text-muted-foreground">
                <span>Renewals {Math.round((kept / v.revenueTarget) * 100)}%</span>
                <span>New sales {Math.round((newNeeded / v.revenueTarget) * 100)}%</span>
              </div>
            </div>

            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfall} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} width={52} tickFormatter={(x: number) => inrCompact(x)} />
                  <Tooltip
                    cursor={tooltipStyle.cursor}
                    content={({ active, payload }) => {
                      const d = payload?.[0]?.payload as (typeof waterfall)[number] | undefined;
                      if (!active || !d) return null;
                      return (
                        <div style={tooltipStyle.contentStyle}>
                          <div style={tooltipStyle.labelStyle}>{d.name}</div>
                          <div className="tabular">
                            {d.sign}
                            {inrCompact(d.value)}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
                  <Bar dataKey="value" stackId="w" radius={[4, 4, 4, 4]} animationDuration={500}>
                    {waterfall.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Funnel */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Sales funnel needed</CardTitle>
                <CardDescription>Worked backwards from {inrCompact(newNeeded)} of new sales</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {funnel.map((f, i) => (
                <div key={f.label}>
                  <div className="mb-1 flex items-baseline justify-between text-[13px]">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-[18px] font-semibold tracking-tight tabular">{f.value}</span>
                  </div>
                  <div className="h-7 w-full rounded-md bg-muted/60">
                    <motion.div
                      className={cn("h-full rounded-md", ["bg-accent/30", "bg-accent/50", "bg-accent/75", "bg-accent"][i])}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(3, (f.value / Math.max(1, leads)) * 100)}%` }}
                      transition={{ type: "spring", stiffness: 110, damping: 18, delay: i * 0.05 }}
                    />
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">{f.note}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Marketing demand */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Marketing demand</CardTitle>
                  <CardDescription>Spread over {v.months} months · CPL {inr(v.cpl)}</CardDescription>
                </div>
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-info-soft text-info">
                  <Megaphone className="size-4" />
                </span>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Leads / month" value={String(leadsPerMonth)} sub={`${leads} for the year`} />
                  <Metric label="Ad budget / month" value={inr(adPerMonth)} sub={`${inrCompact(adBudget)} for the year`} />
                </div>
                <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-[12.5px]">
                  {leads <= 240 ? (
                    <span>
                      Marketing goal of <b>240 MQLs</b> covers this with a buffer of <b className="tabular">{240 - leads}</b> leads.
                    </span>
                  ) : (
                    <span className="text-warning">
                      Needs <b className="tabular">{leads}</b> MQLs — {leads - 240} more than the current 240 goal. Apply to goals to raise it.
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Capacity */}
            <Card
              className={cn(
                capTone === "danger" && "border-danger/40",
                capTone === "warning" && "border-warning/40",
              )}
            >
              <CardHeader>
                <div>
                  <CardTitle>Capacity check</CardTitle>
                  <CardDescription>Q4 run-rate videos / month vs editing capacity</CardDescription>
                </div>
                <Badge tone={capTone} dot>
                  {capTone === "success" ? "Healthy" : capTone === "warning" ? "Tight" : "Over capacity"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-[26px] font-semibold tracking-tight tabular">{required}</span>
                  <span className="text-[13px] text-muted-foreground">needed</span>
                  <ArrowRight className="size-3.5 self-center text-muted-foreground" />
                  <span className="text-[26px] font-semibold tracking-tight tabular">{capacity}</span>
                  <span className="text-[13px] text-muted-foreground">capacity</span>
                  <span className={cn("ml-auto text-[15px] font-semibold tabular", { success: "text-success", warning: "text-warning", danger: "text-danger" }[capTone])}>{Math.round(util * 100)}%</span>
                </div>
                <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className={cn("h-full rounded-full", capTone === "success" ? "bg-success" : capTone === "warning" ? "bg-warning" : "bg-danger")}
                    animate={{ width: `${Math.min(100, util * 100)}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                </div>
                <div className="mt-2 space-y-0.5 text-[12px] text-muted-foreground tabular">
                  <div>
                    Load = existing {v.currentLoad} × {pctFmt(v.retention - v.churn)} kept ({Math.round(keptLoad)}) + {deals} new × {v.unitsPerClient} ({newLoad})
                  </div>
                  <div>
                    Capacity = {v.editors} editors × {v.productiveHrs}h ÷ {v.hrsPerVideo}h per video
                  </div>
                </div>
                <div
                  className={cn(
                    "mt-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[13px]",
                    capTone === "success" && "bg-success-soft text-success",
                    capTone === "warning" && "bg-warning-soft text-warning",
                    capTone === "danger" && "bg-danger-soft text-danger",
                  )}
                >
                  <span className="font-medium">
                    {capTone === "danger"
                      ? `Hire ${hires} editor${hires > 1 ? "s" : ""} by Nov`
                      : capTone === "warning"
                        ? "Tight — book freelancer overflow for Q4 peaks"
                        : "Team can absorb the new clients"}
                  </span>
                  {capTone === "danger" && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        toast.success("Hiring request raised", {
                          description: `${hires} video editor${hires > 1 ? "s" : ""} · join by 15 Nov · assigned to Harini Selvam`,
                        })
                      }
                    >
                      <Users /> Raise hiring request
                    </Button>
                  )}
                </div>
                {v.hrsPerVideo > 4 && (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    If Divya&apos;s edit-time goal (4h) lands, capacity rises to{" "}
                    <b className="text-foreground tabular">{Math.floor((v.editors * v.productiveHrs) / 4)}</b> videos / month.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, dot }: { label: string; value: string; sub?: string; dot?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        {dot && <span className={cn("size-2 rounded-sm", dot)} />}
        {label}
      </div>
      <div className="mt-1 text-[20px] font-semibold tracking-tight tabular">{value}</div>
      {sub && <div className="text-[11.5px] text-muted-foreground tabular">{sub}</div>}
    </div>
  );
}

function SliderGroup({
  title,
  defs,
  v,
  manual,
  set,
  reset,
}: {
  title: string;
  defs: SliderDef[];
  v: Inputs;
  manual: Set<Key>;
  set: (k: Key, val: number) => void;
  reset: (k: Key) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {defs.map((d) => {
        const isManual = manual.has(d.key);
        return (
          <div key={d.key}>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={`sl-${d.key}`} className="text-[13px]">
                {d.label}
              </label>
              <span className="text-[13px] font-semibold tabular">{d.fmt(v[d.key])}</span>
            </div>
            <input
              id={`sl-${d.key}`}
              type="range"
              min={d.min}
              max={d.max}
              step={d.step}
              value={v[d.key]}
              onChange={(e) => set(d.key, Number(e.target.value))}
              className="mt-1.5 h-1.5 w-full cursor-pointer accent-accent"
            />
            <div className="mt-0.5 flex items-center justify-between text-[11px]">
              {isManual ? (
                <span className="inline-flex items-center gap-1 text-warning">
                  <span className="size-1.5 rounded-full bg-current" /> source: manual
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-success" /> source: {d.historyLabel ?? "history"}
                </span>
              )}
              {isManual && (
                <button type="button" onClick={() => reset(d.key)} className="cursor-pointer text-accent hover:underline">
                  Reset to {d.historyLabel ? "plan" : "history"} ({d.fmt(HISTORY[d.key])})
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
