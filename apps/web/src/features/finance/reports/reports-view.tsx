"use client";

import { useState } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import { AlertTriangle, BarChart3, CheckCircle2, CircleDashed, Lock, LockOpen, Send, Table2, TrendingUp, Wallet, Landmark, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { BUSINESS_ASPIRATION, budgetCategories, cashFlow, FY_MONTHS, monthlyFinance, periodLocksSeed, pnlYtd, revenueTypes } from "@/lib/mock/finance";
import { useDemo } from "@/lib/store";
import { cn, inr, inrCompact, pct } from "@/lib/utils";
import { BizProgressChart, CashFlowCard, RevenueTypesCard } from "./charts";

// ───────────────────────────── local state ─────────────────────────────

interface ReportsState {
  locks: Record<string, { lockedOn: string; by: string }>;
  lock: (month: string) => void;
  definitionsSent: boolean;
  sendDefinitions: () => void;
}

const useReports = create<ReportsState>()((set) => ({
  locks: Object.fromEntries(periodLocksSeed.map((l) => [l.month, { lockedOn: l.lockedOn, by: l.by }])),
  lock: (month) => set((s) => ({ locks: { ...s.locks, [month]: { lockedOn: "25 Sep 2026", by: "you (Janarthanan)" } } })),
  definitionsSent: false,
  sendDefinitions: () => set({ definitionsSent: true }),
}));

const PERIODS = [
  { key: "fytd", label: "FY to date", sub: "Apr–Sep", months: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"] },
  { key: "q1", label: "Q1", sub: "Apr–Jun", months: ["Apr", "May", "Jun"] },
  { key: "q2", label: "Q2", sub: "Jul–Sep", months: ["Jul", "Aug", "Sep"] },
  { key: "aug", label: "Aug", sub: "Last closed", months: ["Aug"] },
  { key: "sep", label: "Sep", sub: "MTD · open", months: ["Sep"] },
] as const;

export function ReportsView() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("fytd");
  const p = PERIODS.find((x) => x.key === period)!;
  const months = [...p.months] as string[];
  const mf = monthlyFinance.filter((m) => months.includes(m.month));
  const revenue = mf.reduce((s, m) => s + (m.actualRevenue ?? 0), 0);
  const expense = mf.reduce((s, m) => s + (m.actualExpense ?? 0), 0);
  const goal = mf.reduce((s, m) => s + m.goalRevenue, 0);
  const collected = revenueTypes.filter((r) => months.includes(r.month)).reduce((s, r) => s + r.collected, 0);
  const closing = cashFlow.filter((r) => months.includes(r.month)).at(-1)?.closing ?? 0;
  const profit = revenue - expense;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[12.5px] font-medium text-muted-foreground">Period</span>
        {PERIODS.map((x) => (
          <button
            key={x.key}
            onClick={() => setPeriod(x.key)}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium transition",
              period === x.key ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {x.label}
            <span className="text-[11px] opacity-60">{x.sub}</span>
          </button>
        ))}
        <span className="ml-auto text-[12px] text-muted-foreground">{BUSINESS_ASPIRATION.fy} · Indian FY Apr–Mar · figures ex-GST</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Earned revenue" value={inrCompact(revenue)} icon={TrendingUp} tone="accent" delta={revenue / goal - 1} deltaLabel={`vs goal ${inrCompact(goal)}`} />
        <StatCard label="Collected" value={inrCompact(collected)} icon={Wallet} tone="success" hint={`${pct(collected / (revenue || 1))} of earned`} />
        <StatCard label="Expenses" value={inrCompact(expense)} icon={Receipt} tone="warning" hint={`${pct(expense / (revenue || 1))} of revenue`} />
        <StatCard
          label="Operating profit"
          value={inrCompact(profit)}
          icon={BarChart3}
          tone={profit / revenue >= BUSINESS_ASPIRATION.netMarginGoal ? "success" : "gold"}
          hint={`${pct(profit / (revenue || 1), 1)} margin · goal ${pct(BUSINESS_ASPIRATION.netMarginGoal)}`}
        />
        <StatCard label="Closing cash" value={inrCompact(closing)} icon={Landmark} tone="info" hint={`End of ${months.at(-1)} · HDFC + ICICI`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RevenueTypesCard months={months} />
        <CashFlowCard months={months} />
      </div>

      <BizProgressCard />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <BudgetCard />
        </div>
        <div className="xl:col-span-5">
          <PnlCard />
        </div>
      </div>

      <PeriodLockCard />
    </div>
  );
}

// ───────────────────────────── (b) Biz Progress Dashboard ─────────────────────────────

type Row = { label: string; kind: "month" | "quarter" | "fy"; prevRev: number; rev: number | null; goalRev: number; prevExp: number; exp: number | null; goalExp: number; goalRevToDate: number; goalExpToDate: number; month?: string };

function buildRows(): Row[] {
  const rows: Row[] = [];
  const agg = (label: string, kind: Row["kind"], ms: typeof monthlyFinance): Row => {
    const done = ms.filter((m) => m.actualRevenue !== null);
    return {
      label,
      kind,
      prevRev: ms.reduce((s, m) => s + m.prevRevenue, 0),
      rev: done.length ? done.reduce((s, m) => s + (m.actualRevenue ?? 0), 0) : null,
      goalRev: ms.reduce((s, m) => s + m.goalRevenue, 0),
      prevExp: ms.reduce((s, m) => s + m.prevExpense, 0),
      exp: done.length ? done.reduce((s, m) => s + (m.actualExpense ?? 0), 0) : null,
      goalExp: ms.reduce((s, m) => s + m.goalExpense, 0),
      goalRevToDate: done.reduce((s, m) => s + m.goalRevenue, 0),
      goalExpToDate: done.reduce((s, m) => s + m.goalExpense, 0),
    };
  };
  for (let q = 0; q < 4; q++) {
    const ms = monthlyFinance.slice(q * 3, q * 3 + 3);
    for (const m of ms) rows.push({ ...agg(m.month, "month", [m]), month: m.month });
    const qa = BUSINESS_ASPIRATION.quarters[q]!;
    rows.push(agg(`${qa.q} · ${qa.months}`, "quarter", ms));
  }
  rows.push(agg("FY 2026-27 total", "fy", monthlyFinance));
  return rows;
}

function revTone(v: number) {
  return v >= 0 ? "bg-success-soft text-success" : v >= -0.05 ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger";
}
function expTone(v: number) {
  return v <= 0 ? "bg-success-soft text-success" : v <= 0.03 ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger";
}
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}%`;

function BizProgressCard() {
  const [view, setView] = useState<"table" | "chart">("table");
  const locks = useReports((s) => s.locks);
  const rows = buildRows();
  return (
    <Card>
      <CardHeader className="flex-col gap-3 md:flex-row md:items-start">
        <div>
          <CardTitle>Biz Progress Dashboard</CardTitle>
          <CardDescription>
            Monthly revenue & expense — FY 2025-26 actual vs FY 2026-27 actual vs Business Aspiration goal ({inrCompact(BUSINESS_ASPIRATION.revenueGoal)} revenue ·{" "}
            {pct(BUSINESS_ASPIRATION.netMarginGoal)} net margin)
          </CardDescription>
        </div>
        <div className="inline-flex shrink-0 rounded-lg bg-muted p-0.5 text-[12px]">
          <button onClick={() => setView("table")} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition", view === "table" ? "bg-card shadow-sm" : "text-muted-foreground")}>
            <Table2 className="size-3.5" /> Table
          </button>
          <button onClick={() => setView("chart")} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition", view === "chart" ? "bg-card shadow-sm" : "text-muted-foreground")}>
            <BarChart3 className="size-3.5" /> Chart
          </button>
        </div>
      </CardHeader>
      {view === "chart" ? (
        <CardContent>
          <BizProgressChart />
        </CardContent>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH rowSpan={2} className="pl-5 align-bottom">
                Month
              </TH>
              <TH colSpan={4} className="border-l border-border text-center">
                Revenue
              </TH>
              <TH colSpan={4} className="border-l border-border text-center">
                Expense
              </TH>
            </TR>
            <TR>
              <TH className="border-l border-border text-right">FY 25-26</TH>
              <TH className="text-right">FY 26-27</TH>
              <TH className="text-right">Goal</TH>
              <TH className="text-right">vs goal</TH>
              <TH className="border-l border-border text-right">FY 25-26</TH>
              <TH className="text-right">FY 26-27</TH>
              <TH className="text-right">Budget</TH>
              <TH className="pr-5 text-right">vs budget</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => {
              const vsRev = r.rev !== null ? r.rev / (r.kind === "fy" ? r.goalRev : r.goalRevToDate) - (r.kind === "fy" ? 0 : 1) : null;
              const vsExp = r.exp !== null ? r.exp / r.goalExpToDate - 1 : null;
              const locked = r.month ? !!locks[r.month] : false;
              const open = r.month === "Sep";
              return (
                <TR key={r.label} className={cn(r.kind === "quarter" && "bg-muted/50 font-medium hover:bg-muted/50", r.kind === "fy" && "bg-muted font-semibold hover:bg-muted")}>
                  <TD className="pl-5">
                    <span className="inline-flex items-center gap-1.5">
                      {r.label}
                      {locked && <Lock className="size-3 text-muted-foreground" />}
                      {open && !locked && <Badge tone="info" className="px-1.5 py-0 text-[10px]">MTD</Badge>}
                    </span>
                  </TD>
                  <TD className="border-l border-border text-right text-muted-foreground tabular">{inrCompact(r.prevRev)}</TD>
                  <TD className="text-right tabular">
                    {r.rev !== null ? (
                      <>
                        {inrCompact(r.rev)}
                        {r.kind !== "fy" && (
                          <div className="text-[10.5px] font-normal text-muted-foreground">
                            {signed(r.rev / r.prevRev - 1)} YoY
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TD>
                  <TD className="text-right tabular">{inrCompact(r.goalRev)}</TD>
                  <TD className="text-right">
                    {vsRev === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : r.kind === "fy" ? (
                      <span className="inline-block rounded-md bg-accent-soft px-1.5 py-0.5 text-[11.5px] font-semibold text-accent tabular">{pct(vsRev)} of FY goal</span>
                    ) : (
                      <span className={cn("inline-block rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold tabular", revTone(vsRev))}>{signed(vsRev)}</span>
                    )}
                  </TD>
                  <TD className="border-l border-border text-right text-muted-foreground tabular">{inrCompact(r.prevExp)}</TD>
                  <TD className="text-right tabular">{r.exp !== null ? inrCompact(r.exp) : <span className="text-muted-foreground">—</span>}</TD>
                  <TD className="text-right tabular">{inrCompact(r.goalExp)}</TD>
                  <TD className="pr-5 text-right">
                    {vsExp === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={cn("inline-block rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold tabular", expTone(vsExp))}>{signed(vsExp)}</span>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border px-5 py-3 text-[11.5px] text-muted-foreground">
        <span>Quarter & FY “vs goal” compare against the goal for months with actuals only.</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" /> on/above goal · under budget
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warning" /> within 5% (rev) / 3% (exp)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-danger" /> off track
        </span>
      </div>
    </Card>
  );
}

// ───────────────────────────── (d) Budget vs actual ─────────────────────────────

function BudgetCard() {
  const totalB = budgetCategories.reduce((s, c) => s + c.budget, 0);
  const totalA = budgetCategories.reduce((s, c) => s + c.actual, 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Budget vs actual</CardTitle>
          <CardDescription>By cost category · Apr–Sep 2026 (ex-GST)</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground">Total variance</div>
          <div className={cn("text-[16px] font-semibold tabular", totalA > totalB ? "text-danger" : "text-success")}>
            {totalA > totalB ? "+" : "−"}
            {inr(Math.abs(totalA - totalB))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3.5">
        {budgetCategories.map((c) => {
          const ratio = c.actual / c.budget;
          const variance = c.actual - c.budget;
          const tone = ratio > 1.02 ? "danger" : ratio > 0.97 ? "warning" : "success";
          return (
            <div key={c.category}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <div className="min-w-0 truncate">
                  <span className="font-medium">{c.category}</span>
                  <span className="ml-2 text-[11.5px] text-muted-foreground">{c.note}</span>
                </div>
                <div className="flex shrink-0 items-baseline gap-3 tabular">
                  <span>
                    {inrCompact(c.actual)} <span className="text-muted-foreground">/ {inrCompact(c.budget)}</span>
                  </span>
                  <span
                    className={cn(
                      "w-20 text-right text-[12px] font-semibold",
                      tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-success",
                    )}
                  >
                    {variance > 0 ? "+" : variance < 0 ? "−" : "±"}
                    {inrCompact(Math.abs(variance)).replace("-", "")} · {Math.round(Math.abs(ratio - 1) * 100)}%
                  </span>
                </div>
              </div>
              <div className="relative mt-1.5">
                <Progress value={Math.min(ratio, 1) * 100} tone={tone} className="h-2" />
                {ratio > 1 && <div className="absolute -top-0.5 right-0 h-3 w-0.5 rounded bg-danger" />}
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between border-t border-border pt-3 text-[13px] font-semibold">
          <span>Total</span>
          <span className="tabular">
            {inr(totalA)} <span className="font-normal text-muted-foreground">/ {inr(totalB)}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ───────────────────────────── (e) P&L summary ─────────────────────────────

function PnlLine({ label, value, sub }: { label: string; value: number; sub?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-1 text-[13px]", sub ? "pl-4 text-muted-foreground" : "font-medium")}>
      <span>{label}</span>
      <span className="tabular">{sub ? `(${inrCompact(value)})` : inrCompact(value)}</span>
    </div>
  );
}

function PnlTotal({ label, value, rev, tone }: { label: string; value: number; rev: number; tone: string }) {
  return (
    <div className="my-1.5 flex items-center justify-between rounded-lg bg-muted/70 px-3 py-2 text-[13.5px] font-semibold">
      <span>{label}</span>
      <span className="flex items-baseline gap-2 tabular">
        {inrCompact(value)}
        <span className={cn("rounded-md px-1.5 py-0.5 text-[11px]", tone)}>{pct(value / rev, 1)}</span>
      </span>
    </div>
  );
}

function PnlCard() {
  const sent = useReports((s) => s.definitionsSent);
  const send = useReports((s) => s.sendDefinitions);
  const log = useDemo((s) => s.log);
  const rev = pnlYtd.revenue;
  const direct = pnlYtd.direct.reduce((s, x) => s + x.amount, 0);
  const gross = rev - direct;
  const variable = pnlYtd.variable.reduce((s, x) => s + x.amount, 0);
  const contribution = gross - variable;
  const fixed = pnlYtd.fixed.reduce((s, x) => s + x.amount, 0);
  const op = contribution - fixed;

  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>P&L summary</CardTitle>
          <CardDescription>FY 2026-27 to date (Apr–Sep) · management view</CardDescription>
        </div>
        <Badge tone="warning">Draft</Badge>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex gap-2.5 rounded-xl border border-warning/40 bg-warning-soft p-3 text-[12.5px]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <div className="font-semibold text-foreground">Definitions of gross profit, contribution and operating profit to be approved by Finance / Janarthanan</div>
            <div className="mt-0.5 text-muted-foreground">Proposed: direct = costs traceable to a video; variable overhead = scales with volume; fixed = everything else.</div>
            <Button
              size="xs"
              variant={sent ? "ghost" : "outline"}
              className="mt-2"
              disabled={sent}
              onClick={() => {
                send();
                toast.success("Definitions sent for approval", { description: "Janarthanan & Finance Desk will review in Monday's finance huddle" });
                log("P&L definitions (gross profit, contribution, operating profit) sent to Janarthanan for approval", "warning");
              }}
            >
              {sent ? (
                <>
                  <CheckCircle2 className="text-success" /> Sent · awaiting approval
                </>
              ) : (
                <>
                  <Send /> Send for approval
                </>
              )}
            </Button>
          </div>
        </div>
        <PnlLine label="Revenue (earned)" value={rev} />
        {pnlYtd.direct.map((x) => (
          <PnlLine key={x.label} label={x.label} value={x.amount} sub />
        ))}
        <PnlTotal label="Gross profit" value={gross} rev={rev} tone="bg-success-soft text-success" />
        {pnlYtd.variable.map((x) => (
          <PnlLine key={x.label} label={x.label} value={x.amount} sub />
        ))}
        <PnlTotal label="Contribution" value={contribution} rev={rev} tone="bg-info-soft text-info" />
        {pnlYtd.fixed.map((x) => (
          <PnlLine key={x.label} label={x.label} value={x.amount} sub />
        ))}
        <PnlTotal label="Operating profit" value={op} rev={rev} tone={op / rev >= BUSINESS_ASPIRATION.netMarginGoal ? "bg-success-soft text-success" : "bg-gold-soft text-gold"} />
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Goal: {pct(BUSINESS_ASPIRATION.netMarginGoal)} net margin · gap {inrCompact(rev * BUSINESS_ASPIRATION.netMarginGoal - op)} · founder remuneration below operating profit.
        </p>
      </CardContent>
    </Card>
  );
}

// ───────────────────────────── (f) Period locks ─────────────────────────────

function PeriodLockCard() {
  const locks = useReports((s) => s.locks);
  const lock = useReports((s) => s.lock);
  const log = useDemo((s) => s.log);
  const [confirm, setConfirm] = useState<string | null>(null);
  const openMonth = monthlyFinance.find((m) => m.actualRevenue !== null && !locks[m.month]);
  const checklist = [
    { label: "All September invoices issued (GM/26-27/046–055)", ok: true },
    { label: "Bank reconciled — HDFC & ICICI up to 24 Sep", ok: true },
    { label: "6 expense requests still pending approval", ok: false },
    { label: "Payroll & freelancer payouts posted", ok: true },
  ];
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Period lock status</CardTitle>
          <CardDescription>Locked months can&apos;t be edited — invoices, expenses and time logs are frozen for reporting</CardDescription>
        </div>
        <Badge tone="neutral">
          <Lock /> {Object.keys(locks).length} of 12 locked
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {FY_MONTHS.map((m, idx) => {
            const l = locks[m];
            const mf = monthlyFinance[idx]!;
            const future = mf.actualRevenue === null;
            const year = idx < 9 ? 2026 : 2027;
            return (
              <div
                key={m}
                className={cn(
                  "rounded-xl border p-3 transition",
                  l ? "border-border bg-muted/40" : future ? "border-dashed border-border opacity-60" : "border-info/40 bg-info-soft",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">
                    {m} {year}
                  </span>
                  {l ? <Lock className="size-3.5 text-muted-foreground" /> : future ? <CircleDashed className="size-3.5 text-muted-foreground" /> : <LockOpen className="size-3.5 text-info" />}
                </div>
                {l ? (
                  <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    Locked by {l.by} on {l.lockedOn}
                  </div>
                ) : future ? (
                  <div className="mt-1 text-[11px] text-muted-foreground">Not started</div>
                ) : (
                  <>
                    <div className="mt-1 text-[11px] text-info">Open · month-to-date</div>
                    <Button size="xs" variant="outline" className="mt-2 w-full" onClick={() => setConfirm(m)}>
                      <Lock /> Lock period
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock {confirm} 2026?</DialogTitle>
            <DialogDescription>After locking, changes need a founder unlock and are recorded in the audit trail.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ul className="space-y-2">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-[13px]">
                  {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />}
                  <span className={cn(!c.ok && "text-warning")}>{c.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Pending items will roll into October if you lock now.</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!confirm) return;
                lock(confirm);
                toast.success(`${confirm} 2026 locked`, { description: "Reports for the month are now final · audit entry created" });
                log(`Finance period ${confirm} 2026 locked by Janarthanan`, "success");
                setConfirm(null);
              }}
            >
              <Lock /> Lock {confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {!openMonth && (
        <div className="border-t border-border px-5 py-3 text-[12.5px] text-muted-foreground">
          <CheckCircle2 className="mr-1.5 inline size-4 text-success" /> All months with activity are locked. October opens on 1 Oct.
        </div>
      )}
    </Card>
  );
}
