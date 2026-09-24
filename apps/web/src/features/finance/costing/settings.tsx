"use client";

import { FlaskConical, History, Lock, LockOpen, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn, fmtDate } from "@/lib/utils";
import { periods, rateCards } from "./model";
import { useCosting } from "./store";

export function ScenarioControls({ compact }: { compact?: boolean }) {
  const on = useCosting((s) => s.scenarioOn);
  const sc = useCosting((s) => s.scenario);
  const setOn = useCosting((s) => s.setScenarioOn);
  const patch = useCosting((s) => s.patchScenario);
  const reset = useCosting((s) => s.resetScenario);

  const sliders = [
    { key: "labourPct" as const, label: "Hourly rates", min: -20, max: 30, step: 5, fmt: (x: number) => `${x > 0 ? "+" : ""}${x}%` },
    { key: "overheadPct" as const, label: "Overhead pools", min: -30, max: 30, step: 5, fmt: (x: number) => `${x > 0 ? "+" : ""}${x}%` },
    { key: "cameraLifeYears" as const, label: "GM-CAM-01 useful life", min: 1, max: 4, step: 1, fmt: (x: number) => `${x} yr${x > 1 ? "s" : ""}` },
  ];

  return (
    <div className={cn("space-y-4", !compact && "")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
            <FlaskConical className="size-4 text-accent" /> Recalculate scenario
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">What-if layer only — actuals, locked periods and invoices are never touched.</p>
        </div>
        <Switch
          checked={on}
          onCheckedChange={(v) => {
            setOn(v);
            toast(v ? "Scenario mode on" : "Back to actuals", {
              description: v ? "Figures now show the what-if. Nothing is saved to the ledger." : "Scenario discarded from view; actuals unchanged.",
            });
          }}
        />
      </div>
      <div className={cn("space-y-3.5 transition", !on && "pointer-events-none opacity-45")}>
        {sliders.map((s) => (
          <div key={s.key}>
            <div className="mb-1 flex items-center justify-between text-[12.5px]">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-medium tabular">{s.fmt(sc[s.key])}</span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={sc[s.key]}
              onChange={(e) => patch({ [s.key]: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
            />
          </div>
        ))}
        <Button variant="ghost" size="xs" onClick={reset}>
          <RotateCcw /> Reset assumptions
        </Button>
      </div>
    </div>
  );
}

export function CostingSettings() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" /> Rate cards · effective dates
            </CardTitle>
            <CardDescription>Costs are always calculated with the rate card valid on the day the work was logged</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => toast.success("Draft rate card v4 created", { description: "Effective from 1 Oct 2026 — needs Janarthanan's approval before use." })}>
            New rate card
          </Button>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {rateCards.map((r) => (
            <div key={r.version} className="flex items-start gap-3 rounded-xl border border-border p-3.5">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-semibold",
                  r.status === "current" ? "bg-accent-soft text-accent" : "bg-muted text-muted-foreground",
                )}
              >
                {r.version}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                  {fmtDate(r.effectiveFrom, { day: "numeric", month: "short", year: "numeric" })} →{" "}
                  {r.effectiveTo ? fmtDate(r.effectiveTo, { day: "numeric", month: "short", year: "numeric" }) : "present"}
                  {r.status === "current" ? <Badge tone="success" dot>Current</Badge> : <Badge tone="neutral"><Lock /> Locked</Badge>}
                </div>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{r.change}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Approved by {r.by}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <ScenarioControls />
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" /> Costing periods
            </CardTitle>
            <CardDescription>Closed periods are locked — late time entries or rate changes post to the open month as adjustments, with an audit trail</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {periods.map((p) => (
            <button
              key={p.label}
              onClick={() =>
                p.status === "locked"
                  ? toast("Period locked", { description: `${p.label} was closed on ${fmtDate(p.lockedOn!)}. Corrections need a reason and post as an adjustment in Sep 2026.` })
                  : toast("Sep 2026 is open", { description: "Will lock after cycle reconciliation (target 5 Oct)." })
              }
              className={cn(
                "cursor-pointer rounded-xl border p-3 text-left transition hover:shadow-card",
                p.status === "locked" ? "border-border bg-muted/40" : "border-success/40 bg-success-soft/50",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium">{p.label}</span>
                {p.status === "locked" ? <Lock className="size-3.5 text-muted-foreground" /> : <LockOpen className="size-3.5 text-success" />}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {p.status === "locked" ? `Locked ${fmtDate(p.lockedOn!)}` : "Open · recalculates live"}
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
