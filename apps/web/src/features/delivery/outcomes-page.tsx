"use client";

import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Database, FileBarChart, Loader2, PenLine, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { clientById, clients } from "@/lib/mock/core";
import { outcomes } from "@/lib/mock/delivery";
import { cn, pct } from "@/lib/utils";
import { fmtKpi, ReportDialog } from "./report-dialog";

const nf = new Intl.NumberFormat("en-IN");
const compact = (n: number) => (n >= 100000 ? `${(n / 100000).toFixed(1)}L` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n));

const tooltipStyle = {
  contentStyle: { background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 13 },
  labelStyle: { color: "var(--color-text-muted)" },
};

export function OutcomesPage() {
  const [clientId, setClientId] = useState("c-kaveri");
  const [generating, setGenerating] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [refreshed, setRefreshed] = useState<Record<string, boolean>>({});
  const data = outcomes.find((o) => o.clientId === clientId)!;
  const client = clientById(clientId);

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setReportOpen(true);
      toast.success("Report generated", { description: `${client.name} · September 2026 · 1 page` });
    }, 900);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Client Delivery · Module 21"
        depth="preview"
        title="Outcomes & Client Reports"
        description="What the content actually did for each client — with the source and freshness of every number, so nobody argues about data."
        actions={
          <>
            <Select
              className="w-full sm:w-56"
              value={clientId}
              onValueChange={setClientId}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Button variant="accent" onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="animate-spin" /> : <FileBarChart />} {generating ? "Compiling…" : "Generate client report"}
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {data.kpis.map((k) => {
          const up = k.delta >= 0;
          const fresh = refreshed[`${clientId}-${k.key}`];
          return (
            <Card key={k.key} className="min-w-0 p-5">
              <div className="text-body font-medium text-muted-foreground">{k.label}</div>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                <span className="text-heading font-semibold tracking-tight tabular">{fmtKpi(k)}</span>
                <span className={cn("inline-flex items-center text-body font-medium", up ? "text-success" : "text-danger")}>
                  {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  {Math.abs(k.delta * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
                <span className={cn("inline-flex min-w-0 items-center gap-1 truncate text-body", k.manual ? "text-warning" : "text-muted-foreground")}>
                  {k.manual ? <PenLine className="size-3 shrink-0" /> : <Database className="size-3 shrink-0" />}
                  <span className="truncate">
                    {k.source} · {fresh ? "just now" : k.freshness}
                  </span>
                </span>
                {!k.manual && (
                  <button
                    type="button"
                    className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                    aria-label={`Refresh ${k.label}`}
                    onClick={() => {
                      setRefreshed((r) => ({ ...r, [`${clientId}-${k.key}`]: true }));
                      toast.success(`${k.label} refreshed`, { description: `${k.source} · synced just now` });
                    }}
                  >
                    <RefreshCw className="size-3" />
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Reach & views · last 12 weeks</CardTitle>
              <CardDescription>{client.name} · weekly, all platforms</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3 text-body text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-chart-1" /> Views
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-chart-2" /> Reach
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.weekly} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} tickFormatter={compact} />
                <RTooltip {...tooltipStyle} formatter={(v) => nf.format(Number(v))} />
                <Area type="monotone" dataKey="views" name="Views" stroke="var(--color-chart-1)" strokeWidth={2} fill="var(--color-chart-1)" fillOpacity={0.08} />
                <Area type="monotone" dataKey="reach" name="Reach" stroke="var(--color-chart-2)" strokeWidth={2} fill="var(--color-chart-2)" fillOpacity={0.06} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Leads & enquiries</CardTitle>
              <CardDescription>Monthly, since retainer start</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyLeads} margin={{ left: -20, right: 4, top: 8 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
                <RTooltip {...tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
                <Bar dataKey="leads" name="Leads" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="enquiries" name="Enquiries" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Top-performing videos</CardTitle>
            <CardDescription>Ranked by views · leads attributed via UTM links and form source</CardDescription>
          </div>
          <Badge tone="outline">{data.topVideos.length} videos</Badge>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Video</TH>
              <TH>Platform</TH>
              <TH numeric>Views</TH>
              <TH numeric>Engagement</TH>
              <TH numeric>Saves</TH>
              <TH numeric className="pr-5">Leads</TH>
            </TR>
          </THead>
          <TBody>
            {data.topVideos.map((v, i) => (
              <TR key={v.code}>
                <TD className="pl-5">
                  <div className="flex items-center gap-3">
                    <span className="w-4 shrink-0 text-body text-muted-foreground tabular">{i + 1}</span>
                    <div className="min-w-[180px]">
                      <div className="font-medium">{v.title}</div>
                      <div className="font-mono text-body text-muted-foreground">{v.code}</div>
                    </div>
                  </div>
                </TD>
                <TD className="whitespace-nowrap">{v.platform}</TD>
                <TD numeric>{nf.format(v.views)}</TD>
                <TD numeric>{pct(v.er, 1)}</TD>
                <TD numeric>{nf.format(v.saves)}</TD>
                <TD numeric className="pr-5 font-medium">{v.leads}</TD>
              </TR>
            ))}
            {!data.topVideos.length && (
              <TR className="hover:bg-transparent">
                <TD colSpan={6} className="px-5 py-4">
                  <EmptyState compact icon={FileBarChart} title="No published videos yet" description="Performance appears here once this client's videos go live." />
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} clientId={clientId} />
    </div>
  );
}
