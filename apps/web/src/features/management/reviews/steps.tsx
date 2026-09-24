"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ClipboardList, Goal, Hand, Lock, Plus, RefreshCw, Repeat, Sparkles, Target, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { employees, personById } from "@/lib/mock/core";
import {
  FOLLOWING_STRATEGIC_LABEL,
  snapshotS6,
  snapshotS7,
  type Commitment,
  type CreationGoal,
  type Meeting,
} from "@/lib/mock/management";
import { cn, fmtDate } from "@/lib/utils";
import { commitmentState, isEscalated, useMgmt, useWs } from "../store";
import { MarkBadge, fmtDateTime } from "./bits";

const people = employees.map((p) => ({ value: p.id, label: p.name }));

// ───────────────────────────── 1 · Completion ─────────────────────────────

export function CompletionStep({ meeting, locked }: { meeting: Meeting; locked: boolean }) {
  const all = useMgmt((s) => s.commitments);
  const list = all.filter((c) => c.reviewInMeetingId === meeting.id || c.reviewedIn?.includes(meeting.id));
  const bt = list.filter((c) => c.mark === "BT").length;
  const bd = list.filter((c) => c.mark === "BD").length;
  const open = list.length - bt - bd;
  const carry = list.filter((c) => c.status !== "done" && c.reviewInMeetingId === meeting.id).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Tally label="Breakthrough (BT)" value={bt} tone="success" />
        <Tally label="Breakdown (BD)" value={bd} tone="danger" />
        <Tally label="Not yet marked" value={open} tone="neutral" />
      </div>
      {!locked && carry > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft/60 px-3.5 py-2.5 text-[12.5px] text-warning">
          <Repeat className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {carry} commitment{carry > 1 ? "s are" : " is"} still open. On lock they are auto-carried to the next {meeting.cadence} review
            {meeting.cadence === "strategic" ? ` (${FOLLOWING_STRATEGIC_LABEL})` : ""} with the carry-forward count increased.
          </span>
        </div>
      )}
      <div className="space-y-2">
        {list.length === 0 && <Empty text="No commitments were due for review in this meeting." />}
        {list.map((c) => (
          <CommitmentReviewRow key={c.id} c={c} locked={locked} />
        ))}
      </div>
    </div>
  );
}

function CommitmentReviewRow({ c, locked }: { c: Commitment; locked: boolean }) {
  const mark = useMgmt((s) => s.markCommitment);
  const [note, setNote] = useState(c.markNote ?? "");
  const st = commitmentState(c);
  const owner = personById(c.ownerId);
  return (
    <div className={cn("rounded-xl border bg-card p-3.5 transition", c.mark === "BT" ? "border-success/30" : c.mark === "BD" ? "border-danger/30" : "border-border")}>
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={owner.name} size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium leading-snug">{c.text}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <span>{owner.name}</span>·<span>due {fmtDate(c.due)}</span>
            {st === "overdue" && <Badge tone="danger">Overdue</Badge>}
            {st === "done" && !c.mark && <Badge tone="success">Done</Badge>}
            {c.carried > 0 && (
              <Badge tone="warning">
                <Repeat /> Carried ×{c.carried}
              </Badge>
            )}
            {isEscalated(c) && <Badge tone="danger">Escalated to founder</Badge>}
          </div>
        </div>
        {locked ? (
          <MarkBadge mark={c.mark} />
        ) : (
          <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
            {(["BT", "BD"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  const next = c.mark === m ? undefined : m;
                  mark(c.id, next, note);
                  if (next === "BT") toast.success("Marked Breakthrough", { description: c.text });
                }}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1 text-[12px] font-semibold transition",
                  c.mark === m ? (m === "BT" ? "bg-success text-white shadow-sm" : "bg-danger text-white shadow-sm") : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>
      {(c.mark === "BD" || (locked && c.markNote)) && (
        <div className="mt-3 pl-9">
          {locked ? (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-[12.5px] text-muted-foreground">{c.markNote}</p>
          ) : (
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => mark(c.id, c.mark, note)}
              placeholder="What broke down, and what's the new action step?"
              className={cn("h-8 text-[12.5px]", !note && "border-danger/40")}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── 2 · Numbers ─────────────────────────────

const metricTone = {
  success: { text: "text-success", bar: "success" },
  warning: { text: "text-warning", bar: "warning" },
  danger: { text: "text-danger", bar: "danger" },
  accent: { text: "text-accent", bar: "accent" },
  info: { text: "text-info", bar: "info" },
} as const;

export function NumbersStep({ meeting, locked }: { meeting: Meeting; locked: boolean }) {
  const ws = useWs(meeting.id);
  const patch = useMgmt((s) => s.patchWs);
  const [refreshing, setRefreshing] = useState(false);
  const data = meeting.id === "rv-s6" ? snapshotS6 : snapshotS7;
  const stamp = ws.snapshotAt;
  return (
    <div className="space-y-4">
      <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px]", locked ? "bg-muted/70" : "bg-info-soft/70 text-info")}>
        <span className="inline-flex items-center gap-2">
          {locked ? <Lock className="size-3.5" /> : <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />}
          {locked
            ? `Snapshot figures preserved at lock time · ${stamp ? fmtDateTime(stamp) : ""} — later changes in source modules do not alter this record`
            : `Live snapshot · ${stamp ? `refreshed ${fmtDateTime(stamp)}` : "prepared automatically 25 Sep, 7:00 AM"} · freezes when the record is locked`}
        </span>
        {!locked && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              setRefreshing(true);
              setTimeout(() => {
                setRefreshing(false);
                patch(meeting.id, { snapshotAt: `2026-09-25T${new Date().toTimeString().slice(0, 8)}` });
                toast.success("Snapshot refreshed", { description: "8 data blocks re-pulled from Billing, Production, QC, Time & Costing" });
              }, 700);
            }}
          >
            Refresh
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.map((m) => (
          <div key={m.key} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[12.5px] font-medium text-muted-foreground">{m.label}</span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground">{m.source}</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className={cn("text-[22px] font-semibold tracking-tight tabular", metricTone[m.tone].text)}>{m.value}</span>
              {m.target && <span className="text-[12px] text-muted-foreground">target {m.target}</span>}
            </div>
            {m.progress !== undefined && <Progress value={m.progress} tone={metricTone[m.tone].bar} className="mt-2" />}
            <p className="mt-2 text-[12px] text-muted-foreground">{m.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── 3 · Competence ─────────────────────────────

export function CompetenceStep({ meeting, locked }: { meeting: Meeting; locked: boolean }) {
  const ws = useWs(meeting.id);
  const patch = useMgmt((s) => s.patchWs);
  const [f, setF] = useState({ personId: "p-surya", skill: "", plan: "", due: "2026-11-24" });
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {ws.competence.map((c) => {
          const p = personById(c.personId);
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5">
              <Avatar name={p.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium">{c.skill}</div>
                <div className="text-[12px] text-muted-foreground">
                  {p.name} · {c.plan}
                </div>
              </div>
              <div className="w-40">
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>by {fmtDate(c.due)}</span>
                  <span className="tabular">{c.progress}%</span>
                </div>
                <Progress value={c.progress} tone={c.progress >= 100 ? "success" : "accent"} />
              </div>
            </div>
          );
        })}
      </div>
      {!locked && (
        <Card className="space-y-3 p-4">
          <div className="text-[13px] font-medium">Add development plan</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Person">
              <Select value={f.personId} onValueChange={(v) => setF({ ...f, personId: v })} options={people} />
            </Field>
            <Field label="Skill / competence">
              <Input value={f.skill} onChange={(e) => setF({ ...f, skill: e.target.value })} placeholder="e.g. Motion text in After Effects" />
            </Field>
            <Field label="Plan" className="sm:col-span-2">
              <Input value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} placeholder="Course, mentor, practice project" />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!f.skill.trim()}
              onClick={() => {
                patch(meeting.id, { competence: [...ws.competence, { id: `cd-${Date.now()}`, ...f, progress: 0 }] });
                toast.success("Development plan added", { description: `${personById(f.personId).name} · ${f.skill}` });
                setF({ ...f, skill: "", plan: "" });
              }}
            >
              <Plus /> Add plan
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ───────────────────────────── 4 · Celebration ─────────────────────────────

export function CelebrationStep({ meeting, locked }: { meeting: Meeting; locked: boolean }) {
  const ws = useWs(meeting.id);
  const patch = useMgmt((s) => s.patchWs);
  const [claps, setClaps] = useState<Record<string, number>>({});
  const [f, setF] = useState({ personId: "p-meena", title: "", story: "" });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ws.recognitions.map((r, i) => {
          const p = personById(r.personId);
          const n = claps[r.id] ?? 0;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-gold-soft to-card p-4"
            >
              <Trophy className="absolute -right-3 -top-3 size-20 text-gold/10" />
              <div className="flex items-center gap-2.5">
                <Avatar name={p.name} size="md" />
                <div>
                  <div className="text-[13.5px] font-semibold">{p.name}</div>
                  <div className="text-[11.5px] text-muted-foreground">{p.role}</div>
                </div>
              </div>
              <div className="mt-3 text-[14px] font-semibold text-gold">{r.title}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/80">{r.story}</p>
              <div className="mt-3 flex items-center justify-between text-[11.5px] text-muted-foreground">
                <span>Nominated by {r.by}</span>
                <motion.button
                  whileTap={{ scale: 1.25 }}
                  onClick={() => setClaps({ ...claps, [r.id]: n + 1 })}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-card px-2 py-1 font-medium text-foreground shadow-card hover:text-gold"
                >
                  <Hand className="size-3.5" /> {n > 0 ? n : "Applaud"}
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>
      {!locked && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Sparkles className="size-4 text-gold" /> Nominate a recognition
          </div>
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <Select value={f.personId} onValueChange={(v) => setF({ ...f, personId: v })} options={people} />
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Headline — e.g. Oct calendar approved early" />
          </div>
          <Textarea value={f.story} onChange={(e) => setF({ ...f, story: e.target.value })} placeholder="What happened and why it matters" className="min-h-16" />
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!f.title.trim()}
              onClick={() => {
                patch(meeting.id, { recognitions: [...ws.recognitions, { id: `rc-${Date.now()}`, ...f, by: "Janarthanan" }] });
                toast.success(`${personById(f.personId).name} recognised`, { description: f.title });
                setF({ ...f, title: "", story: "" });
              }}
            >
              <Trophy /> Add recognition
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ───────────────────────────── 5 · Creation ─────────────────────────────

const typeTone = { financial: "gold", functional: "info", learning: "accent", operational: "neutral" } as const;

export function CreationStep({ meeting, locked }: { meeting: Meeting; locked: boolean }) {
  const ws = useWs(meeting.id);
  const patch = useMgmt((s) => s.patchWs);
  const [linked, setLinked] = useState<string[]>([]);
  const [f, setF] = useState<Omit<CreationGoal, "id">>({ title: "", ownerId: "p-priya", measure: "", due: "2026-11-24", type: "functional" });
  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-muted-foreground">Goals and strategies for the next 45 days (until {meeting.id === "rv-s6" ? "10 Oct" : "24 Nov"} 2026). Each should be S.M.A.R.T. and have one owner.</p>
      <div className="space-y-2">
        {ws.creation.map((g) => (
          <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Target className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">{g.title}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <Badge tone={typeTone[g.type]}>{g.type}</Badge>
                {personById(g.ownerId).name} · measured by {g.measure} · by {fmtDate(g.due)}
              </div>
            </div>
            {!locked && (
              <Button
                size="xs"
                variant={linked.includes(g.id) ? "ghost" : "outline"}
                disabled={linked.includes(g.id)}
                onClick={() => {
                  setLinked([...linked, g.id]);
                  toast.success("Added to Goals", { description: `${g.title} → goal tree under ${personById(g.ownerId).name}` });
                }}
              >
                {linked.includes(g.id) ? <Check /> : <Goal />}
                {linked.includes(g.id) ? "In Goals" : "Push to Goals"}
              </Button>
            )}
          </div>
        ))}
      </div>
      {!locked && (
        <Card className="space-y-3 p-4">
          <div className="text-[13px] font-medium">New goal / strategy</div>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Launch ₹25K/month starter reel package for clinics" />
          <div className="grid gap-3 sm:grid-cols-4">
            <Select value={f.ownerId} onValueChange={(v) => setF({ ...f, ownerId: v })} options={people} />
            <Input value={f.measure} onChange={(e) => setF({ ...f, measure: e.target.value })} placeholder="Measure" />
            <Input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
            <Select
              value={f.type}
              onValueChange={(v) => setF({ ...f, type: v as CreationGoal["type"] })}
              options={["financial", "functional", "learning", "operational"].map((t) => ({ value: t, label: t[0]!.toUpperCase() + t.slice(1) }))}
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!f.title.trim()}
              onClick={() => {
                patch(meeting.id, { creation: [...ws.creation, { ...f, id: `cg-${Date.now()}`, measure: f.measure || "Manual check-in" }] });
                toast.success("Goal created for next 45 days", { description: f.title });
                setF({ ...f, title: "", measure: "" });
              }}
            >
              <Plus /> Add goal
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ───────────────────────────── 6 · Decisions ─────────────────────────────

export function DecisionsStep({ meeting, locked }: { meeting: Meeting; locked: boolean }) {
  const all = useMgmt((s) => s.commitments);
  const add = useMgmt((s) => s.addCommitment);
  const createTask = useMgmt((s) => s.createTask);
  const list = all.filter((c) => c.sourceMeetingId === meeting.id);
  const [f, setF] = useState({ text: "", ownerId: "p-ashwin", due: "2026-10-24", task: true });
  const reviewIn = meeting.cadence === "strategic" ? (meeting.id === "rv-s6" ? "rv-s7" : "rv-s8") : meeting.id;

  return (
    <div className="space-y-4">
      {!locked && (
        <Card className="space-y-3 p-4">
          <div className="text-[13px] font-medium">Add decision</div>
          <Textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Decision — becomes a commitment with an owner and due date" className="min-h-16" />
          <div className="flex flex-wrap items-center gap-3">
            <Select value={f.ownerId} onValueChange={(v) => setF({ ...f, ownerId: v })} options={people} className="w-44" />
            <Input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} className="w-40" />
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
              <Checkbox checked={f.task} onCheckedChange={(v) => setF({ ...f, task: !!v })} />
              Create task in Projects & Tasks
            </label>
            <Button
              size="sm"
              variant="accent"
              className="ml-auto"
              disabled={!f.text.trim()}
              onClick={() => {
                add({ text: f.text.trim(), ownerId: f.ownerId, due: f.due, sourceMeetingId: meeting.id, reviewInMeetingId: reviewIn, taskCreated: f.task });
                toast.success("Decision recorded as commitment", {
                  description: `${personById(f.ownerId).name} · due ${fmtDate(f.due)}${f.task ? " · task created" : ""}`,
                });
                setF({ ...f, text: "" });
              }}
            >
              <Plus /> Add decision
            </Button>
          </div>
        </Card>
      )}
      <div className="space-y-2">
        {list.length === 0 && <Empty text={locked ? "No decisions were recorded." : "No decisions yet. Every decision needs an owner and a due date."} />}
        {list.map((c) => {
          const p = personById(c.ownerId);
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5">
              <Avatar name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium">{c.text}</div>
                <div className="text-[11.5px] text-muted-foreground">
                  {p.name} · due {fmtDate(c.due)} · reviewed in {c.reviewInMeetingId === "rv-s8" ? FOLLOWING_STRATEGIC_LABEL : "next review"}
                </div>
              </div>
              {c.taskCreated ? (
                <Badge tone="success">
                  <ClipboardList /> Task created
                </Badge>
              ) : (
                !locked && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      createTask(c.id);
                      toast.success("Task created", { description: `Assigned to ${p.name} in Projects & Tasks` });
                    }}
                  >
                    <ClipboardList /> Create task
                  </Button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────── Coaching / Clarity (tactical, daily) ─────────────────────────────

export function CoachingStep({ meeting }: { meeting: Meeting; locked: boolean }) {
  const all = useMgmt((s) => s.commitments);
  const bds = all.filter((c) => c.reviewInMeetingId === meeting.id && c.mark === "BD");
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-muted-foreground">Coach each owner through their breakdowns: what got in the way, what support they need, what the new action step is.</p>
      {bds.length === 0 ? (
        <Empty text="No breakdowns marked yet — mark BT/BD in Completion first." />
      ) : (
        bds.map((c) => (
          <div key={c.id} className="rounded-xl border border-danger/30 bg-card p-3.5 text-[13px]">
            <div className="font-medium">{c.text}</div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              {personById(c.ownerId).name} · {c.markNote || "no note yet"}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ───────────────────────────── shared ─────────────────────────────

function Tally({ label, value, tone }: { label: string; value: number; tone: "success" | "danger" | "neutral" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-[22px] font-semibold tabular", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground")}>{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border p-6 text-center text-[12.5px] text-muted-foreground">{text}</div>;
}
