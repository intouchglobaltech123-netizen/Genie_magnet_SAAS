"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cashFlow, monthlyFinance, OPENING_CASH_APR, REVENUE_TYPE_DEFS, revenueTypes } from "@/lib/mock/finance";
import { cn, inr, inrCompact } from "@/lib/utils";
import { axisProps, tooltipStyle } from "../chart-style";

const TYPES = [
  { key: "contracted", label: "Contracted", color: "var(--chart-5)", dot: "bg-chart-5" },
  { key: "invoiced", label: "Invoiced", color: "var(--chart-1)", dot: "bg-chart-1" },
  { key: "earned", label: "Earned", color: "var(--chart-3)", dot: "bg-chart-3" },
  { key: "collected", label: "Collected", color: "var(--chart-2)", dot: "bg-chart-2" },
] as const;

const fmtTip = (v: unknown) => inr(Number(v));

export function RevenueTypesCard({ months }: { months: string[] }) {
  const data = revenueTypes.filter((r) => months.includes(r.month));
  const sums = TYPES.map((t) => ({ ...t, value: data.reduce((s, r) => s + r[t.key], 0) }));
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Revenue types</CardTitle>
          <CardDescription>Four views of the same rupee — hover a label for its definition · ex-GST</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {sums.map((t, idx) => (
            <Tooltip key={t.key} content={REVENUE_TYPE_DEFS[t.key]}>
              <div className="cursor-help rounded-xl border border-border px-3 py-2.5 transition hover:bg-muted/50">
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <span className={cn("size-2 rounded-sm", t.dot)} />
                  {t.label}
                  <Info className="size-3 opacity-60" />
                </div>
                <div className="mt-0.5 text-[17px] font-semibold tabular">{inrCompact(t.value)}</div>
                {idx > 0 && (
                  <div className="text-[11px] text-muted-foreground tabular">{Math.round((t.value / (sums[0]!.value || 1)) * 100)}% of contracted</div>
                )}
                {idx === 0 && <div className="text-[11px] text-muted-foreground">Signed commitments</div>}
              </div>
            </Tooltip>
          ))}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v: number) => inrCompact(v)} width={60} />
              <RTooltip {...tooltipStyle} formatter={fmtTip} />
              {TYPES.map((t) => (
                <Bar key={t.key} dataKey={t.key} name={t.label} fill={t.color} radius={[4, 4, 0, 0]} maxBarSize={22} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground">Sep is month-to-date (period open). Kaveri & Sri Lakshmi are invoiced and paid at the end of the previous month, so Sep collections look light and Oct advances already sit in Sep invoicing.</p>
      </CardContent>
    </Card>
  );
}

export function BizProgressChart() {
  const [metric, setMetric] = useState<"revenue" | "expense">("revenue");
  const data = monthlyFinance.map((m) => ({
    month: m.month,
    prev: metric === "revenue" ? m.prevRevenue : m.prevExpense,
    goal: metric === "revenue" ? m.goalRevenue : m.goalExpense,
    actual: metric === "revenue" ? m.actualRevenue : m.actualExpense,
  }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-4 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-sm", metric === "revenue" ? "bg-chart-1" : "bg-chart-4")} />
            FY 2026-27 actual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-chart-3" />
            {metric === "revenue" ? "Goal" : "Budget"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-chart-5" />
            FY 2025-26
          </span>
        </div>
        <div className="inline-flex rounded-lg bg-muted p-0.5 text-[12px]">
          {(["revenue", "expense"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className={cn("cursor-pointer rounded-md px-2.5 py-1 font-medium capitalize transition", metric === k ? "bg-card shadow-sm" : "text-muted-foreground")}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={(v: number) => inrCompact(v)} width={60} />
            <RTooltip {...tooltipStyle} formatter={(v) => (v == null ? "—" : inr(Number(v)))} />
            <Bar dataKey="actual" name="FY 2026-27 actual" fill={metric === "revenue" ? "var(--chart-1)" : "var(--chart-4)"} radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Line type="monotone" dataKey="goal" name={metric === "revenue" ? "Goal" : "Budget"} stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            <Line type="monotone" dataKey="prev" name="FY 2025-26" stroke="var(--chart-5)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--chart-5)" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CashFlowCard({ months }: { months: string[] }) {
  const data = cashFlow.filter((r) => months.includes(r.month));
  const firstIdx = cashFlow.findIndex((r) => r.month === data[0]?.month);
  const opening = firstIdx > 0 ? cashFlow[firstIdx - 1]!.closing : OPENING_CASH_APR;
  const inflow = data.reduce((s, r) => s + r.inflow, 0);
  const outflow = data.reduce((s, r) => s + r.outflow, 0);
  const closing = data.at(-1)?.closing ?? opening;
  const avgOut = cashFlow.reduce((s, r) => s + r.outflow, 0) / cashFlow.length;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Cash flow</CardTitle>
          <CardDescription>Bank inflows vs outflows (incl. GST & TDS remittances) · closing balance line</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Mini label="Opening" value={inrCompact(opening)} />
          <Mini label="Inflows" value={`+${inrCompact(inflow)}`} className="text-success" />
          <Mini label="Outflows" value={`−${inrCompact(outflow)}`} className="text-danger" />
          <Mini label="Closing" value={inrCompact(closing)} sub={`${(closing / avgOut).toFixed(1)} months runway`} />
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 4, left: -4, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis yAxisId="flow" {...axisProps} tickFormatter={(v: number) => inrCompact(v)} width={60} />
              <YAxis yAxisId="bal" orientation="right" {...axisProps} tickFormatter={(v: number) => inrCompact(v)} width={56} />
              <RTooltip {...tooltipStyle} formatter={fmtTip} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
              <Bar yAxisId="flow" dataKey="inflow" name="Inflows" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar yAxisId="flow" dataKey="outflow" name="Outflows" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Line yAxisId="bal" type="monotone" dataKey="closing" name="Closing balance" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--chart-1)" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.map((r) => (
            <span key={r.month} className={cn("rounded-md px-2 py-0.5 text-[11.5px] tabular", r.net >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
              {r.month} net {r.net >= 0 ? "+" : "−"}
              {inrCompact(Math.abs(r.net)).replace("-", "")}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2.5">
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className={cn("text-[16px] font-semibold tabular", className)}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
