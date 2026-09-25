"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarClock, Check, ChevronLeft, ChevronRight, FilePenLine, FileQuestion, History, Lock, MapPin, ShieldCheck, UserCheck } from "lucide-react";
import { UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { personById } from "@/lib/mock/core";
import { cadenceById, FOLLOWING_STRATEGIC_LABEL, type Meeting } from "@/lib/mock/management";
import { roleLabels } from "@/lib/nav";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useMgmt, useWs } from "../store";
import { CadenceLetter, fmtDateTime, fmtLong } from "./bits";
import { CelebrationStep, CoachingStep, CompetenceStep, CompletionStep, CreationStep, DecisionsStep, NumbersStep } from "./steps";

type StepKind = "completion" | "numbers" | "competence" | "celebration" | "creation" | "decisions" | "coaching" | "clarity";

const STEPS: Record<Meeting["cadence"], { kind: StepKind; title: string; hint: string }[]> = {
  strategic: [
    { kind: "completion", title: "Completion", hint: "Previous commitments · BT / BD" },
    { kind: "numbers", title: "Numbers", hint: "Business snapshot" },
    { kind: "competence", title: "Competence development", hint: "Skills & growth plans" },
    { kind: "celebration", title: "Celebration", hint: "Recognitions" },
    { kind: "creation", title: "Creation", hint: "Next 45-day goals & strategies" },
    { kind: "decisions", title: "Decisions & commitments", hint: "Owner + due date" },
  ],
  tactical: [
    { kind: "completion", title: "Completion", hint: "Action steps · BT / BD" },
    { kind: "coaching", title: "Coaching", hint: "Breakdowns & root causes" },
    { kind: "numbers", title: "Numbers", hint: "Goal progress" },
    { kind: "decisions", title: "New action steps", hint: "Owner + due date" },
  ],
  weekly: [
    { kind: "completion", title: "Last week's commitments", hint: "Done / not done" },
    { kind: "numbers", title: "Numbers & delivery", hint: "Week snapshot" },
    { kind: "decisions", title: "Next week priorities", hint: "Owner + due date" },
  ],
  daily: [
    { kind: "clarity", title: "Clarity", hint: "Yesterday · today · blockers" },
    { kind: "decisions", title: "Unblock actions", hint: "Owner + due today" },
  ],
};

export function MeetingWorkspace({ id }: { id: string }) {
  const meeting = useMgmt((s) => s.meetings.find((m) => m.id === id));
  if (!meeting) {
    return (
      <div className="mx-auto max-w-md py-16">
        <h1 className="sr-only">Review not found</h1>
        <EmptyState
          icon={FileQuestion}
          title="Review not found"
          description="This meeting record doesn't exist in the demo data."
          action={
            <Button variant="secondary" asChild>
              <Link href="/reviews">
                <ArrowLeft /> Back to Reviews
              </Link>
            </Button>
          }
        />
      </div>
    );
  }
  return <Workspace meeting={meeting} />;
}

function Workspace({ meeting }: { meeting: Meeting }) {
  const ws = useWs(meeting.id);
  const patch = useMgmt((s) => s.patchWs);
  const setNote = useMgmt((s) => s.setNote);
  const agendas = useMgmt((s) => s.agendas);
  const cadence = cadenceById(meeting.cadence);
  const steps = STEPS[meeting.cadence];
  const locked = meeting.status === "locked";
  const step = Math.min(ws.step, steps.length - 1);
  const cur = steps[step]!;
  const setStep = (n: number) => patch(meeting.id, { step: n });
  const minutes = agendas[meeting.cadence];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/reviews" className="inline-flex items-center gap-1 rounded-lg text-body text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
          <ArrowLeft className="size-3.5" /> Reviews & Meetings
        </Link>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <CadenceLetter cadence={meeting.cadence} letter={cadence.letter} className="size-11 text-subheading" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={meeting.cadence === "strategic" ? "gold" : "accent"}>
                  {cadence.stop} · {cadence.every}
                </Badge>
                {cadence.mandatory && <Badge tone="danger">Mandatory</Badge>}
                {locked ? (
                  <Badge tone="neutral">
                    <Lock /> Locked record
                  </Badge>
                ) : (
                  <Badge tone="success" dot>
                    {meeting.status === "today" ? "Today" : "Draft · editable"}
                  </Badge>
                )}
              </div>
              <h1 className="mt-1.5 text-heading font-semibold tracking-tight">
                {meeting.title} — {new Date(meeting.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" /> {fmtLong(meeting.date)} · {new Date(meeting.date).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} –{" "}
                  {new Date(`2000-01-01T${meeting.end}:00`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> {meeting.venue}
                </span>
                <span>Facilitator: {personById(meeting.facilitatorId).name}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {meeting.cadence === "strategic" && (
              <Button variant={locked ? "outline" : "soft"} asChild>
                <Link href={meeting.id === "rv-s6" ? "/round-table/rt-6" : "/round-table/rt-7"}>
                  <UsersRound /> {locked ? "Round Table results" : "Start Round Table"}
                </Link>
              </Button>
            )}
            {locked ? <CorrectionButton meeting={meeting} /> : <LockButton meeting={meeting} />}
          </div>
        </div>
      </div>

      {locked && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-muted/60 px-4 py-3 text-body">
          <ShieldCheck className="size-4 shrink-0 text-success" />
          <span className="font-medium">
            Locked by {personById(meeting.lockedBy ?? meeting.facilitatorId).name} on {meeting.lockedAt ? fmtDateTime(meeting.lockedAt) : ""}
          </span>
          <span className="text-muted-foreground">
            Read-only. Snapshot figures preserved at lock time. Post-lock corrections require a reason and are audit-logged.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        {/* Stepper */}
        <nav className="space-y-1 xl:sticky xl:top-20 xl:self-start">
          <div className="mb-2 px-2 text-body font-medium uppercase tracking-wider text-muted-foreground">Agenda</div>
          {steps.map((s, i) => {
            const active = i === step;
            const done = locked || i < step;
            return (
              <button
                key={s.kind + i}
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => setStep(i)}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-3 rounded-xl px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                  active ? "bg-card shadow-card ring-1 ring-border" : "hover:bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-body font-semibold",
                    active ? "bg-primary text-primary-foreground" : done ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
                  )}
                >
                  {done && !active ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-body font-medium", !active && "text-foreground/85")}>{s.title}</span>
                  <span className="block text-body leading-5 text-muted-foreground">
                    {s.hint}
                    {meeting.cadence === "strategic" && minutes[i] ? ` · ${minutes[i]!.minutes}m` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Step body */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="flex-wrap pb-4">
              <div className="min-w-0">
                <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">
                  Step {step + 1} of {steps.length}
                </div>
                <CardTitle className="mt-0.5 text-subheading">{cur.title}</CardTitle>
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="icon-sm" disabled={step === 0} onClick={() => setStep(step - 1)} aria-label="Previous step">
                  <ChevronLeft />
                </Button>
                <Button variant="outline" size="sm" disabled={step === steps.length - 1} onClick={() => setStep(step + 1)}>
                  Next <ChevronRight />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {cur.kind === "completion" && <CompletionStep meeting={meeting} locked={locked} />}
              {cur.kind === "numbers" && <NumbersStep meeting={meeting} locked={locked} />}
              {cur.kind === "competence" && <CompetenceStep meeting={meeting} locked={locked} />}
              {cur.kind === "celebration" && <CelebrationStep meeting={meeting} locked={locked} />}
              {cur.kind === "creation" && <CreationStep meeting={meeting} locked={locked} />}
              {cur.kind === "decisions" && <DecisionsStep meeting={meeting} locked={locked} />}
              {cur.kind === "coaching" && <CoachingStep meeting={meeting} locked={locked} />}
              {cur.kind === "clarity" && (
                <div className="rounded-xl border border-border p-4 text-body text-muted-foreground">
                  Stand-up entries are collected in{" "}
                  <Link href="/reviews" className="font-medium text-primary hover:underline">
                    Reviews → Daily stand-up
                  </Link>
                  . Use this record to capture unblock actions.
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 text-body">
              <span className="font-medium">Notes · {cur.title}</span>
              {!locked && <span className="text-muted-foreground">Saved automatically</span>}
            </div>
            <Textarea
              value={ws.notes[step] ?? ""}
              onChange={(e) => setNote(meeting.id, step, e.target.value)}
              disabled={locked}
              placeholder={locked ? "No notes recorded for this step." : "Key points, context, who said what…"}
              className="min-h-24 disabled:cursor-not-allowed disabled:opacity-80"
            />
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Attendees meeting={meeting} locked={locked} />
          <AuditLog meeting={meeting} />
        </div>
      </div>
    </div>
  );
}

const nextAttend = { undefined: "present", present: "late", late: "absent", absent: undefined } as const;

function Attendees({ meeting, locked }: { meeting: Meeting; locked: boolean }) {
  const ws = useWs(meeting.id);
  const checkIn = useMgmt((s) => s.checkIn);
  const present = Object.values(ws.attendance).filter((a) => a === "present" || a === "late").length;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-body">
          <UserCheck className="size-4 text-muted-foreground" /> Attendance
        </CardTitle>
        <span className="text-body text-muted-foreground tabular">
          {present}/{meeting.attendeeIds.length}
        </span>
      </CardHeader>
      <CardContent className="space-y-1">
        {meeting.attendeeIds.map((pid) => {
          const p = personById(pid);
          const a = ws.attendance[pid];
          return (
            <div key={pid} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
              <Avatar name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-medium">{p.name}</div>
                <div className="truncate text-body text-muted-foreground">{p.role}</div>
              </div>
              {locked ? (
                <Badge tone={a === "present" ? "success" : a === "late" ? "warning" : "danger"} dot className="capitalize">
                  {a ?? "absent"}
                </Badge>
              ) : (
                <button
                  type="button"
                  aria-label={`Attendance for ${p.name}: ${a ?? "not checked in"}. Click to change.`}
                  onClick={() => checkIn(meeting.id, pid, nextAttend[String(a) as keyof typeof nextAttend])}
                  className={cn(
                    "shrink-0 cursor-pointer rounded-lg px-2 py-0.5 text-body font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                    a === "present"
                      ? "bg-success-soft text-success hover:bg-success-soft/70"
                      : a === "late"
                        ? "bg-warning-soft text-warning hover:bg-warning-soft/70"
                        : a === "absent"
                          ? "bg-danger-soft text-danger hover:bg-danger-soft/70"
                          : "border border-border text-muted-foreground hover:border-primary hover:text-primary",
                  )}
                >
                  {a ? a[0]!.toUpperCase() + a.slice(1) : "Check in"}
                </button>
              )}
            </div>
          );
        })}
        {!locked && present < meeting.attendeeIds.length && (
          <Button
            variant="ghost"
            size="xs"
            className="mt-1 w-full"
            onClick={() => meeting.attendeeIds.forEach((pid) => !ws.attendance[pid] && checkIn(meeting.id, pid, "present"))}
          >
            Mark everyone present
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function AuditLog({ meeting }: { meeting: Meeting }) {
  const ws = useWs(meeting.id);
  if (meeting.status !== "locked" && ws.audit.length === 0) {
    return (
      <Card className="p-5 text-body text-muted-foreground">
        <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
          <History className="size-4 text-muted-foreground" /> Record history
        </div>
        Draft — every change is tracked. Once locked, corrections need a reason and appear here.
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-body">
          <History className="size-4 text-muted-foreground" /> Audit log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3 border-l border-border pl-4">
          {ws.audit.map((a, i) => (
            <li key={i} className="relative text-body">
              <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-warning ring-4 ring-card" />
              <div className="font-medium">{a.text}</div>
              <div className="text-muted-foreground">
                Reason: {a.reason} · {a.by} · {fmtDateTime(a.at)}
              </div>
            </li>
          ))}
          {meeting.lockedAt && (
            <li className="relative text-body">
              <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-success ring-4 ring-card" />
              <div className="font-medium">Record locked · snapshot frozen</div>
              <div className="text-muted-foreground">
                {personById(meeting.lockedBy ?? meeting.facilitatorId).name} · {fmtDateTime(meeting.lockedAt)}
              </div>
            </li>
          )}
        </ol>
      </CardContent>
    </Card>
  );
}

function LockButton({ meeting }: { meeting: Meeting }) {
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const role = useDemo((s) => s.role);
  const lock = useMgmt((s) => s.lockMeeting);
  const commitments = useMgmt((s) => s.commitments);
  const ws = useWs(meeting.id);
  const facilitator = personById(meeting.facilitatorId);
  const canLock = (meeting.facilitatorId === "p-jana" && role === "founder") || (meeting.facilitatorId === "p-ashwin" && (role === "manager" || role === "founder"));
  const toReview = commitments.filter((c) => c.reviewInMeetingId === meeting.id);
  const unresolved = toReview.filter((c) => c.status !== "done").length;
  const decisions = commitments.filter((c) => c.sourceMeetingId === meeting.id).length;
  const present = Object.values(ws.attendance).filter((a) => a === "present" || a === "late").length;
  const target = meeting.cadence === "strategic" ? FOLLOWING_STRATEGIC_LABEL : `next ${meeting.cadence} review`;

  const btn = (
    <Button variant="default" disabled={!canLock} onClick={() => setOpen(true)}>
      <Lock /> Lock record
    </Button>
  );

  return (
    <>
      {canLock ? (
        btn
      ) : (
        <Tooltip content={`Only the facilitator (${facilitator.name}) can lock. You are viewing as ${roleLabels[role].label}.`}>
          <span>{btn}</span>
        </Tooltip>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock {meeting.title}?</DialogTitle>
            <DialogDescription>After locking, the record is read-only. Corrections need a reason and are audit-logged.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="grid grid-cols-1 gap-2 text-body sm:grid-cols-2">
              {[
                ["Attendance", `${present} of ${meeting.attendeeIds.length}`],
                ["Decisions → commitments", String(decisions)],
                ["BT / BD marked", `${toReview.filter((c) => c.mark === "BT").length} / ${toReview.filter((c) => c.mark === "BD").length}`],
                ["Carried forward", `${unresolved} → ${target}`],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0 rounded-xl border border-border p-3">
                  <div className="text-body text-muted-foreground">{k}</div>
                  <div className="mt-0.5 break-words font-semibold">{v}</div>
                </div>
              ))}
            </div>
            {present === 0 && (
              <Alert tone="warning" icon={AlertTriangle}>
                No attendees checked in yet — attendance will be recorded as absent.
              </Alert>
            )}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-muted/60 p-3 text-body">
              <Checkbox checked={ack} onCheckedChange={(v) => setAck(!!v)} className="mt-0.5" />
              <span>Freeze the numbers snapshot as of now and carry unresolved commitments forward automatically.</span>
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!ack}
              onClick={() => {
                const r = lock(meeting.id, facilitator.id);
                setOpen(false);
                toast.success("Record locked", { description: `Snapshot frozen · ${r.carried} commitment${r.carried === 1 ? "" : "s"} carried to ${target}` });
              }}
            >
              <Lock /> Lock record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const REASONS = ["Typo / wording", "Wrong owner recorded", "Wrong due date", "Missing decision", "Figure mis-keyed", "Other"];

function CorrectionButton({ meeting }: { meeting: Meeting }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const add = useMgmt((s) => s.addCorrection);
  const role = useDemo((s) => s.role);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FilePenLine /> Request correction
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post-lock correction</DialogTitle>
            <DialogDescription>The locked record is not overwritten — your correction is appended to the audit log with a reason.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Reason" required>
              <Select value={reason} onValueChange={setReason} placeholder="Select a reason" options={REASONS.map((r) => ({ value: r, label: r }))} />
            </Field>
            <Field label="Correction" required>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Due date of “Hire Reels editor” should read 30 Sep, not 20 Sep" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!reason || !text.trim()}
              onClick={() => {
                add(meeting.id, { reason, text: text.trim(), by: roleLabels[role].person });
                toast.success("Correction logged", { description: `Reason: ${reason} · visible in the audit log` });
                setOpen(false);
                setReason("");
                setText("");
              }}
            >
              Log correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
