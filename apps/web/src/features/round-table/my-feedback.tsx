"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, EyeOff, Handshake, Lock, Quote, Sparkles, Target, ThumbsUp, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";
import { fillName, themesOf, type RTSession } from "./data";
import { useRT } from "./store";

const Q_META = [
  { icon: ThumbsUp, tone: "text-success bg-success-soft", short: "What you do best" },
  { icon: TrendingDown, tone: "text-danger bg-danger-soft", short: "Where you fall short" },
  { icon: TrendingUp, tone: "text-primary bg-primary-soft", short: "What you can do better" },
];

/** Stable shuffle so anonymous answers don't reveal the author by order. */
function shuffle<T>(arr: T[], seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return [...arr].sort((a, b) => ((JSON.stringify(a).length * 7 + h) % 13) - ((JSON.stringify(b).length * 7 + h) % 13));
}

export function MyFeedback({ initialPerson, initialSession }: { initialPerson?: string; initialSession?: string }) {
  const role = useDemo((s) => s.role);
  const sessions = useRT((s) => s.sessions);
  const released = sessions
    .filter((s) => s.status === "released")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const defaultPerson = initialPerson ?? (role === "editor" ? "p-divya" : "p-ashwin");
  const [personId, setPersonId] = useState(defaultPerson);
  const [sessionId, setSessionId] = useState(initialSession ?? released[0]?.id ?? "");

  const session = released.find((s) => s.id === sessionId) ?? released[0];
  const previous = session ? released.filter((s) => s.id !== session.id && new Date(s.date) < new Date(session.date))[0] : undefined;

  return (
    <div className="space-y-6">
      <Link href="/round-table" className="inline-flex items-center gap-1 text-body text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Round Tables
      </Link>
      <PageHeader
        eyebrow="Round Table · private to you"
        depth="demo"
        title="What the team said about me"
        description="Anonymous feedback from your Round Table. Nobody's name is shown — focus on the patterns, not on who said it."
        className="mb-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Select
              className="h-9 w-52"
              value={personId}
              onValueChange={setPersonId}
              options={(session?.participantIds ?? []).map((pid) => ({ value: pid, label: personById(pid).name }))}
            />
            <Select
              className="h-9 w-56"
              value={session?.id}
              onValueChange={setSessionId}
              options={released.map((s) => ({ value: s.id, label: `${s.name}` }))}
            />
          </div>
        }
      />

      {!session ? (
        <Card className="p-10 text-center text-muted-foreground">No released Round Table yet.</Card>
      ) : !session.participantIds.includes(personId) ? (
        <Card className="p-10 text-center text-muted-foreground">{personById(personId).name} was not part of this Round Table.</Card>
      ) : (
        <FeedbackBody key={`${session.id}-${personId}`} session={session} personId={personId} previous={previous} />
      )}
    </div>
  );
}

function FeedbackBody({ session, personId, previous }: { session: RTSession; personId: string; previous?: RTSession }) {
  const commit = useRT((s) => s.commit);
  const log = useDemo((s) => s.log);
  const person = personById(personId);

  const all = session.answers.filter((a) => a.subjectId === personId);
  const self = all.find((a) => a.self);
  const team = all.filter((a) => !a.self && !a.hidden && !a.missed);
  const hiddenCount = all.filter((a) => a.hidden).length;

  const growthTexts = team.flatMap((a) => [a.answers[1], a.answers[2]]);
  const themes = themesOf(growthTexts);
  const prevThemes = previous
    ? themesOf(previous.answers.filter((a) => a.subjectId === personId && !a.self && !a.hidden && !a.missed).flatMap((a) => [a.answers[1], a.answers[2]]))
    : [];
  const prevCommit = previous?.commitments[personId];

  const [draft, setDraft] = useState(session.commitments[personId] ?? "");

  return (
    <div className="space-y-5">
      <Card className="glow-accent overflow-hidden">
        <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center">
          <Avatar name={person.name} size="xl" className="size-16 text-heading" />
          <div className="flex-1">
            <div className="text-heading font-semibold tracking-tight">{person.name}</div>
            <div className="text-body text-muted-foreground">
              {person.role} · {session.reviewTitle}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-body">
              <Badge tone="accent">
                {team.length} teammates answered
              </Badge>
              <Badge tone="outline">
                <Lock /> Anonymous — names never shown
              </Badge>
              {hiddenCount > 0 && (
                <Badge tone="neutral">
                  <EyeOff /> {hiddenCount} removed by manager
                </Badge>
              )}
            </div>
          </div>
          <div className="min-w-56 rounded-xl border border-border bg-card/70 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-body font-medium text-muted-foreground">
              <Sparkles className="size-3.5" /> Top themes to work on
            </div>
            <div className="flex flex-wrap gap-1.5">
              {themes.slice(0, 4).map((t) => {
                const before = prevThemes.find((p) => p.name === t.name)?.count;
                return (
                  <Badge key={t.name} tone="warning">
                    {t.name} · {t.count}
                    {before !== undefined && (
                      <span className="opacity-70">{before > t.count ? ` ↓ from ${before}` : before < t.count ? ` ↑ from ${before}` : ""}</span>
                    )}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {session.questions.map((q, i) => {
          const M = Q_META[i]!;
          const counts = new Map<string, number>();
          for (const t of team.map((a) => a.answers[i]).filter(Boolean)) counts.set(t, (counts.get(t) ?? 0) + 1);
          const list = shuffle([...counts.entries()], `${session.id}${personId}${i}`).sort((a, b) => b[1] - a[1]);
          return (
            <Card key={i} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", M.tone)}>
                    <M.icon className="size-4" />
                  </span>
                  <div>
                    <CardTitle>{M.short}</CardTitle>
                    <CardDescription>{fillName(q, personId)}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2.5">
                {self && (
                  <div className="rounded-xl border border-primary/40 bg-primary-soft/60 p-3">
                    <div className="mb-1 text-body font-semibold uppercase tracking-wider text-primary">You said</div>
                    <p className="text-body leading-snug">{self.answers[i] || "—"}</p>
                  </div>
                )}
                {list.map(([t, n], k) => (
                  <div key={k} className="flex gap-2.5 rounded-xl bg-muted/50 p-3">
                    <Quote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-body leading-snug">{t}</p>
                      {n > 1 && <p className="mt-1 text-body font-medium text-warning">Said by {n} teammates</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
                <Target className="size-4" />
              </span>
              <div>
                <CardTitle>My commitment for the next 45 days</CardTitle>
                <CardDescription>One specific change. It is checked at the next Round Table.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Flag overload to Ashwin before accepting a 4th rush job in a week."
              className="min-h-20"
            />
            <div className="flex justify-end">
              <Button
                variant="accent"
                disabled={!draft.trim()}
                onClick={() => {
                  commit(session.id, personId, draft.trim());
                  log(`${person.name} committed to an improvement from ${session.name}`, "success");
                  toast.success("Commitment saved", { description: "It will be reviewed at the next 45-day Round Table." });
                }}
              >
                <Handshake /> {session.commitments[personId] ? "Update commitment" : "Commit"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Last Round Table</CardTitle>
              <CardDescription>{previous ? `${previous.name} · ${new Date(previous.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "No earlier Round Table"}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {prevCommit ? (
              <div className="rounded-xl bg-muted/60 p-3">
                <div className="mb-1 text-body font-semibold uppercase tracking-wider text-muted-foreground">You committed</div>
                <p className="text-body">“{prevCommit}”</p>
              </div>
            ) : (
              <p className="text-body text-muted-foreground">No commitment was recorded last time.</p>
            )}
            {prevThemes.length > 0 && (
              <div>
                <div className="mb-1.5 text-body text-muted-foreground">Themes then</div>
                <div className="flex flex-wrap gap-1.5">
                  {prevThemes.slice(0, 4).map((t) => (
                    <Badge key={t.name} tone="outline">
                      {t.name} · {t.count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
