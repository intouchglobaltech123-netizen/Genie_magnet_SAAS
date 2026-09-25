"use client";

import { Fragment, useState } from "react";
import { ArrowRight, ChevronRight, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { assets } from "@/lib/mock/core";
import { DIRECT_LABOUR_HOURS, OVERHEAD_RATE, OVERHEAD_TOTAL, overheadPools } from "@/lib/mock/finance";
import { cn, inr, pct } from "@/lib/utils";
import { PRODUCTIVE_HOURS, assetRate } from "./model";
import { useActiveScenario, useCosting } from "./store";
import { useVideoCosts } from "./video-costs";

export function OverheadPools() {
  const [open, setOpen] = useState<string | null>("op-soft");
  const sc = useActiveScenario();
  const factor = 1 + sc.overheadPct / 100;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Shared overhead pools</CardTitle>
            <CardDescription>Monthly amounts · allocated to videos on direct labour hours</CardDescription>
          </div>
          {sc.overheadPct !== 0 && <Badge tone="accent">Scenario {sc.overheadPct > 0 ? "+" : ""}{sc.overheadPct}%</Badge>}
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Pool</TH>
              <TH>Allocation basis</TH>
              <TH className="text-right">Monthly</TH>
              <TH className="text-right">Share</TH>
              <TH className="pr-5 text-right">₹ / labour hr</TH>
            </TR>
          </THead>
          <TBody>
            {overheadPools.map((p) => {
              const isOpen = open === p.id;
              return (
                <Fragment key={p.id}>
                  <TR className="cursor-pointer" onClick={() => setOpen(isOpen ? null : p.id)}>
                    <TD className="pl-5">
                      <div className="flex items-center gap-1.5 font-medium">
                        <ChevronRight className={cn("size-3.5 text-muted-foreground transition", isOpen && "rotate-90")} />
                        {p.name}
                      </div>
                    </TD>
                    <TD>
                      <Badge tone="outline">{p.basis}</Badge>
                    </TD>
                    <TD className="text-right tabular">{inr(p.monthly * factor)}</TD>
                    <TD className="text-right tabular text-muted-foreground">{pct(p.monthly / OVERHEAD_TOTAL)}</TD>
                    <TD className="pr-5 text-right tabular">₹{((p.monthly * factor) / DIRECT_LABOUR_HOURS).toFixed(1)}</TD>
                  </TR>
                  {isOpen && (
                    <TR className="bg-muted/30 hover:bg-muted/30">
                      <TD colSpan={5} className="py-3 pl-11 pr-5">
                        <div className="space-y-1">
                          {p.items.map((i) => (
                            <div key={i.label} className="flex justify-between text-body">
                              <span className="text-muted-foreground">{i.label}</span>
                              <span className="tabular">{inr(i.amount * factor)}</span>
                            </div>
                          ))}
                          {p.note && (
                            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-info-soft px-2.5 py-1.5 text-body text-info">
                              <Info className="mt-0.5 size-3.5 shrink-0" />
                              {p.note}
                            </div>
                          )}
                        </div>
                      </TD>
                    </TR>
                  )}
                </Fragment>
              );
            })}
            <TR className="bg-muted/40 font-semibold hover:bg-muted/40">
              <TD className="pl-5" colSpan={2}>
                Total pools ÷ {DIRECT_LABOUR_HOURS.toLocaleString("en-IN")} direct labour hrs
              </TD>
              <TD className="text-right tabular">{inr(OVERHEAD_TOTAL * factor)}</TD>
              <TD className="text-right tabular">100%</TD>
              <TD className="pr-5 text-right tabular">₹{(OVERHEAD_RATE * factor).toFixed(0)}</TD>
            </TR>
          </TBody>
        </Table>
      </Card>
      <AllocationFlow factor={factor} />
      <EquipmentRates />
    </div>
  );
}

function AllocationFlow({ factor }: { factor: number }) {
  const { rows } = useVideoCosts();
  const selectedId = useCosting((s) => s.selectedId);
  const c = rows.find((r) => r.video.id === selectedId) ?? rows[0]!;
  const steps = [
    { k: "Pools / month", v: inr(OVERHEAD_TOTAL * factor), sub: "6 shared cost pools" },
    { k: "÷ Direct labour hrs", v: DIRECT_LABOUR_HOURS.toLocaleString("en-IN"), sub: "logged on client work" },
    { k: "= Overhead rate", v: `₹${(OVERHEAD_RATE * factor).toFixed(0)}/hr`, sub: "rate card v3" },
    { k: `× ${c.video.code} hours`, v: `${c.actual.labourHours.toFixed(1)} h`, sub: "incl. rework hours" },
    { k: "= Allocated", v: inr(c.actual.overhead), sub: "to this video", strong: true },
  ];
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>How overhead reaches a video</CardTitle>
          <CardDescription>Follows the video selected in “Per video”</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((s, i) => (
          <div key={s.k} className={cn("flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5", s.strong && "border-primary/40 bg-primary-soft/50")}>
            <div className="flex items-center gap-2.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-muted text-body font-semibold text-muted-foreground">{i + 1}</span>
              <div>
                <div className="text-body font-medium">{s.k}</div>
                <div className="text-body text-muted-foreground">{s.sub}</div>
              </div>
            </div>
            <span className={cn("tabular", s.strong ? "text-subheading font-semibold text-primary" : "font-medium")}>{s.v}</span>
          </div>
        ))}
        <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-body text-muted-foreground">
          <ArrowRight className="mt-0.5 size-3.5 shrink-0" />
          No double counting: founder remuneration is excluded, and Ashwin&apos;s hours logged directly on a video are charged as labour — only his unlogged share sits in the Management pool.
        </div>
      </CardContent>
    </Card>
  );
}

function EquipmentRates() {
  const sc = useActiveScenario();
  const list = assets.filter((a) => a.category !== "Storage");
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Equipment depreciation rates</CardTitle>
          <CardDescription>(Purchase − Residual) ÷ Useful life ÷ Productive hours per year → ₹ per equipment hour</CardDescription>
        </div>
      </CardHeader>
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Asset</TH>
            <TH className="text-right">Purchase</TH>
            <TH className="text-right">Residual</TH>
            <TH className="text-right">Life</TH>
            <TH className="text-right">Productive hrs / yr</TH>
            <TH className="text-right">Hours used</TH>
            <TH className="pr-5 text-right">₹ / hr</TH>
          </TR>
        </THead>
        <TBody>
          {list.map((a) => {
            const hero = a.id === "as-01";
            const life = hero ? sc.cameraLifeYears : a.usefulLifeYears;
            return (
              <TR key={a.id} className={cn(hero && "bg-accent-soft/50 hover:bg-accent-soft/60")}>
                <TD className="pl-5">
                  <div className="font-medium">{a.name}</div>
                  <div className="font-mono text-body text-muted-foreground">
                    {a.tag} · {a.category}
                    {hero && <span className="ml-1.5 font-sans text-accent-strong">worked example</span>}
                  </div>
                </TD>
                <TD className="text-right tabular">{inr(a.purchaseValue)}</TD>
                <TD className="text-right tabular text-muted-foreground">{inr(a.residualValue)}</TD>
                <TD className="text-right tabular">
                  {life} yr{life > 1 ? "s" : ""}
                </TD>
                <TD className="text-right tabular text-muted-foreground">{PRODUCTIVE_HOURS[a.category].toLocaleString("en-IN")}</TD>
                <TD className="text-right tabular text-muted-foreground">{a.hoursUsed.toLocaleString("en-IN")}</TD>
                <TD className="pr-5 text-right font-semibold tabular">₹{assetRate(a, sc).toFixed(1)}</TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </Card>
  );
}
