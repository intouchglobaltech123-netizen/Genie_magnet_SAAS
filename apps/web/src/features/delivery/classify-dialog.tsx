"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useDemo, type RevisionKind } from "@/lib/store";
import { agreementById, clientById } from "@/lib/mock/core";
import { reworkHourlyCost } from "@/lib/mock/delivery";
import { cn, fmtDate, inr } from "@/lib/utils";
import { kindMeta } from "./revision-meta";

const KINDS: RevisionKind[] = ["agency-correction", "included-revision", "out-of-scope"];

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ClassifyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const videos = useDemo((s) => s.videos);
  const addChangeRequest = useDemo((s) => s.addChangeRequest);
  const candidates = videos.filter((v) => v.stage === "Revision" || v.stage === "Client Review");

  const [videoId, setVideoId] = useState<string>("");
  const [commentId, setCommentId] = useState<string>("");
  const [summary, setSummary] = useState("");
  const [kind, setKind] = useState<RevisionKind>("included-revision");
  const [estimate, setEstimate] = useState("12000");
  const [days, setDays] = useState("3");
  const [hours, setHours] = useState("2");

  const video = candidates.find((v) => v.id === videoId) ?? candidates[0];
  const comments = video ? video.comments : [];
  const allowance = video ? agreementById(video.agreementId).revisionsPerDeliverable : 2;
  const before = video?.revisionsUsed ?? 0;
  const after = kind === "included-revision" ? before + 1 : before;
  const exceeds = kind === "included-revision" && after > allowance;
  const reworkCost = (Number(hours) || 0) * reworkHourlyCost;

  const pickVideo = (id: string) => {
    setVideoId(id);
    setCommentId("");
    setSummary("");
  };

  const pickComment = (id: string) => {
    setCommentId(id);
    const c = comments.find((x) => x.id === id);
    if (c) setSummary(c.text.replace(/^Voice note(?: \([\d:]+\))?(?::| —)?\s*/, ""));
  };

  const reset = () => {
    setVideoId("");
    setCommentId("");
    setSummary("");
    setKind("included-revision");
  };

  const submit = () => {
    if (!video || !summary.trim()) return;
    addChangeRequest({
      videoId: video.id,
      kind,
      summary: summary.trim(),
      estimate: kind === "out-of-scope" ? Number(estimate) || 0 : kind === "agency-correction" ? reworkCost : undefined,
      dateImpactDays: kind === "out-of-scope" ? Number(days) || 0 : undefined,
      status: "open",
    });
    toast.success(`Classified as ${kindMeta[kind].label.toLowerCase()}`, {
      description:
        kind === "out-of-scope"
          ? `Next: send the ${inr(Number(estimate) || 0)} estimate to ${clientById(video.clientId).name} for approval`
          : kind === "agency-correction"
            ? `No allowance used · ${inr(reworkCost)} rework cost recorded`
            : `${video.code}: allowance ${after} of ${allowance} used`,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent side="right">
        <DialogHeader>
          <DialogTitle>Classify client feedback</DialogTitle>
          <DialogDescription>Every piece of feedback gets one class before work starts — so allowance and billing are never argued later.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <Field label="1 · Video">
            <Select
              value={video?.id}
              onValueChange={pickVideo}
              options={candidates.map((v) => ({ value: v.id, label: `${v.code} · ${v.title}` }))}
              placeholder="Pick a video in Client Review or Revision"
            />
          </Field>

          {video && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-body font-medium">2 · Client comment</span>
                <span className="text-body text-muted-foreground">
                  {clientById(video.clientId).name} · {video.stage}
                </span>
              </div>
              <div className="max-h-44 space-y-1.5 overflow-y-auto scrollbar-thin">
                {comments.length === 0 && <p className="text-body text-muted-foreground">No comments yet — type the feedback below.</p>}
                {comments.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => pickComment(c.id)}
                    className={cn(
                      "flex w-full cursor-pointer gap-2 rounded-lg border p-2.5 text-left text-body transition",
                      c.id === commentId ? "border-primary bg-primary-soft" : "border-border hover:bg-muted/60",
                    )}
                  >
                    <span className="shrink-0 font-mono text-body text-primary">{c.timestamp ?? "—"}</span>
                    <span className="flex-1">
                      {c.text}
                      <span className="mt-0.5 block text-body text-muted-foreground">
                        {c.author} · {video.versions.find((v) => v.id === c.versionId)?.label} · {fmtDate(c.at)}
                        {c.resolved && " · resolved"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Summary of the change to be made" className="min-h-16" />
            </div>
          )}

          <div className="space-y-2">
            <span className="text-body font-medium">3 · Class</span>
            <div className="grid gap-2">
              {KINDS.map((k) => {
                const m = kindMeta[k];
                const Icon = m.icon;
                return (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition",
                      kind === k ? "border-primary ring-2 ring-primary/15" : "border-border hover:bg-muted/50",
                    )}
                  >
                    <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", m.iconCls)}>
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-body font-medium">{m.label}</span>
                      <span className="block text-body text-muted-foreground">{m.rule}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {video && (
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">Impact preview</div>
              <div className="mt-3 flex items-center gap-3">
                <AllowanceMeter used={before} allowance={allowance} label="Before" />
                <ArrowRight className="size-4 text-muted-foreground" />
                <AllowanceMeter used={after} allowance={allowance} label="After" highlight={after !== before} danger={exceeds} />
              </div>

              {kind === "agency-correction" && (
                <div className="mt-4 grid grid-cols-2 items-end gap-3">
                  <Field label="Rework hours (est.)">
                    <Input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} />
                  </Field>
                  <div className="pb-2 text-body">
                    Rework cost <span className="font-semibold tabular">{inr(reworkCost)}</span>
                    <div className="text-body text-muted-foreground">@ {inr(reworkHourlyCost)}/hr · internal only</div>
                  </div>
                </div>
              )}
              {kind === "out-of-scope" && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Estimate to client (₹)">
                      <Input type="number" min={0} value={estimate} onChange={(e) => setEstimate(e.target.value)} />
                    </Field>
                    <Field label="Date impact (days)">
                      <Input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} />
                    </Field>
                  </div>
                  <p className="text-body text-muted-foreground">
                    Delivery moves {fmtDate(video.dueDate)} → <span className="font-medium text-foreground">{fmtDate(addDays(video.dueDate, Number(days) || 0))}</span>{" "}
                    if approved. Work is blocked until the client approves the estimate.
                  </p>
                </div>
              )}
              {kind === "included-revision" && (
                <p className="mt-3 text-body text-muted-foreground">
                  Uses round {after} of {allowance} included in {agreementById(video.agreementId).packageName}.
                </p>
              )}
              {exceeds && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft p-2.5 text-body text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Allowance exhausted. Agreement rules say extra rounds are out-of-scope.{" "}
                    <button className="cursor-pointer font-medium underline" onClick={() => setKind("out-of-scope")}>
                      Reclassify
                    </button>
                  </span>
                </div>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} disabled={!video || !summary.trim() || exceeds}>
            Log as {kindMeta[kind].short.toLowerCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AllowanceMeter({ used, allowance, label, highlight, danger }: { used: number; allowance: number; label: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center justify-between text-body text-muted-foreground">
        {label}
        {highlight && <Badge tone={danger ? "danger" : "accent"}>+1</Badge>}
      </div>
      <div className={cn("mt-0.5 text-subheading font-semibold tabular", danger && "text-danger")}>
        {used} <span className="text-body font-normal text-muted-foreground">of {allowance} rounds</span>
      </div>
      <div className="mt-1.5 flex gap-1">
        {Array.from({ length: Math.max(allowance, used) }).map((_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < used ? (i >= allowance ? "bg-danger" : "bg-primary") : "bg-muted")} />
        ))}
      </div>
    </div>
  );
}
