"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, EyeOff, MessagesSquare, Play, ShieldCheck, Timer, Users, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { employees, personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";
import { DEFAULT_QUESTIONS, TEAM, type RTStatus } from "./data";
import { useRT } from "./store";

export const statusMeta: Record<RTStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Ready to start", tone: "accent" },
  live: { label: "Live now", tone: "danger" },
  moderation: { label: "Manager review", tone: "warning" },
  released: { label: "Released", tone: "success" },
};

const rules = [
  { icon: Users, title: "Everyone reviews everyone", text: "One teammate at a time appears on every screen. All participants answer the same three questions about them." },
  { icon: Timer, title: "Timed rounds with a buzzer", text: "The manager sets 1–2 minutes per person. When the buzzer goes, the sheet auto-submits and the next person appears." },
  { icon: UserRoundCheck, title: "Self-review on your own turn", text: "When it is your name on screen, you answer about yourself — compare how you see yourself with how the team sees you." },
  { icon: EyeOff, title: "Anonymous to the employee", text: "Employees see what the team said without names. The manager sees authors to resolve conflicts." },
  { icon: ShieldCheck, title: "Manager reviews, then releases", text: "Nothing reaches the team until the manager has checked it, hidden anything abusive and released the results." },
];

export function RoundTableList() {
  const sessions = useRT((s) => s.sessions);
  const role = useDemo((s) => s.role);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management · Module 42 · 45-day review"
        depth="demo"
        title="Round Table"
        description="The team feedback circle inside every 45-day strategic review — built to surface and resolve conflicts, not to score people."
        className="mb-0"
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/round-table/me">
                <MessagesSquare /> My feedback
              </Link>
            </Button>
            {(role === "founder" || role === "manager") && (
              <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
                <Play /> Start Round Table
              </Button>
            )}
          </>
        }
      />

      <Card className="glow-accent overflow-hidden">
        <CardContent className="grid gap-4 p-5 md:grid-cols-5">
          {rules.map((r) => (
            <div key={r.title} className="space-y-1.5">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <r.icon className="size-4" />
              </span>
              <div className="text-body font-semibold">{r.title}</div>
              <p className="text-body leading-relaxed text-muted-foreground">{r.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {sessions.map((s) => {
          const meta = statusMeta[s.status];
          const total = s.participantIds.length;
          const done = Math.min(s.currentIndex, total);
          return (
            <Card key={s.id} className="flex flex-col">
              <CardHeader>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>{s.name}</CardTitle>
                    <Badge tone={meta.tone} dot>
                      {meta.label}
                    </Badge>
                  </div>
                  <CardDescription>
                    {s.reviewTitle} ·{" "}
                    {new Date(s.date).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-body text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <AvatarStack names={s.participantIds.map((id) => personById(id).name)} max={7} />
                    {total} people
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" /> {s.secondsPerPerson}s per person · ~{Math.ceil((s.secondsPerPerson * total) / 60)} min
                  </span>
                  <span>Facilitator: {personById(s.facilitatorId).name}</span>
                </div>
                <ol className="space-y-1 rounded-xl bg-muted/60 p-3 text-body">
                  {s.questions.map((q, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-muted-foreground">Q{i + 1}</span>
                      {q.replaceAll("{name}", "…")}
                    </li>
                  ))}
                </ol>
                {s.status !== "draft" && s.status !== "released" && (
                  <div className="text-body text-muted-foreground">
                    Round {Math.min(done + 1, total)} of {total}
                  </div>
                )}
                <div className="mt-auto flex justify-end">
                  <Button variant={s.status === "draft" || s.status === "live" ? "accent" : "outline"} size="sm" asChild>
                    <Link href={`/round-table/${s.id}`}>
                      {s.status === "draft" ? "Open lobby" : s.status === "live" ? "Rejoin live session" : s.status === "moderation" ? "Review & release" : "View results"}
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <SetupDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function SetupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const create = useRT((s) => s.create);
  const log = useDemo((s) => s.log);
  const [name, setName] = useState("Round Table · Production team");
  const [selected, setSelected] = useState<string[]>(TEAM);
  const [questions, setQuestions] = useState<[string, string, string]>(DEFAULT_QUESTIONS);
  const [seconds, setSeconds] = useState(60);
  const pool = employees.filter((p) => p.id !== "p-jana");

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start a Round Table</DialogTitle>
          <DialogDescription>Pick the team, set the three questions and the time each person gets. Everyone joins from their own laptop.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Session name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Part of">
              <Input value="45-Day Strategic Review #7 · 10 Oct 2026" readOnly className="text-muted-foreground" />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-body font-medium">Team members ({selected.length})</span>
              <span className="text-body text-muted-foreground">The manager is reviewed too</span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {pool.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition",
                    selected.includes(p.id) ? "border-primary/50 bg-primary-soft/50" : "border-border hover:bg-muted/60",
                  )}
                >
                  <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <Avatar name={p.name} size="sm" />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-body font-medium">{p.name}</span>
                    <span className="block truncate text-body text-muted-foreground">{p.role}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-body font-medium">The three questions</span>
            {questions.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 font-mono text-body text-muted-foreground">Q{i + 1}</span>
                <Input
                  value={q}
                  onChange={(e) => {
                    const nq = [...questions] as [string, string, string];
                    nq[i] = e.target.value;
                    setQuestions(nq);
                  }}
                />
              </div>
            ))}
            <p className="pl-8 text-body text-muted-foreground">{"{name}"} is replaced with the teammate&apos;s name on screen.</p>
          </div>

          <div className="space-y-2">
            <span className="text-body font-medium">Time per person</span>
            <div className="flex flex-wrap gap-2">
              {[60, 90, 120].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeconds(s)}
                  className={cn(
                    "cursor-pointer rounded-lg border px-4 py-2 text-body font-medium transition",
                    seconds === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                  )}
                >
                  {s / 60 === 1 ? "1 min" : `${s / 60} min`}
                </button>
              ))}
              <span className="self-center text-body text-muted-foreground">
                Total ≈ {Math.ceil((seconds * selected.length) / 60)} min for {selected.length} people
              </span>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={selected.length < 3}
            onClick={() => {
              const order = TEAM.filter((id) => selected.includes(id)).concat(selected.filter((id) => !TEAM.includes(id)));
              const id = create({
                name,
                reviewTitle: "45-Day Strategic Review #7",
                participantIds: order,
                questions,
                secondsPerPerson: seconds,
                date: "2026-10-10T15:00:00",
              });
              log(`${name} created — ${order.length} participants, ${seconds}s per person`, "accent");
              toast.success("Round Table created", { description: "Share the join link — everyone opens it on their laptop." });
              onOpenChange(false);
              router.push(`/round-table/${id}`);
            }}
          >
            <Play /> Create & open lobby
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
