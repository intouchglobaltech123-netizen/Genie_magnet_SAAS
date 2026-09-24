"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CheckCheck, ChevronDown, ClipboardCheck, Gauge, Send, ShieldAlert, Timer } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StageBadge, UrgencyIcon } from "@/components/shared/video-bits";
import { personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { QC_CHECKS, type Video } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClientChip, DueLabel } from "./bits";
import { qcCounts, stageIdx } from "./lib";
import { QcChecklist } from "./qc-checklist";
import { useProduction, useProductionHydration } from "./store";

const URG_ORDER = { rush: 0, priority: 1, standard: 2 } as const;

export function QcQueue() {
  useProductionHydration();
  const videos = useDemo((s) => s.videos);
  const corrective = useProduction((s) => s.corrective);
  const [open, setOpen] = useState<string | null>(() => videos.find((v) => v.stage === "Internal QC")?.id ?? null);

  const queue = videos
    .filter((v) => v.stage === "Internal QC")
    .sort((a, b) => URG_ORDER[a.urgency] - URG_ORDER[b.urgency] || a.dueDate.localeCompare(b.dueDate));
  const held = videos.filter((v) => v.stage !== "Internal QC" && qcCounts(v).fail > 0);
  const passed = videos
    .filter((v) => stageIdx(v.stage) >= 6 && qcCounts(v).pass === QC_CHECKS.length)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .slice(0, 6);
  const openCorrective = corrective.filter((c) => !c.done).length;

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <ClipboardCheck className="size-3.5" /> Client Delivery · Module 17
          </span>
        }
        title="Internal QC"
        description="The quality gate before any video reaches a client. Eleven mandatory checks — one failure holds the stage and creates a corrective task."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Waiting for QC" value={queue.length} icon={ClipboardCheck} tone="gold" hint={`${queue.filter((v) => v.urgency === "rush").length} rush`} />
        <StatCard label="Corrective tasks open" value={openCorrective} icon={ShieldAlert} tone={openCorrective ? "danger" : "success"} hint={openCorrective ? "stage held" : "none open"} />
        <StatCard label="First-pass yield" value="82%" icon={Gauge} tone="success" delta={0.06} deltaLabel="vs Aug" />
        <StatCard label="Avg QC time" value="38m" icon={Timer} tone="info" hint="per video, this month" />
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
          Queue <span className="rounded-md bg-muted px-1.5 text-[11px] font-medium tabular text-muted-foreground">{queue.length}</span>
        </h2>
        {!queue.length && (
          <Card className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCheck className="size-6 text-success" />
            <div className="font-semibold">QC queue is clear</div>
            <p className="text-[13px] text-muted-foreground">Videos appear here when an editor completes all 9 edit steps.</p>
          </Card>
        )}
        <div className="space-y-2.5">
          {queue.map((v) => (
            <QueueRow key={v.id} v={v} open={open === v.id} onToggle={() => setOpen(open === v.id ? null : v.id)} />
          ))}
        </div>
      </section>

      {held.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-[13px] font-semibold text-danger">Held with failed checks</h2>
          <div className="space-y-2.5">
            {held.map((v) => (
              <QueueRow key={v.id} v={v} open={open === v.id} onToggle={() => setOpen(open === v.id ? null : v.id)} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-[13px] font-semibold">Recently passed</h2>
        <Card className="divide-y divide-border">
          {passed.map((v) => (
            <Link key={v.id} href={`/production/${v.id}`} className="flex items-center gap-4 px-5 py-3 transition hover:bg-muted/40">
              <CheckCheck className="size-4 shrink-0 text-success" />
              <span className="w-28 shrink-0 font-mono text-[12px] text-muted-foreground">{v.code}</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{v.title}</span>
              <span className="hidden text-[12px] text-muted-foreground md:inline">QC by Karthik S.</span>
              <StageBadge stage={v.stage} />
              <ArrowUpRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </Card>
      </section>
    </div>
  );
}

function QueueRow({ v, open, onToggle }: { v: Video; open: boolean; onToggle: () => void }) {
  const publishNewVersion = useDemo((s) => s.publishNewVersion);
  const setQc = useDemo((s) => s.setQc);
  const log = useDemo((s) => s.log);
  const resolveCorrective = useProduction((s) => s.resolveCorrective);
  const q = qcCounts(v);
  const editor = personById(v.editorId);
  const allPass = q.pass === QC_CHECKS.length;

  const send = (passEverything: boolean) => {
    if (passEverything) {
      QC_CHECKS.forEach((c) => {
        if (v.qc[c] !== "pass") setQc(v.id, c, "pass");
        resolveCorrective(v.id, c);
      });
      log(`All ${QC_CHECKS.length} QC checks passed on ${v.code} (Karthik Subramanian)`, "success");
    }
    publishNewVersion(v.id, v.versions.length ? "Revised cut after internal QC" : "First cut after internal QC");
    toast.success(`${v.code} passed QC → Client Review`, { description: `v${v.versions.length + 1} shared with the client` });
  };

  return (
    <Card className={cn("overflow-hidden transition", open && "ring-1 ring-accent/30", q.fail > 0 && "border-danger/30")}>
      <button type="button" onClick={onToggle} className="flex w-full cursor-pointer items-center gap-4 px-5 py-3.5 text-left transition hover:bg-muted/30">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11.5px] font-medium text-muted-foreground">{v.code}</span>
            <UrgencyIcon urgency={v.urgency} />
            {q.fail > 0 && (
              <Badge tone="danger">
                <ShieldAlert /> Held
              </Badge>
            )}
          </div>
          <div className="mt-0.5 truncate text-[14px] font-medium">{v.title}</div>
          <ClientChip clientId={v.clientId} className="mt-0.5" />
        </div>
        <div className="hidden w-44 md:block">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span className="tabular">
              {q.pass}/{QC_CHECKS.length} passed
            </span>
            {q.fail > 0 && <span className="font-medium text-danger">{q.fail} failed</span>}
          </div>
          <Progress value={(q.pass / QC_CHECKS.length) * 100} tone={q.fail ? "danger" : allPass ? "success" : "gold"} />
        </div>
        <div className="hidden items-center gap-2 text-[12.5px] lg:flex">
          <Avatar name={editor.name} size="sm" />
          <span className="w-24 truncate">{editor.name}</span>
        </div>
        <DueLabel v={v} className="w-14 text-right" />
        <ChevronDown className={cn("size-4 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border-t border-border bg-muted/20 px-5 py-4">
              <QcChecklist v={v} dense />
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/production/${v.id}`}>
                    Open video <ArrowUpRight />
                  </Link>
                </Button>
                {v.stage === "Internal QC" && (
                  <>
                    <Button variant="outline" size="sm" disabled={!allPass} onClick={() => send(false)}>
                      <Send /> Send to client review
                    </Button>
                    <Button variant="success" size="sm" disabled={q.fail > 0} onClick={() => send(true)}>
                      <CheckCheck /> Pass all & send
                    </Button>
                  </>
                )}
              </div>
              {q.fail > 0 && v.stage === "Internal QC" && (
                <p className="mt-2 text-right text-[12px] text-danger">Mandatory check failed — stage held until the corrective task is closed and re-checked.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
