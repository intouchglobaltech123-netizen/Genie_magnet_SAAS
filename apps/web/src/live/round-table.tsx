"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, EyeOff, Megaphone, Play, Plus, SkipForward, Timer, Users } from "lucide-react";
import { toast } from "sonner";
import { askAbout, RT_STATUS_LABEL, type RtSessionRow, type RtStatus } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { errorMessage } from "./api";
import { useCan, useMe, usePeople, useRoundTable, useRoundTables, useRtAction, useRtMine } from "./queries";

const onError = (e: unknown) => toast.error(errorMessage(e));
const STATUS_TONE: Record<RtStatus, BadgeTone> = { draft: "neutral", live: "danger", moderation: "warning", released: "success" };
/** A question asked of the person about themselves. */
const aboutYou = (q: string) => q.replaceAll("{name}", "you").replaceAll("does you", "do you");

function NewRoundTable({ onClose, onMade }: { onClose: () => void; onMade: (id: string) => void }) {
  const act = useRtAction();
  const people = usePeople();
  const [name, setName] = useState("Strategic review — Round Table");
  const [ids, setIds] = useState<string[]>([]);
  const [seconds, setSeconds] = useState("180");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Round Table</DialogTitle>
          <DialogDescription>Everyone answers three questions about each person — and themselves — one person per timed round.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Seconds for each person">
            <Input type="number" min={30} max={1800} value={seconds} onChange={(e) => setSeconds(e.target.value)} />
          </Field>
          <div>
            <div className="mb-1 text-body font-medium">Who takes part</div>
            <div className="grid gap-1 sm:grid-cols-2">
              {(people.data ?? []).map((p) => (
                <label key={p.user.id} className="flex items-center gap-1.5 text-body">
                  <Checkbox
                    aria-label={p.user.name}
                    checked={ids.includes(p.user.id)}
                    onCheckedChange={(c) => setIds(c === true ? [...ids, p.user.id] : ids.filter((x) => x !== p.user.id))}
                  />
                  {p.user.name}
                </label>
              ))}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={ids.length < 2 || act.isPending}
            onClick={() =>
              act.mutate(
                { step: "create", body: { name, participantIds: ids, secondsPerPerson: Number(seconds) || 180 } },
                { onSuccess: (r) => (onClose(), onMade((r as RtSessionRow).id)), onError },
              )
            }
          >
            Set up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The time now, kept fresh four times a second. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, []);
  return now;
}

function Countdown({ endsAt }: { endsAt: string }) {
  const now = useNow();
  const left = Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000));
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-heading font-semibold tabular-nums",
        left <= 10 ? "bg-danger-soft text-danger" : "bg-muted",
      )}
    >
      <Timer className="size-5" />
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}

function LiveRound({ s }: { s: RtSessionRow }) {
  const me = useMe().data!;
  const act = useRtAction();
  const c = s.current!;
  const [draft, setDraft] = useState<{ key: number; answers: [string, string, string] } | null>(null);
  const answers = draft?.key === c.index ? draft.answers : (s.myAnswer ?? ["", "", ""]);
  const taking = s.participants.some((p) => p.id === me.user.id);
  const self = c.subject.id === me.user.id;
  const now = useNow();
  const over = Date.parse(c.endsAt) < now;
  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-body text-muted-foreground">
            Round {c.index + 1} of {s.participants.length}
          </div>
          <div className="text-heading font-semibold">{self ? "About you" : c.subject.name}</div>
        </div>
        <Countdown endsAt={c.endsAt} />
      </div>
      <div className="text-body text-muted-foreground">
        <Users className="mr-1 inline size-4" />
        {s.written} of {s.participants.length} have written
      </div>
      {taking ? (
        <div className="space-y-3">
          {s.questions.map((q, i) => (
            <Field key={i} label={self ? aboutYou(q) : askAbout(q, c.subject.name)}>
              <Textarea
                rows={2}
                disabled={over}
                value={answers[i]}
                onChange={(e) => setDraft({ key: c.index, answers: answers.map((a, j) => (j === i ? e.target.value : a)) as [string, string, string] })}
              />
            </Field>
          ))}
          <Button
            disabled={over || act.isPending || !answers.some((a) => a.trim())}
            onClick={() => act.mutate({ step: "answer", id: s.id, answers }, { onSuccess: () => toast.success("Saved"), onError })}
          >
            {s.myAnswer ? "Save again" : "Save"}
          </Button>
          {over && <p className="text-body text-danger">The buzzer has gone for this round.</p>}
        </div>
      ) : (
        <p className="text-body text-muted-foreground">You are facilitating; those taking part are writing.</p>
      )}
    </Card>
  );
}

function Moderation({ s }: { s: RtSessionRow }) {
  const act = useRtAction();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const bySubject = s.participants.map((p) => ({ p, rows: (s.answers ?? []).filter((a) => a.subjectId === p.id && !a.missed) }));
  return (
    <div className="space-y-4">
      {bySubject.map(({ p, rows }) => (
        <SectionCard key={p.id} title={p.name} description={`${rows.length} wrote`}>
          <ul className="space-y-2">
            {rows.map((a) => (
              <li key={a.id} className={cn("rounded-xl border border-border p-3 text-body", a.hidden && "opacity-60")}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {a.author}
                    {a.self && " (about themselves)"}
                  </span>
                  {s.status === "moderation" &&
                    (a.hidden ? (
                      <Button size="xs" variant="ghost" onClick={() => act.mutate({ step: "hide", answerId: a.id, hidden: false, reason: "" }, { onError })}>
                        Show it again
                      </Button>
                    ) : (
                      <span className="flex gap-1.5">
                        <Input
                          className="h-7 w-48"
                          placeholder="Why hide it"
                          value={reasons[a.id] ?? ""}
                          onChange={(e) => setReasons({ ...reasons, [a.id]: e.target.value })}
                        />
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={!reasons[a.id]?.trim()}
                          onClick={() => act.mutate({ step: "hide", answerId: a.id, hidden: true, reason: reasons[a.id]! }, { onError })}
                        >
                          <EyeOff />
                          Hide
                        </Button>
                      </span>
                    ))}
                </div>
                <ol className="list-decimal space-y-0.5 pl-5">
                  {a.answers.map((x, i) => (
                    <li key={i}>{x || <span className="text-muted-foreground">—</span>}</li>
                  ))}
                </ol>
                {a.hidden && <div className="mt-1 text-danger">Hidden: {a.hiddenReason}</div>}
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}
    </div>
  );
}

function MyFeedback({ s }: { s: RtSessionRow }) {
  const mine = useRtMine(s.id, true);
  const act = useRtAction();
  const [text, setText] = useState("");
  if (mine.isPending) return <SkeletonRows rows={4} />;
  if (mine.error) return <Alert tone="info">{errorMessage(mine.error)}</Alert>;
  const f = mine.data;
  const q = (i: number) => aboutYou(s.questions[i]!);
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <SectionCard key={i} title={q(i)}>
          <ul className="space-y-1.5 text-body">
            {f.self?.[i] && (
              <li className="rounded-lg bg-primary-soft px-3 py-2">
                <span className="font-medium">You said:</span> {f.self[i]}
              </li>
            )}
            {f.peers
              .map((p) => p[i])
              .filter(Boolean)
              .map((x, j) => (
                <li key={j} className="rounded-lg bg-muted px-3 py-2">
                  {x}
                </li>
              ))}
            {!f.peers.some((p) => p[i]) && <li className="text-muted-foreground">Nothing from the team on this.</li>}
          </ul>
        </SectionCard>
      ))}
      <SectionCard title="Your commitment" description="What you will do better in the next 45 days. It is carried in the reviews like any other commitment.">
        {f.commitment ? (
          <p className="text-body">
            {f.commitment.text} <span className="text-muted-foreground">· by {f.commitment.due}</span>
          </p>
        ) : (
          <div className="flex gap-2">
            <Input placeholder="I will…" value={text} onChange={(e) => setText(e.target.value)} />
            <Button
              disabled={text.trim().length < 3 || act.isPending}
              onClick={() => act.mutate({ step: "commit", id: s.id, text }, { onSuccess: () => toast.success("Committed"), onError })}
            >
              Commit
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function SessionView({ id, onBack }: { id: string; onBack: () => void }) {
  const can = useCan();
  const me = useMe().data!;
  const q = useRoundTable(id);
  const act = useRtAction();
  if (q.isPending) return <SkeletonRows rows={6} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const s = q.data;
  const runs = s.facilitator?.id === me.user.id || can("reports", "approve");
  const taking = s.participants.some((p) => p.id === me.user.id);
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft />
        Round Tables
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-subheading font-semibold">{s.name}</h2>
          <p className="text-body text-muted-foreground">
            {s.participants.length} people · {Math.round(s.secondsPerPerson / 60) || 1} min each{s.facilitator && ` · facilitated by ${s.facilitator.name}`}
          </p>
        </div>
        <span className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[s.status]}>{RT_STATUS_LABEL[s.status]}</Badge>
          {runs && s.status === "draft" && (
            <Button onClick={() => act.mutate({ step: "start", id }, { onError })}>
              <Play />
              Start
            </Button>
          )}
          {runs && s.status === "live" && (
            <Button onClick={() => act.mutate({ step: "next", id }, { onError })}>
              <SkipForward />
              {s.current && s.current.index >= s.participants.length - 1 ? "Finish" : "Next person"}
            </Button>
          )}
          {runs && s.status === "moderation" && (
            <Button onClick={() => act.mutate({ step: "release", id }, { onSuccess: () => toast.success("Released — everyone is told"), onError })}>
              <Megaphone />
              Release
            </Button>
          )}
        </span>
      </div>
      {s.status === "draft" && (
        <SectionCard title="The questions" description="Asked about each person in turn.">
          <ol className="list-decimal space-y-1 pl-5 text-body">
            {s.questions.map((x) => (
              <li key={x}>{x.replaceAll("{name}", "…")}</li>
            ))}
          </ol>
          <p className="mt-3 text-body text-muted-foreground">Order: {s.participants.map((p) => p.name).join(", ")}</p>
        </SectionCard>
      )}
      {s.status === "live" && s.current && <LiveRound s={s} />}
      {(s.status === "moderation" || s.status === "released") && runs && s.answers && <Moderation s={s} />}
      {s.status === "moderation" && !runs && <Alert tone="info">The facilitator is going through what was written. You are told when it is released.</Alert>}
      {s.status === "released" && taking && <MyFeedback s={s} />}
    </div>
  );
}

/** /app/round-table: Round Tables, each run live in timed rounds. */
export function LiveRoundTable({ sessionId }: { sessionId?: string }) {
  const can = useCan();
  const list = useRoundTables();
  const [open, setOpen] = useState<string | null>(sessionId ?? null);
  const [making, setMaking] = useState(false);
  return (
    <>
      <PageHeader
        title="Round Table"
        description="Peer review in the strategic review: what each person does best, where they fall short and what they can do better — in timed rounds, moderated, then released."
        actions={
          !open &&
          can("reports", "edit") && (
            <Button onClick={() => setMaking(true)}>
              <Plus />
              New Round Table
            </Button>
          )
        }
      />
      {open ? (
        <SessionView id={open} onBack={() => setOpen(null)} />
      ) : list.isPending ? (
        <SkeletonRows rows={4} />
      ) : !list.data?.length ? (
        <EmptyState icon={Users} title="No Round Tables yet" description="Round Tables you take part in show here." />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Round Table</TH>
                <TH>Set up</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {list.data.map((r) => (
                <TR key={r.id} className="cursor-pointer" onClick={() => setOpen(r.id)}>
                  <TD className="font-medium">{r.name}</TD>
                  <TD>{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[r.status]}>{RT_STATUS_LABEL[r.status]}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
      {making && <NewRoundTable onClose={() => setMaking(false)} onMade={setOpen} />}
    </>
  );
}
