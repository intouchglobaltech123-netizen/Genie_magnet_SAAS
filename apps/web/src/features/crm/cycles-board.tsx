"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarPlus, CheckCircle2, Info, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { CategoryBadge } from "@/components/shared/video-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clientById } from "@/lib/mock/core";
import { cycleTimeline } from "@/lib/mock/crm";
import { useDemo } from "@/lib/store";
import type { Cycle } from "@/lib/types";
import { cn, inr, inrCompact, pct } from "@/lib/utils";
import { useCrmDemo } from "./crm-store";
import { unitsTotal, useAgreements, type LiveAgreement } from "./agreements/shared";

const statusTone = { upcoming: "neutral", "in-progress": "info", reconciling: "warning", closed: "success" } as const;

export function CyclesBoard() {
  const all = useAgreements();
  const { octGenerated, setOctGenerated } = useCrmDemo();
  const log = useDemo((s) => s.log);
  const [open, setOpen] = useState(false);

  const running = all.filter((a) => a.status !== "paused" && a.status !== "ended");
  const pending = running.filter((a) => cycleTimeline(a)[2]!.synthetic);
  const octPromised = (a: LiveAgreement) => cycleTimeline(a)[2]!.promised;
  const pendingUnits = pending.reduce((s, a) => s + octPromised(a), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Module 12 · Recurring Cycles"
        title="Recurring cycles"
        description="Each agreement produces a monthly cycle of deliverables. Cycles open, run, reconcile and close — nothing is created by hand."
        depth="preview"
        actions={
          <Button variant="accent" size="sm" disabled={octGenerated || !pending.length} onClick={() => setOpen(true)}>
            <CalendarPlus /> {octGenerated ? "Oct 2026 cycles generated" : "Generate Oct 2026 cycles"}
          </Button>
        }
      />

      <Alert tone="info" icon={Zap} title="Auto-generated 7 days before cycle start" className="mb-5">
        On 24 Sep the scheduler created Kaveri&apos;s October cycle. {octGenerated ? "All October cycles are now ready." : `${pending.length} cycles are held for manager confirmation (renewal due / payment risk) — review and generate below.`}{" "}
        Next automatic run: <b className="text-text-primary">24 Oct 2026</b> for November cycles.
      </Alert>

      <div className="mb-2 hidden grid-cols-[260px_repeat(3,minmax(0,1fr))] gap-3 px-1 text-body font-medium uppercase tracking-wider text-muted-foreground lg:grid">
        <span>Agreement</span>
        <span>Aug 2026 · closed</span>
        <span>Sep 2026 · in progress</span>
        <span>Oct 2026 · upcoming</span>
      </div>
      <div className="space-y-3">
        {all.map((a) => (
          <Row key={a.id} a={a} octGenerated={octGenerated} />
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Generate October 2026 cycles
            </DialogTitle>
            <DialogDescription>
              {pending.length} cycles · {pendingUnits} deliverables will be created from agreement units, with codes, due dates and owners.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2">
            {pending.map((a) => {
              const c = clientById(a.clientId);
              return (
                <div key={a.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3">
                    <div className="text-body font-semibold">{c.name}</div>
                    <span className="text-body text-muted-foreground tabular">{inr(a.monthlyFee)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.units.map((u) => (
                      <Badge key={u.label} tone="accent">
                        {u.perCycle} × {u.label}
                      </Badge>
                    ))}
                    <Badge tone="outline">
                      {c.code}-1026-01 … {c.code}-1026-{String(octPromised(a)).padStart(2, "0")}
                    </Badge>
                  </div>
                  {a.status === "renewal-due" && <div className="mt-2 text-body text-warning">Renewal due 31 Oct — cycle generated, renewal reminder attached</div>}
                  {c.category === "Dangerous" && <div className="mt-2 text-body text-danger">Payment risk — shoots held until ₹80,000 is cleared</div>}
                </div>
              );
            })}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                setOctGenerated();
                setOpen(false);
                log(`October cycles generated — ${pending.length} clients, ${pendingUnits} deliverables`, "success");
                toast.success("October cycles generated", { description: `${pendingUnits} deliverables added to Video Production and Planning` });
              }}
            >
              Generate {pendingUnits} deliverables
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ a, octGenerated }: { a: LiveAgreement; octGenerated: boolean }) {
  const c = clientById(a.clientId);
  const timeline = cycleTimeline(a);
  const paused = a.status === "paused";
  return (
    <Card className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-[260px_repeat(3,minmax(0,1fr))] lg:items-stretch">
      <Link href={`/agreements/${a.id}`} className="flex min-w-0 flex-col justify-center rounded-xl px-2 py-1 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
        <div className="text-body font-semibold">{c.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <CategoryBadge category={c.category} />
          {paused && <Badge tone="neutral">Paused</Badge>}
          {a.status === "renewal-due" && <Badge tone="warning">Renewal due</Badge>}
        </div>
        <div className="mt-1.5 text-body text-muted-foreground">
          {a.packageName} · {unitsTotal(a)} units · {inrCompact(a.monthlyFee)}
        </div>
      </Link>
      {timeline.map((cy, i) => (
        <CycleCell key={cy.id} cy={cy} isOct={i === 2} generated={!cy.synthetic || octGenerated} paused={paused && i === 2} />
      ))}
    </Card>
  );
}

function CycleCell({ cy, isOct, generated, paused }: { cy: Cycle & { synthetic?: boolean }; isOct: boolean; generated: boolean; paused: boolean }) {
  if (isOct && (paused || !generated)) {
    return (
      <div className="flex flex-col justify-center rounded-xl border border-dashed border-border p-3 text-body text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-text-primary">{cy.label}</span>
          <Badge tone="neutral">{paused ? "Paused" : "Pending"}</Badge>
        </div>
        <div className="mt-2 flex items-start gap-1.5">
          <Info className="mt-0.5 size-3.5 shrink-0" /> {paused ? "Not generated while agreement is paused" : `${cy.promised} deliverables awaiting generation`}
        </div>
      </div>
    );
  }
  const margin = cy.cost ? (cy.revenue - cy.cost) / cy.revenue : null;
  return (
    <motion.div
      layout
      initial={isOct ? { opacity: 0, scale: 0.97 } : false}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("rounded-xl border p-3", cy.status === "in-progress" ? "border-primary/30 bg-primary-soft/30" : "border-border bg-card")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-body font-medium">{cy.label}</span>
        <Badge tone={statusTone[cy.status]} dot>
          {cy.status}
        </Badge>
      </div>
      <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-success transition-all" style={{ width: `${(cy.delivered / cy.promised) * 100}%` }} />
        <div className="bg-primary/50 transition-all" style={{ width: `${(cy.inProgress / cy.promised) * 100}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 text-body tabular">
        <span>
          <b>{cy.delivered}</b>
          <span className="text-muted-foreground">/{cy.promised} delivered</span>
          {cy.inProgress > 0 && <span className="text-muted-foreground"> · {cy.inProgress} wip</span>}
        </span>
        {margin !== null && cy.status !== "in-progress" ? (
          <span className={cn("font-medium", margin < 0.2 ? "text-danger" : "text-success")}>{pct(margin)} margin</span>
        ) : cy.status === "upcoming" ? (
          <span className="inline-flex items-center gap-1 text-success">
            <CheckCircle2 className="size-3.5" /> generated
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}
