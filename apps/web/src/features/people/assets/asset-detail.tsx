"use client";

import { ArrowDownLeft, ArrowUpRight, CalendarPlus, History, LayoutGrid, UserCheck, Wrench, CalendarDays } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { personById, TODAY } from "@/lib/mock/core";
import type { Asset } from "@/lib/types";
import { cn, fmtDate, inr, inrCompact } from "@/lib/utils";
import {
  CONDITION_TONE,
  STATUS_META,
  annualDepreciation,
  bookValue,
  bookValueSeries,
  custodyFor,
  depreciationSchedule,
  expectedHoursPerYear,
  maintenanceFor,
  perHourCost,
  type Reservation,
} from "./data";

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  fontSize: 13,
  padding: "8px 10px",
};

export function AssetDetail({
  asset,
  reservations,
  onOpenChange,
  onReserve,
}: {
  asset: Asset | null;
  reservations: Reservation[];
  onOpenChange: (o: boolean) => void;
  onReserve: (tag: string) => void;
}) {
  return (
    <Dialog open={!!asset} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="max-w-2xl">
        {asset && <Body asset={asset} reservations={reservations.filter((r) => r.tag === asset.tag)} onReserve={onReserve} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ asset: a, reservations, onReserve }: { asset: Asset; reservations: Reservation[]; onReserve: (tag: string) => void }) {
  const status = STATUS_META[a.status];
  const custodian = a.custodianId ? personById(a.custodianId) : null;
  const hourly = perHourCost(a);
  const series = bookValueSeries(a);
  const todayLabel = new Date(TODAY).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  const todayInSeries = series.some((p) => p.label === todayLabel);
  const history = custodyFor(a);
  const maint = maintenanceFor(a);

  return (
    <div>
      <div className="border-b border-border p-4 pr-12 sm:p-6 sm:pr-12">
        <div className="flex items-center gap-2 text-body text-muted-foreground">
          <Badge tone="outline">{a.tag}</Badge>
          <span>{a.category}</span>
        </div>
        <DialogTitle className="mt-2">{a.name}</DialogTitle>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          <Badge tone={CONDITION_TONE[a.condition]}>{a.condition}</Badge>
          {custodian && (
            <span className="inline-flex items-center gap-1.5 text-body text-muted-foreground">
              <Avatar name={custodian.name} size="xs" /> with {custodian.name}
            </span>
          )}
          <Button size="xs" variant="soft" className="ml-auto" onClick={() => onReserve(a.tag)}>
            <CalendarPlus /> Reserve
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Purchase" value={inr(a.purchaseValue)} sub={fmtDate(a.purchaseDate, { day: "numeric", month: "short", year: "numeric" })} />
          <Metric label="Book value" value={inr(bookValue(a))} sub={`Residual ${inr(a.residualValue)}`} />
          <Metric label="Depreciation / yr" value={inr(annualDepreciation(a))} sub={`${a.usefulLifeYears}-yr life`} />
          <Metric
            label="Cost / hour"
            value={hourly === null ? "n/a" : inr(hourly)}
            sub={hourly === null ? "Per-project costing" : `${expectedHoursPerYear(a.category)!.toLocaleString("en-IN")} hrs/yr`}
          />
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <Tabs defaultValue="overview">
          <TabsList className="scrollbar-thin max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">
              <LayoutGrid /> Overview
            </TabsTrigger>
            <TabsTrigger value="custody">
              <History /> Custody
            </TabsTrigger>
            <TabsTrigger value="maintenance">
              <Wrench /> Maintenance
            </TabsTrigger>
            <TabsTrigger value="reservations">
              <CalendarDays /> Reservations
              {reservations.length > 0 && (
                <Badge tone="accent" className="tabular px-1.5">
                  {reservations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center justify-between text-body">
                <span className="font-medium">Book value over useful life</span>
                <span className="text-muted-foreground">Straight-line</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} minTickGap={24} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                      tickFormatter={(v: number) => inrCompact(v)}
                    />
                    <RTooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "var(--color-muted-foreground)" }}
                      itemStyle={{ color: "var(--color-foreground)" }}
                      formatter={(v) => [inr(Number(v)), "Book value"]}
                    />
                    {todayInSeries && <ReferenceLine x={todayLabel} stroke="var(--color-primary)" strokeDasharray="4 4" label={{ value: "Today", fill: "var(--color-primary)", fontSize: 12, position: "top" }} />}
                    <Area type="linear" dataKey="value" stroke="var(--color-chart-1)" strokeWidth={2} fill="var(--color-chart-1)" fillOpacity={0.08} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <THead>
                  <TR>
                    <TH>Year</TH>
                    <TH>Period</TH>
                    <TH numeric>Opening</TH>
                    <TH numeric>Depreciation</TH>
                    <TH numeric>Closing</TH>
                  </TR>
                </THead>
                <TBody>
                  {depreciationSchedule(a).map((y) => (
                    <TR key={y.year} className={cn(y.current && "bg-primary-soft/50")}>
                      <TD className="font-medium">
                        Y{y.year} {y.current && <Badge tone="accent" className="ml-1">Current</Badge>}
                      </TD>
                      <TD className="text-muted-foreground">
                        {fmtDate(y.from, { month: "short", year: "numeric" })} – {fmtDate(y.to, { month: "short", year: "numeric" })}
                      </TD>
                      <TD numeric>{inr(y.opening)}</TD>
                      <TD numeric className="text-danger">−{inr(y.depreciation)}</TD>
                      <TD numeric className="font-medium">{inr(y.closing)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <div className="grid grid-cols-1 gap-3 text-body sm:grid-cols-2">
              <Metric label="Hours used" value={`${a.hoursUsed.toLocaleString("en-IN")} h`} sub={a.hoursUsed ? "Logged via checkout" : "Not hour-tracked"} />
              <Metric
                label="Depreciation recovered"
                value={hourly === null ? "n/a" : inr(hourly * a.hoursUsed)}
                sub="Hours used × cost/hour, billed to shoots"
              />
            </div>
          </TabsContent>

          <TabsContent value="custody">
            {history.length === 0 ? (
              <Empty text="No custody movements yet — asset is in the equipment room." />
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {history.map((h, i) => {
                  const p = personById(h.personId);
                  return (
                    <li key={i} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[31px] top-0 inline-flex size-5 items-center justify-center rounded-full ring-4 ring-popover",
                          h.kind === "out" ? "bg-primary-soft text-primary" : h.kind === "in" ? "bg-success-soft text-success" : "bg-info-soft text-info",
                        )}
                      >
                        {h.kind === "out" ? <ArrowUpRight className="size-3" /> : h.kind === "in" ? <ArrowDownLeft className="size-3" /> : <UserCheck className="size-3" />}
                      </span>
                      <div className="flex flex-wrap items-center gap-x-2 text-body">
                        <span className="font-medium">
                          {h.kind === "out" ? "Checked out to" : h.kind === "in" ? "Returned by" : "Assigned to"} {p.name}
                        </span>
                        <span className="text-muted-foreground">· {h.at}</span>
                      </div>
                      <div className="text-body text-muted-foreground">{h.purpose}</div>
                      {h.note && <div className="mt-1 text-body text-muted-foreground">{h.note}</div>}
                    </li>
                  );
                })}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-2">
            {maint.length === 0 && <Empty text="No maintenance or repairs logged for this asset." />}
            {maint.map((m, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3.5">
                <div>
                  <div className="text-body font-medium">{m.title}</div>
                  <div className="text-body text-muted-foreground">
                    {fmtDate(m.date, { day: "numeric", month: "short", year: "numeric" })} · {m.by}
                    {m.note ? ` · ${m.note}` : ""}
                  </div>
                </div>
                <span className="shrink-0 text-body tabular">{m.cost ? inr(m.cost) : <span className="text-muted-foreground">No cost</span>}</span>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="reservations" className="space-y-2">
            {reservations.length === 0 ? (
              <Empty text="No upcoming reservations." />
            ) : (
              reservations
                .slice()
                .sort((x, y) => x.date.localeCompare(y.date))
                .map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3.5">
                    <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-center leading-none">
                      <span className="text-body uppercase text-muted-foreground">{fmtDate(r.date, { month: "short" })}</span>
                      <span className="text-subheading font-semibold">{fmtDate(r.date, { day: "numeric" })}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-medium">{r.purpose}</div>
                      <div className="text-body text-muted-foreground">{r.location ?? "Location TBC"}</div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-body">
                      <Avatar name={personById(r.personId).name} size="xs" />
                      {personById(r.personId).name.split(" ")[0]}
                    </span>
                  </div>
                ))
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={() => onReserve(a.tag)}>
              <CalendarPlus /> New reservation
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-body font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-subheading font-semibold tabular">{value}</div>
      {sub && <div className="mt-0.5 text-body text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <EmptyState compact icon={CalendarDays} title="Nothing here yet" description={text} />;
}
