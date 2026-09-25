"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CategoryBadge } from "@/components/shared/video-bits";
import { clientById, cycles } from "@/lib/mock/core";
import { cn, inr, inrCompact, pct } from "@/lib/utils";
import { marginTone } from "./model";
import { axisProps, tooltipStyle } from "./chart";
import { useVideoCosts } from "./video-costs";

const cycleStatusTone = { closed: "neutral", reconciling: "warning", "in-progress": "accent", upcoming: "outline" } as const;

export function ClientProfitability() {
  const [period, setPeriod] = useState<"Aug 2026" | "Sep 2026">("Aug 2026");
  const rows = cycles
    .filter((c) => c.label === period)
    .map((c) => {
      const cl = clientById(c.clientId);
      const margin = c.revenue - c.cost;
      return { ...c, client: cl, short: cl.name.split(" ").slice(0, cl.name.startsWith("Sri") ? 2 : 1).join(" "), margin, marginPct: margin / c.revenue, perUnit: c.delivered ? c.cost / c.delivered : 0 };
    })
    .sort((a, b) => b.marginPct - a.marginPct);
  const tot = rows.reduce((a, r) => ({ rev: a.rev + r.revenue, cost: a.cost + r.cost }), { rev: 0, cost: 0 });

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Profitability by client cycle</CardTitle>
            <CardDescription>
              Cycle revenue vs true cost · {period === "Sep 2026" ? "costs to date (cycle open)" : "closed / reconciling cycles"}
            </CardDescription>
          </div>
          <div className="inline-flex rounded-lg bg-muted p-1 text-body">
            {(["Aug 2026", "Sep 2026"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn("cursor-pointer rounded-md px-2.5 py-1 font-medium transition", period === p ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {p}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={4}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="short" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(x: number) => inrCompact(x)} width={56} />
                <Tooltip {...tooltipStyle} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} formatter={(x) => inr(Number(x))} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--color-muted-foreground)" }} />
                <Bar dataKey="revenue" name="Revenue" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={34} />
                <Bar dataKey="cost" name="True cost" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Margin ranking · {period}</CardTitle>
            <CardDescription>
              Blended {pct((tot.rev - tot.cost) / tot.rev)} on {inr(tot.rev)} cycle revenue
            </CardDescription>
          </div>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Client</TH>
              <TH className="text-right">Units</TH>
              <TH className="text-right">Cost / unit</TH>
              <TH className="pr-5 text-right">Margin</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="pl-5">
                  <div className="font-medium">{r.client.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <CategoryBadge category={r.client.category} />
                    <Badge tone={cycleStatusTone[r.status]}>{r.status}</Badge>
                  </div>
                </TD>
                <TD className="text-right tabular text-muted-foreground">
                  {r.delivered}/{r.promised}
                </TD>
                <TD className="text-right tabular">{r.perUnit ? inr(r.perUnit) : "—"}</TD>
                <TD className="pr-5 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={marginTone(r.marginPct)} className="tabular">
                      {pct(r.marginPct)}
                    </Badge>
                    <span className="text-body text-muted-foreground tabular">{inr(r.margin)}</span>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <FormatInsight />
    </div>
  );
}

function FormatInsight() {
  const { rows } = useVideoCosts();
  const byFormat = new Map<string, { rev: number; cost: number; n: number }>();
  rows.forEach((r) => {
    const f = byFormat.get(r.video.format) ?? { rev: 0, cost: 0, n: 0 };
    f.rev += r.revenue;
    f.cost += r.projected;
    f.n += 1;
    byFormat.set(r.video.format, f);
  });
  const list = [...byFormat.entries()].map(([format, f]) => ({ format, ...f, m: (f.rev - f.cost) / f.rev })).sort((a, b) => a.m - b.m);
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Margin by format · Sep 2026</CardTitle>
          <CardDescription>Where the package price and the real effort disagree</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {list.map((f) => {
          const tone = marginTone(f.m);
          return (
            <div key={f.format} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-body font-medium">{f.format}</span>
                <span className="text-body text-muted-foreground">{f.n} videos</span>
              </div>
              <div className={cn("mt-1 text-heading font-semibold tabular", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-success")}>
                {pct(f.m)}
              </div>
              <div className="text-body text-muted-foreground tabular">
                {inr(f.cost / f.n)} cost vs {inr(f.rev / f.n)} revenue
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
