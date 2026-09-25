"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Crown, MapPin, Send, ThumbsDown, ClipboardCheck, Brain } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { cn, fmtDate, inr } from "@/lib/utils";
import {
  emptyScorecard,
  evaluate,
  roles,
  sourceTone,
  stageMeta,
  starQuestions,
  type Candidate,
  type Scorecard,
  type Stage,
} from "./data";

const paramHelp: Record<keyof Scorecard["params"], string> = {
  Skills: "Hands-on ability shown in the task & portfolio",
  Knowledge: "Understanding of tools, platforms, market",
  "Self image": "How they see their role & ownership",
  Traits: "Detail, discipline, receptiveness",
  Motives: "What drives them — fit with our culture",
};

export function ScorecardSheet({
  candidate,
  onOpenChange,
  onSave,
  onMove,
}: {
  candidate: Candidate | null;
  onOpenChange: (o: boolean) => void;
  onSave: (id: string, sc: Scorecard) => void;
  onMove: (id: string, stage: Stage, note?: string) => void;
}) {
  return (
    <Dialog open={!!candidate} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="max-w-2xl">
        {candidate && (
          <Body
            key={candidate.id}
            candidate={candidate}
            onSave={onSave}
            onMove={onMove}
            close={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Dots({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Score ${n}`}
          onClick={() => onChange(n)}
          className={cn(
            "inline-flex size-7 cursor-pointer items-center justify-center rounded-full border text-body font-semibold tabular transition",
            n <= value
              ? value >= 4
                ? "border-success bg-success text-white"
                : value === 3
                  ? "border-warning bg-warning text-white"
                  : "border-danger bg-danger text-white"
              : "border-border bg-card text-muted-foreground hover:border-primary/50",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function Body({
  candidate,
  onSave,
  onMove,
  close,
}: {
  candidate: Candidate;
  onSave: (id: string, sc: Scorecard) => void;
  onMove: (id: string, stage: Stage, note?: string) => void;
  close: () => void;
}) {
  const role = roles.find((r) => r.id === candidate.roleId)!;
  const [sc, setSc] = useState<Scorecard>(candidate.scorecard ?? emptyScorecard());
  const ev = evaluate(sc);
  const qs = starQuestions[candidate.roleId];
  const recTone = ev.rec === "Hire" ? "success" : ev.rec === "Hold" ? "warning" : ev.rec === "Reject" ? "danger" : "neutral";

  const setParam = (k: keyof Scorecard["params"], v: number) => setSc((s) => ({ ...s, params: { ...s.params, [k]: v } }));

  const submit = () => {
    if (!ev.complete) {
      toast.error("Score all five competence parameters first");
      return;
    }
    onSave(candidate.id, { ...sc, submitted: true });
    const order: Stage[] = ["Lead", "Screening", "Interview"];
    if (order.includes(candidate.stage)) onMove(candidate.id, "Scorecard", `scorecard submitted · ${ev.rec}`);
    else toast.success("Scorecard saved", { description: `${candidate.name} · ${ev.total}/25 · recommendation: ${ev.rec}` });
  };

  const sendApproval = () => {
    if (!ev.complete) {
      toast.error("Complete the scorecard before sending for approval");
      return;
    }
    onSave(candidate.id, { ...sc, submitted: true });
    onMove(candidate.id, "Approval", "sent to Janarthanan for approval");
    close();
  };

  return (
    <>
      <DialogHeader className="border-b border-border pb-5">
        <div className="flex items-start gap-4">
          <Avatar name={candidate.name} size="xl" />
          <div className="min-w-0 space-y-1">
            <DialogTitle>{candidate.name}</DialogTitle>
            <DialogDescription>
              {role.name} · {candidate.experience}
            </DialogDescription>
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-body text-muted-foreground">
              <Badge tone={stageMeta[candidate.stage].tone}>{stageMeta[candidate.stage].label}</Badge>
              <Badge tone={sourceTone[candidate.source]}>{candidate.source}</Badge>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" /> {candidate.city}
              </span>
              <span className="tabular">· Expects {inr(candidate.expectedCtc)}/mo</span>
              <span className="tabular">· Applied {fmtDate(candidate.appliedOn)}</span>
            </div>
          </div>
        </div>
      </DialogHeader>

      <DialogBody className="space-y-6 pt-5">
        {/* Live result */}
        <div className="sticky top-0 z-10 -mx-1 rounded-xl border border-border bg-card/95 p-4 shadow-card backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-body text-muted-foreground">Competence total</div>
              <div className="text-heading font-semibold tabular">
                {ev.total}
                <span className="text-body font-normal text-muted-foreground">/25</span>
              </div>
            </div>
            <div>
              <div className="text-body text-muted-foreground">Task</div>
              <div className="text-heading font-semibold tabular">
                {sc.taskScore}
                <span className="text-body font-normal text-muted-foreground">/10</span>
              </div>
            </div>
            <div>
              <div className="text-body text-muted-foreground">Weighted</div>
              <div className="text-heading font-semibold tabular">{ev.pct}%</div>
            </div>
            <div className="text-right">
              <div className="mb-1 text-body text-muted-foreground">Recommendation</div>
              <Badge tone={recTone} className="px-2.5 py-1 text-body">
                {ev.rec}
              </Badge>
            </div>
          </div>
          <Progress className="mt-3" value={ev.pct} tone={recTone === "neutral" ? "accent" : recTone} />
        </div>

        <section>
          <SectionTitle icon={ClipboardCheck} title="Competence attributes" hint="1 = poor · 5 = outstanding. A-player bar: all ≥ 4 or total ≥ 20." />
          <div className="divide-y divide-border rounded-xl border border-border">
            {(Object.keys(sc.params) as (keyof Scorecard["params"])[]).map((k) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <div className="text-body font-medium">{k}</div>
                  <div className="text-body text-muted-foreground">{paramHelp[k]}</div>
                </div>
                <Dots value={sc.params[k]} onChange={(v) => setParam(k, v)} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="STAR interview" hint="Behavioural questions — capture evidence, not impressions." />
          <div className="space-y-3">
            {(["Situation", "Task", "Action", "Result"] as const).map((k) => (
              <div key={k} className="rounded-xl border border-border p-4">
                <div className="mb-2 flex items-start gap-2.5">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-soft text-body font-bold text-primary">
                    {k[0]}
                  </span>
                  <div>
                    <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">{k}</div>
                    <div className="text-body font-medium">{qs[k]}</div>
                  </div>
                </div>
                <Textarea
                  value={sc.star[k]}
                  onChange={(e) => setSc((s) => ({ ...s, star: { ...s.star, [k]: e.target.value } }))}
                  placeholder="Interviewer notes…"
                  className="min-h-16 text-body"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <Label>Task / assignment score</Label>
            <p className="mb-3 text-body text-muted-foreground">
              {candidate.roleId === "r-editor" ? "30-sec reel from raw footage in 24 hrs" : "Mock sales call with a textile showroom owner"}
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={10}
                value={sc.taskScore}
                onChange={(e) => setSc((s) => ({ ...s, taskScore: Number(e.target.value) }))}
                className="w-full cursor-pointer accent-[var(--color-primary)]"
              />
              <span className="w-12 text-right text-subheading font-semibold tabular">{sc.taskScore}/10</span>
            </div>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Brain className="size-4 text-muted-foreground" /> Psychometric test
              </Label>
              <Switch
                checked={sc.psychometric}
                onCheckedChange={(v) => setSc((s) => ({ ...s, psychometric: v, psychometricScore: v ? s.psychometricScore || 72 : 0 }))}
              />
            </div>
            <p className="mb-3 mt-1 text-body text-muted-foreground">Optional · DISC profile via online link</p>
            {sc.psychometric ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={sc.psychometricScore}
                  onChange={(e) => setSc((s) => ({ ...s, psychometricScore: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                  className="h-8 w-20 text-body tabular"
                />
                <span className="text-body text-muted-foreground">/ 100 · profile “I-S” (Influencer–Steady)</span>
              </div>
            ) : (
              <div className="text-body text-muted-foreground">Not administered</div>
            )}
          </div>
        </section>

        <section>
          <Label>Overall remarks</Label>
          <Textarea
            value={sc.remarks}
            onChange={(e) => setSc((s) => ({ ...s, remarks: e.target.value }))}
            placeholder="Summary for the founder — strengths, risks, salary fit…"
            className="mt-1.5 text-body"
          />
        </section>
      </DialogBody>

      <DialogFooter className="sticky bottom-0 flex-wrap bg-popover">
        <Button
          variant="ghost"
          className="mr-auto text-danger"
          onClick={() => {
            onMove(candidate.id, "Rejected", "rejected after review");
            close();
          }}
        >
          <ThumbsDown /> Reject
        </Button>
        <Button variant="outline" onClick={submit}>
          <Send /> Submit scorecard
        </Button>
        <Button variant="accent" onClick={sendApproval} disabled={candidate.stage === "Approval" || candidate.stage === "Offer" || candidate.stage === "Joined"}>
          <Crown /> Send for founder approval
        </Button>
      </DialogFooter>
    </>
  );
}

function SectionTitle({ title, hint, icon: Icon }: { title: string; hint?: string; icon?: typeof ClipboardCheck }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 text-body font-semibold">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        {title}
      </div>
      {hint && <div className="text-body text-muted-foreground">{hint}</div>}
    </div>
  );
}
