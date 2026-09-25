"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  FastForward,
  Loader2,
  Monitor,
  Pause,
  Play,
  Plus,
  Send,
  ShieldCheck,
  SkipForward,
  UserRound,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";
import { bankAnswer, FLAG_WORDS, fillName, firstName, themesOf, type RTSession } from "./data";
import { statusMeta } from "./list-view";
import { useRT } from "./store";

function playBuzzer() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(196, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.75);
  } catch {}
}

export function SessionView({ id }: { id: string }) {
  const session = useRT((s) => s.sessions.find((x) => x.id === id));
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);

  if (!session) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Round Table not found"
        description="It may have been removed, or the link is incorrect."
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link href="/round-table">
              <ArrowLeft /> Back to Round Tables
            </Link>
          </Button>
        }
      />
    );
  }

  const viewer = viewerId ?? session.facilitatorId;
  const isManager = viewer === session.facilitatorId;
  const meta = statusMeta[session.status];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <Link href="/round-table" className="mb-2 inline-flex items-center gap-1 text-body text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Round Tables
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-heading font-semibold tracking-tight">{session.name}</h1>
            <Badge tone={meta.tone} dot>
              {meta.label}
            </Badge>
          </div>
          <p className="mt-1 text-body text-muted-foreground">
            {session.reviewTitle} · facilitated by {personById(session.facilitatorId).name} · {session.secondsPerPerson}s per person
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Monitor className="size-4 text-muted-foreground" />
          <span className="text-body text-muted-foreground">This laptop is</span>
          <Select
            className="h-8 w-full sm:w-52"
            value={viewer}
            onValueChange={setViewerId}
            options={session.participantIds.map((pid) => ({
              value: pid,
              label: `${personById(pid).name}${pid === session.facilitatorId ? " · Manager" : ""}`,
            }))}
          />
        </div>
      </div>

      {session.status === "draft" && <Lobby session={session} isManager={isManager} />}
      {session.status === "live" && <LiveRound key={`${session.currentIndex}-${viewer}`} session={session} viewerId={viewer} isManager={isManager} speed={speed} setSpeed={setSpeed} />}
      {session.status === "moderation" && (isManager ? <Moderation session={session} /> : <WaitingRelease />)}
      {session.status === "released" && <ReleasedSummary session={session} isManager={isManager} viewerId={viewer} />}
    </div>
  );
}

// ───────────────────────────── Lobby ─────────────────────────────

function Lobby({ session, isManager }: { session: RTSession; isManager: boolean }) {
  const start = useRT((s) => s.start);
  const log = useDemo((s) => s.log);
  const [joined, setJoined] = useState(1);
  const total = session.participantIds.length;

  useEffect(() => {
    const t = setInterval(() => setJoined((j) => (j >= total ? j : j + 1)), 650);
    return () => clearInterval(t);
  }, [total]);

  const allIn = joined >= total;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Waiting room</CardTitle>
            <CardDescription>Everyone opens the Round Table on their own laptop. The session starts when the manager presses Start.</CardDescription>
          </div>
          <Badge tone={allIn ? "success" : "warning"}>
            <Wifi /> {Math.min(joined, total)} / {total} joined
          </Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {session.participantIds.map((pid, i) => {
            const p = personById(pid);
            const isIn = i < joined;
            return (
              <div
                key={pid}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-500",
                  isIn ? "border-success/40 bg-success-soft/40" : "border-dashed border-border opacity-50",
                )}
              >
                <div className="relative">
                  <Avatar name={p.name} size="xl" />
                  {isIn && <span className="absolute bottom-0 right-0 size-3.5 rounded-full bg-success ring-2 ring-card" />}
                </div>
                <div className="w-full min-w-0 leading-tight">
                  <div className="truncate text-body font-medium" title={p.name}>{p.name}</div>
                  <div className="text-body text-muted-foreground">{isIn ? "Joined · laptop" : "Waiting…"}</div>
                </div>
                {pid === session.facilitatorId && <Badge tone="accent">Manager</Badge>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Questions for every person</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.questions.map((q, i) => (
              <div key={i} className="flex gap-2 rounded-lg bg-muted/60 p-2.5 text-body">
                <span className="font-mono text-muted-foreground">Q{i + 1}</span>
                {q.replaceAll("{name}", "…")}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Order of rounds</CardTitle>
            <CardDescription>
              {total} rounds × {session.secondsPerPerson}s ≈ {Math.ceil((total * session.secondsPerPerson) / 60)} minutes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5">
              {session.participantIds.map((pid, i) => (
                <li key={pid} className="flex items-center gap-2 text-body">
                  <span className="w-5 text-right font-mono text-body text-muted-foreground">{i + 1}</span>
                  <Avatar name={personById(pid).name} size="xs" />
                  {personById(pid).name}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        {isManager ? (
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            disabled={!allIn}
            onClick={() => {
              start(session.id);
              log(`${session.name} started — ${total} participants`, "accent");
              toast.success("Round Table started", { description: `First up: ${personById(session.participantIds[0]!).name}` });
            }}
          >
            {allIn ? <Play /> : <Loader2 className="animate-spin" />}
            {allIn ? "Start Round Table" : "Waiting for everyone to join…"}
          </Button>
        ) : (
          <div className="rounded-xl border border-dashed border-border-strong bg-surface-secondary p-4 text-center text-body text-muted-foreground">
            Waiting for {personById(session.facilitatorId).name} to start the session…
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── Live round ─────────────────────────────

interface SimPlan {
  authorId: string;
  atFraction: number;
  miss: boolean;
}

function makePlan(session: RTSession, viewerId: string): SimPlan[] {
  return session.participantIds
    .filter((pid) => pid !== viewerId)
    .map((pid) => ({ authorId: pid, atFraction: 0.2 + Math.random() * 0.72, miss: pid !== session.participantIds[session.currentIndex] && Math.random() < 0.04 }));
}

function LiveRound({
  session,
  viewerId,
  isManager,
  speed,
  setSpeed,
}: {
  session: RTSession;
  viewerId: string;
  isManager: boolean;
  speed: number;
  setSpeed: (s: number) => void;
}) {
  const submit = useRT((s) => s.submit);
  const next = useRT((s) => s.next);
  const log = useDemo((s) => s.log);

  const subjectId = session.participantIds[session.currentIndex]!;
  const subject = personById(subjectId);
  const isSelf = subjectId === viewerId;
  const durationMs = session.secondsPerPerson * 1000;
  const total = session.participantIds.length;
  const upNext = session.participantIds[session.currentIndex + 1];

  const [plan] = useState(() => makePlan(session, viewerId));
  const [remaining, setRemaining] = useState(durationMs);
  const [paused, setPaused] = useState(false);
  const [buzz, setBuzz] = useState(false);
  const [draft, setDraft] = useState<[string, string, string]>(["", "", ""]);

  const remRef = useRef(durationMs);
  const pausedRef = useRef(false);
  const speedRef = useRef(speed);
  const endedRef = useRef(false);
  const doneSims = useRef(new Set<string>());
  const draftRef = useRef(draft);

  const roundAnswers = session.answers.filter((a) => a.subjectId === subjectId);
  const mine = roundAnswers.find((a) => a.authorId === viewerId);
  const submittedIds = new Set(roundAnswers.map((a) => a.authorId));

  useEffect(() => {
    pausedRef.current = paused;
    speedRef.current = speed;
    draftRef.current = draft;
  }, [paused, speed, draft]);

  useEffect(() => {
    const finish = (reason: "buzzer" | "all-in") => {
      if (endedRef.current) return;
      endedRef.current = true;
      const s = useRT.getState().sessions.find((x) => x.id === session.id)!;
      const have = new Set(s.answers.filter((a) => a.subjectId === subjectId).map((a) => a.authorId));
      // Auto-submit whatever is on every open sheet when the buzzer goes.
      for (const pid of session.participantIds) {
        if (have.has(pid)) continue;
        if (pid === viewerId) {
          const d = draftRef.current;
          const missed = d.every((x) => !x.trim());
          submit(session.id, { subjectId, authorId: pid, answers: d, self: pid === subjectId, missed });
        } else {
          const p = plan.find((x) => x.authorId === pid);
          submit(session.id, {
            subjectId,
            authorId: pid,
            answers: p?.miss ? ["", "", ""] : bankAnswer(subjectId, pid),
            self: pid === subjectId,
            missed: !!p?.miss,
          });
        }
      }
      if (reason === "buzzer") playBuzzer();
      setBuzz(true);
      setTimeout(() => {
        next(session.id);
        if (session.currentIndex + 1 >= session.participantIds.length) {
          log(`${session.name} — all rounds complete, awaiting manager review`, "warning");
          toast("All rounds complete", { description: "Manager reviews the sheets before results are released." });
        }
      }, 2600);
    };

    const t = setInterval(() => {
      if (endedRef.current || pausedRef.current) return;
      remRef.current = Math.max(0, remRef.current - 100 * speedRef.current);
      setRemaining(remRef.current);
      const elapsedFrac = 1 - remRef.current / durationMs;
      for (const p of plan) {
        if (p.miss || doneSims.current.has(p.authorId) || elapsedFrac < p.atFraction) continue;
        doneSims.current.add(p.authorId);
        submit(session.id, { subjectId, authorId: p.authorId, answers: bankAnswer(subjectId, p.authorId), self: p.authorId === subjectId, missed: false });
      }
      const s = useRT.getState().sessions.find((x) => x.id === session.id);
      const count = s ? s.answers.filter((a) => a.subjectId === subjectId).length : 0;
      if (remRef.current <= 0) finish("buzzer");
      else if (count >= session.participantIds.length) finish("all-in");
    }, 100);
    return () => clearInterval(t);
  }, [session.id, session.name, session.currentIndex, session.participantIds, subjectId, viewerId, durationMs, plan, submit, next, log]);

  const secs = Math.ceil(remaining / 1000);
  const frac = remaining / durationMs;
  const urgent = secs <= 10;

  return (
    <div className="relative grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      {/* Participant sheet */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border bg-muted/40 px-5 py-2.5 text-body text-muted-foreground">
          <span>
            Round <span className="font-semibold text-foreground">{session.currentIndex + 1}</span> of {total}
          </span>
          <span className="flex items-center gap-1.5">
            <UserRound className="size-3.5" /> Your screen · {personById(viewerId).name}
          </span>
        </div>
        <div className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={subjectId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex min-w-0 flex-1 items-center gap-4"
            >
              <Avatar name={subject.name} size="xl" className="size-20 shrink-0 text-heading" />
              <div className="min-w-0">
                <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">
                  {isSelf ? "Your turn · self-review" : "Now reviewing"}
                </div>
                <div className="text-heading font-semibold leading-tight tracking-tight">{subject.name}</div>
                <div className="text-body text-muted-foreground">
                  {subject.role} · {subject.department}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          <TimerRing frac={frac} secs={secs} urgent={urgent} paused={paused} />
        </div>

        {isSelf && (
          <div className="mx-5 mb-3 rounded-xl bg-primary-soft px-4 py-2.5 text-body text-primary">
            It&apos;s your name on everyone&apos;s screen. Answer the same questions about yourself — you&apos;ll compare this with what the team says.
          </div>
        )}

        <CardContent className="space-y-4">
          {session.questions.map((q, i) => (
            <div key={i} className="space-y-1.5">
              <label className="flex items-baseline gap-2 text-body font-medium">
                <span className="font-mono text-body text-muted-foreground">Q{i + 1}</span>
                {isSelf ? q.replaceAll("{name}", "you") : fillName(q, subjectId)}
              </label>
              <Textarea
                disabled={!!mine || buzz}
                value={mine ? mine.answers[i] : draft[i]}
                placeholder={mine ? "" : "Be specific and kind — describe the behaviour, not the person."}
                className="min-h-[72px] text-body"
                onChange={(e) => {
                  const d = [...draft] as [string, string, string];
                  d[i] = e.target.value;
                  setDraft(d);
                }}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-body text-muted-foreground">
              {mine ? "Submitted — waiting for the buzzer or the rest of the team." : "Your sheet auto-submits when the buzzer goes."}
            </span>
            {mine ? (
              <Badge tone="success">
                <Check /> Submitted
              </Badge>
            ) : (
              <Button
                variant="accent"
                disabled={draft.every((x) => !x.trim()) || buzz}
                onClick={() => {
                  submit(session.id, { subjectId, authorId: viewerId, answers: draft, self: isSelf, missed: false });
                  toast.success(`Sheet for ${firstName(subjectId)} submitted`);
                }}
              >
                <Send /> Submit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Right rail */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sheets in</CardTitle>
              <CardDescription>
                {submittedIds.size} of {total} submitted for {firstName(subjectId)}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={(submittedIds.size / total) * 100} tone={submittedIds.size === total ? "success" : "accent"} />
            <ul className="space-y-1.5">
              {session.participantIds.map((pid) => {
                const done = submittedIds.has(pid);
                return (
                  <li key={pid} className="flex items-center gap-2 text-body">
                    <Avatar name={personById(pid).name} size="xs" />
                    <span className="flex-1 truncate">
                      {personById(pid).name}
                      {pid === subjectId && <span className="text-muted-foreground"> · self</span>}
                    </span>
                    {done ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : (
                      <span className="flex items-center gap-1 text-body text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> writing
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {isManager && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Manager controls</CardTitle>
                <CardDescription>Only the facilitator sees these</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)} disabled={buzz}>
                  {paused ? <Play /> : <Pause />} {paused ? "Resume" : "Pause"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={buzz}
                  onClick={() => {
                    remRef.current += 30000;
                    setRemaining(remRef.current);
                    toast("+30 seconds added");
                  }}
                >
                  <Plus /> 30 sec
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="col-span-2"
                  disabled={buzz}
                  onClick={() => {
                    remRef.current = 0;
                    setRemaining(0);
                  }}
                >
                  <Bell /> Ring buzzer now
                </Button>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-body text-muted-foreground">
                  <FastForward className="size-3.5" /> Demo speed
                </div>
                <div className="flex gap-1.5">
                  {[1, 5, 10].map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-label={`Demo speed ${s}×`}
                      aria-pressed={speed === s}
                      onClick={() => setSpeed(s)}
                      className={cn(
                        "flex-1 cursor-pointer rounded-lg border py-1 text-body font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                        speed === s ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-muted",
                      )}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <SkipForward className="size-4 text-muted-foreground" />
            <div className="flex-1 text-body">
              {upNext ? (
                <>
                  <span className="text-muted-foreground">Up next · </span>
                  <span className="font-medium">{personById(upNext).name}</span>
                </>
              ) : (
                <span className="text-muted-foreground">Last round — then manager review</span>
              )}
            </div>
            {upNext && <Avatar name={personById(upNext).name} size="sm" />}
          </CardContent>
        </Card>
      </div>

      <AnimatePresence>
        {buzz && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="text-center">
              <div className="mx-auto mb-4 inline-flex size-16 items-center justify-center rounded-full bg-danger text-background shadow-md">
                <Bell className="size-8" />
              </div>
              <div className="text-heading font-semibold tracking-tight">Time&apos;s up!</div>
              <div className="mt-1 text-subheading text-muted-foreground">
                {upNext ? (
                  <>
                    Next on everyone&apos;s screen: <span className="font-semibold text-foreground">{personById(upNext).name}</span>
                  </>
                ) : (
                  "That was the last round."
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TimerRing({ frac, secs, urgent, paused }: { frac: number; secs: number; urgent: boolean; paused: boolean }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-28 shrink-0" role="timer" aria-label={`${Math.floor(secs / 60)} minutes ${secs % 60} seconds ${paused ? "paused" : "left"}`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={urgent ? "var(--color-danger)" : "var(--color-primary)"}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-heading font-semibold leading-none tabular", urgent && "text-danger")}>
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
        </span>
        <span className="text-body uppercase leading-4 tracking-wide text-muted-foreground">{paused ? "paused" : "left"}</span>
      </div>
    </div>
  );
}

// ───────────────────────────── Moderation ─────────────────────────────

function Moderation({ session }: { session: RTSession }) {
  const toggleHidden = useRT((s) => s.toggleHidden);
  const release = useRT((s) => s.release);
  const log = useDemo((s) => s.log);
  const [subject, setSubject] = useState(session.participantIds[0]!);

  const answers = session.answers.filter((a) => a.subjectId === subject);
  const flaggedTotal = session.answers.filter((a) => !a.hidden && a.answers.some((t) => FLAG_WORDS.test(t))).length;
  const hiddenTotal = session.answers.filter((a) => a.hidden).length;
  const missedTotal = session.answers.filter((a) => a.missed).length;

  return (
    <div className="space-y-4">
      <Card className="border-warning/40">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-subheading font-semibold">Manager review before release</div>
            <p className="text-body text-muted-foreground">
              You can see who wrote each answer. Hide anything abusive or personal, then release — employees only ever see their feedback anonymously.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-body">
            <Badge tone="neutral">{session.answers.length} sheets</Badge>
            <Badge tone={flaggedTotal ? "danger" : "success"}>{flaggedTotal} flagged</Badge>
            <Badge tone="neutral">{hiddenTotal} hidden</Badge>
            <Badge tone="neutral">{missedTotal} missed buzzer</Badge>
          </div>
          <Button
            variant="accent"
            onClick={() => {
              release(session.id);
              log(`${session.name} results released to ${session.participantIds.length} people`, "success");
              toast.success("Results released", { description: "Each person can now see what the team said about them — anonymously." });
            }}
          >
            <Send /> Release to team
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="p-2">
          {session.participantIds.map((pid) => {
            const list = session.answers.filter((a) => a.subjectId === pid);
            const flagged = list.some((a) => !a.hidden && a.answers.some((t) => FLAG_WORDS.test(t)));
            return (
              <button
                key={pid}
                type="button"
                aria-current={subject === pid ? "true" : undefined}
                onClick={() => setSubject(pid)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-body transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                  subject === pid ? "bg-muted font-medium" : "hover:bg-muted/60",
                )}
              >
                <Avatar name={personById(pid).name} size="sm" />
                <span className="flex-1 truncate">{personById(pid).name}</span>
                {flagged && <AlertTriangle className="size-3.5 text-danger" aria-label="Flagged language" />}
                <span className="text-body text-muted-foreground tabular">{list.length}</span>
              </button>
            );
          })}
        </Card>

        <div className="space-y-3">
          {answers.length === 0 && (
            <EmptyState compact icon={UserRound} title="No sheets yet" description={`Nobody submitted a sheet about ${firstName(subject)}.`} />
          )}
          {answers.map((a) => {
            const flagged = a.answers.some((t) => FLAG_WORDS.test(t));
            return (
              <Card key={a.id} className={cn("p-4", a.hidden && "opacity-55")}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Avatar name={personById(a.authorId).name} size="sm" />
                  <span className="text-body font-medium">{personById(a.authorId).name}</span>
                  {a.self && <Badge tone="accent">Self-review</Badge>}
                  {a.missed && <Badge tone="warning">Missed buzzer</Badge>}
                  {flagged && !a.hidden && (
                    <Badge tone="danger">
                      <AlertTriangle /> Flagged language
                    </Badge>
                  )}
                  {a.hidden && <Badge tone="neutral">Hidden · {a.hiddenReason}</Badge>}
                  <Tooltip content={a.hidden ? "Show to employee" : "Hide from employee"}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto"
                      aria-label={a.hidden ? "Show to employee" : "Hide from employee"}
                      disabled={a.self || a.missed}
                      onClick={() => {
                        toggleHidden(session.id, a.id, "Hidden by manager — not constructive");
                        toast(a.hidden ? "Answer restored" : "Answer hidden from employee");
                      }}
                    >
                      {a.hidden ? <Eye /> : <EyeOff />}
                    </Button>
                  </Tooltip>
                </div>
                {a.missed ? (
                  <p className="text-body italic text-muted-foreground">No answer before the buzzer.</p>
                ) : (
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {a.answers.map((t, i) => (
                      <div key={i} className="rounded-lg bg-muted/50 p-2.5">
                        <dt className="mb-1 text-body font-medium uppercase tracking-wider text-muted-foreground">
                          {["Does best", "Falls short", "Do better"][i]}
                        </dt>
                        <dd className="text-body leading-snug">{t || <span className="text-muted-foreground">—</span>}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WaitingRelease() {
  return (
    <Card className="p-5">
      <EmptyState
        icon={ShieldCheck}
        title="All rounds are done"
        description="Your manager is reviewing the sheets. You'll be notified as soon as your feedback is released."
      />
    </Card>
  );
}

// ───────────────────────────── Released ─────────────────────────────

function ReleasedSummary({ session, isManager, viewerId }: { session: RTSession; isManager: boolean; viewerId: string }) {
  const answered = session.answers.filter((a) => !a.self);
  const participation = answered.length ? answered.filter((a) => !a.missed).length / answered.length : 0;

  return (
    <div className="space-y-4">
      <Card className="glow-accent">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
            <CheckCircle2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-subheading font-semibold">Results released</div>
            <p className="text-body text-muted-foreground">
              {session.releasedAt &&
                new Date(session.releasedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{" "}
              · {Math.round(participation * 100)}% of sheets answered before the buzzer
            </p>
          </div>
          <Button variant="accent" asChild>
            <Link href={`/round-table/me?person=${viewerId}&session=${session.id}`}>
              <Eye /> {isManager ? "Open my feedback" : "See what the team said about me"}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {isManager && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Team pulse</CardTitle>
              <CardDescription>Most common themes in &quot;falls short&quot; and &quot;do better&quot; — use these to steer the Competence step of the review</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {session.participantIds.map((pid) => {
              const texts = session.answers
                .filter((a) => a.subjectId === pid && !a.self && !a.hidden && !a.missed)
                .flatMap((a) => [a.answers[1], a.answers[2]]);
              const themes = themesOf(texts).slice(0, 3);
              return (
                <div key={pid} className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Avatar name={personById(pid).name} size="sm" />
                    <span className="min-w-0 truncate text-body font-medium">{personById(pid).name}</span>
                    {session.commitments[pid] ? (
                      <Badge tone="success" className="ml-auto">
                        Committed
                      </Badge>
                    ) : (
                      <Badge tone="neutral" className="ml-auto">
                        No commitment yet
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {themes.length === 0 && <span className="text-body text-muted-foreground">No recurring themes</span>}
                    {themes.map((t) => (
                      <Badge key={t.name} tone="outline">
                        {t.name} · {t.count}
                      </Badge>
                    ))}
                  </div>
                  {session.commitments[pid] && <p className="mt-2 text-body text-muted-foreground">“{session.commitments[pid]}”</p>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
