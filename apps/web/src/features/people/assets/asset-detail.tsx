"use client";

import { ArrowDownLeft, ArrowUpRight, CalendarPlus, History, LayoutGrid, UserCheck, Wrench, CalendarDays } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
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
      <div className="border-b border-border p-6 pr-12">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
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
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
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

      <div className="p-6">
        <Tabs defaultValue="overview">
          <TabsList>
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
              {reservations.length > 0 && <span className="rounded bg-accent-soft px-1 text-[10px] text-accent">{reservations.length}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center justify-between text-[13px]">
                <span className="font-medium">Book value over useful life</span>
                <span className="text-muted-foreground">Straight-line</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bvFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} minTickGap={24} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      tickFormatter={(v: number) => inrCompact(v)}
                    />
                    <RTooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "var(--muted-foreground)" }}
                      itemStyle={{ color: "var(--foreground)" }}
                      formatter={(v) => [inr(Number(v)), "Book value"]}
                    />
                    {todayInSeries && <ReferenceLine x={todayLabel} stroke="var(--accent)" strokeDasharray="4 4" label={{ value: "Today", fill: "var(--accent)", fontSize: 11, position: "top" }} />}
                    <Area type="linear" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} fill="url(#bvFill)" />
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
                    <TH className="text-right">Opening</TH>
                    <TH className="text-right">Depreciation</TH>
                    <TH className="text-right">Closing</TH>
                  </TR>
                </THead>
                <TBody>
                  {depreciationSchedule(a).map((y) => (
                    <TR key={y.year} className={cn(y.current && "bg-accent-soft/50")}>
                      <TD className="font-medium">
                        Y{y.year} {y.current && <Badge tone="accent" className="ml-1">Current</Badge>}
                      </TD>
                      <TD className="text-muted-foreground">
                        {fmtDate(y.from, { month: "short", year: "numeric" })} – {fmtDate(y.to, { month: "short", year: "numeric" })}
                      </TD>
                      <TD className="text-right tabular">{inr(y.opening)}</TD>
                      <TD className="text-right tabular text-danger">−{inr(y.depreciation)}</TD>
                      <TD className="text-right tabular font-medium">{inr(y.closing)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
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
                          h.kind === "out" ? "bg-accent-soft text-accent" : h.kind === "in" ? "bg-success-soft text-success" : "bg-info-soft text-info",
                        )}
                      >
                        {h.kind === "out" ? <ArrowUpRight className="size-3" /> : h.kind === "in" ? <ArrowDownLeft className="size-3" /> : <UserCheck className="size-3" />}
                      </span>
                      <div className="flex flex-wrap items-center gap-x-2 text-[13px]">
                        <span className="font-medium">
                          {h.kind === "out" ? "Checked out to" : h.kind === "in" ? "Returned by" : "Assigned to"} {p.name}
                        </span>
                        <span className="text-muted-foreground">· {h.at}</span>
                      </div>
                      <div className="text-[13px] text-muted-foreground">{h.purpose}</div>
                      {h.note && <div className="mt-1 text-[12px] text-muted-foreground/80">{h.note}</div>}
                    </li>
                  );
                })}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-2">
            {maint.map((m, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3.5">
                <div>
                  <div className="text-[13px] font-medium">{m.title}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {fmtDate(m.date, { day: "numeric", month: "short", year: "numeric" })} · {m.by}
                    {m.note ? ` · ${m.note}` : ""}
                  </div>
                </div>
                <span className="text-[13px] tabular">{m.cost ? inr(m.cost) : <span className="text-muted-foreground">No cost</span>}</span>
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
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border p-3.5">
                    <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-center leading-none">
                      <span className="text-[10px] uppercase text-muted-foreground">{fmtDate(r.date, { month: "short" })}</span>
                      <span className="text-[15px] font-semibold">{fmtDate(r.date, { day: "numeric" })}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{r.purpose}</div>
                      <div className="text-[12px] text-muted-foreground">{r.location ?? "Location TBC"}</div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[12.5px]">
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
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-[15px] font-semibold tabular">{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">{text}</div>;
}
