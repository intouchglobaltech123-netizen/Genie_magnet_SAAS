"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarPlus, Check, Gavel, ListTodo, Lock, Plus, Trash2, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { toast } from "sonner";
import { ATTENDANCE_MARKS, type AttendanceMark, type CadenceRow, type CommitmentRow, REVIEW_BLOCK_LABEL, REVIEW_BLOCKS, type ReviewBlock } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { errorMessage } from "./api";
import { useCadences, useCan, useCommitments, useDecisions, useMe, useMeeting, useMeetings, usePeople, useProjectAction, useReviewAction } from "./queries";

const onError = (e: unknown) => toast.error(errorMessage(e));
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const MARK_TONE: Record<AttendanceMark, BadgeTone> = { present: "success", late: "warning", absent: "danger" };
const LETTER: Record<CadenceRow["cadence"], string> = { daily: "O", weekly: "W", tactical: "T", strategic: "S" };

// ─── Commitments ──────────────────────────────────────────────────────

function CommitmentLine({ c, meetingId, editable, action }: { c: CommitmentRow; meetingId?: string; editable: boolean; action?: React.ReactNode }) {
  const act = useReviewAction();
  const [breaking, setBreaking] = useState(false);
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const late = c.status === "open" && c.due < today();
  return (
    <li className="rounded-xl border border-border p-3 text-body">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span>
          <span className={cn("font-medium", c.status === "done" && "text-muted-foreground line-through")}>{c.text}</span>
          <span className="block text-muted-foreground">
            {c.owner.name} · by {fmtDay(c.due)}
            {c.carried > 0 && ` · carried ${c.carried}×`}
            {c.madeIn && ` · from ${c.madeIn.title}`}
          </span>
          {c.markNote && <span className="block text-muted-foreground">Last: {c.markNote}</span>}
        </span>
        <span className="flex items-center gap-1.5">
          {late && <Badge tone="danger">Past due</Badge>}
          {action}
          {c.status === "done" ? (
            <Badge tone="success">Done</Badge>
          ) : (
            editable && (
              <>
                <Button size="xs" variant="ghost" onClick={() => setBreaking(!breaking)}>
                  <TrendingDown />
                  Breakdown
                </Button>
                <Button size="xs" variant="success" onClick={() => act.mutate({ step: "mark", id: c.id, mark: "BT", note: "", meetingId }, { onError })}>
                  <TrendingUp />
                  Breakthrough
                </Button>
              </>
            )
          )}
        </span>
      </div>
      {breaking && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Input className="flex-1" placeholder="What got in the way" value={note} onChange={(e) => setNote(e.target.value)} />
          <Input type="date" className="w-40" aria-label="New due day" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button
            size="sm"
            disabled={note.trim().length < 2}
            onClick={() =>
              act.mutate({ step: "mark", id: c.id, mark: "BD", note, meetingId, due: due || undefined }, { onSuccess: () => setBreaking(false), onError })
            }
          >
            Carry forward
          </Button>
        </div>
      )}
    </li>
  );
}

function NewCommitment({ meetingId }: { meetingId?: string }) {
  const act = useReviewAction();
  const people = usePeople();
  const [f, setF] = useState({ text: "", ownerId: "", due: "" });
  return (
    <div className="grid gap-2 sm:grid-cols-[2fr_1fr_160px_auto]">
      <Input placeholder="What will be done" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
      <Select
        value={f.ownerId || undefined}
        placeholder="Owner"
        onValueChange={(v) => setF({ ...f, ownerId: v })}
        options={(people.data ?? []).map((p) => ({ value: p.user.id, label: p.user.name }))}
      />
      <Input type="date" aria-label="Due" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
      <Button
        disabled={!f.text.trim() || !f.ownerId || !f.due || act.isPending}
        onClick={() => act.mutate({ step: "commit", body: { ...f, meetingId } }, { onSuccess: () => setF({ text: "", ownerId: "", due: "" }), onError })}
      >
        <Plus />
        Add
      </Button>
    </div>
  );
}

// ─── A review ─────────────────────────────────────────────────────────

function MeetingView({ id, onBack }: { id: string; onBack: () => void }) {
  const can = useCan();
  const me = useMe().data!;
  const q = useMeeting(id);
  const act = useReviewAction();
  const people = usePeople();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState("");
  const [rec, setRec] = useState({ personId: "", title: "", story: "" });
  if (q.isPending) return <SkeletonRows rows={8} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const m = q.data;
  const runs = m.status === "scheduled" && (can("reports", "edit") || m.facilitator?.id === me.user.id);
  const saveNote = (i: number) =>
    notes[i] !== undefined &&
    notes[i] !== (m.notes[String(i)] ?? "") &&
    act.mutate({ step: "update", id, body: { notes: { [String(i)]: notes[i]! } } }, { onError });
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft />
        Reviews
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{m.title}</h2>
          <p className="text-body text-muted-foreground">
            {when(m.startsAt)}
            {m.venue && ` · ${m.venue}`}
            {m.facilitator && ` · facilitated by ${m.facilitator.name}`}
          </p>
        </div>
        <span className="flex items-center gap-2">
          <Badge tone={m.status === "locked" ? "success" : "info"}>{m.status === "locked" ? `Locked by ${m.lockedBy}` : "Open"}</Badge>
          {m.status === "scheduled" && can("reports", "approve") && (
            <Button onClick={() => act.mutate({ step: "lock", id }, { onSuccess: () => toast.success("Locked — the figures are kept"), onError })}>
              <Lock />
              Lock the review
            </Button>
          )}
        </span>
      </div>

      <SectionCard title="Attendance">
        <div className="flex flex-wrap gap-3">
          {m.participants.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-body">
              <span>{p.name}</span>
              {runs ? (
                <Select
                  value={m.attendance[p.id] ?? "_none"}
                  onValueChange={(v) =>
                    act.mutate({ step: "update", id, body: { attendance: { [p.id]: v === "_none" ? null : (v as AttendanceMark) } } }, { onError })
                  }
                  options={[{ value: "_none", label: "—" }, ...ATTENDANCE_MARKS.map((k) => ({ value: k, label: k[0]!.toUpperCase() + k.slice(1) }))]}
                />
              ) : (
                m.attendance[p.id] && <Badge tone={MARK_TONE[m.attendance[p.id]!]}>{m.attendance[p.id]}</Badge>
              )}
            </div>
          ))}
          {!m.participants.length && <span className="text-body text-muted-foreground">No one is set up for this review yet.</span>}
        </div>
      </SectionCard>

      {m.figures.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {m.figures.map((f) => (
            <Card key={f.key} className="p-4">
              <div className="mb-2 text-body font-medium">{f.label}</div>
              <dl className="space-y-1 text-body">
                {f.lines.map((l) => (
                  <div key={l.label} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{l.label}</dt>
                    <dd className={cn("text-right font-medium", l.tone === "bad" && "text-danger", l.tone === "good" && "text-success")}>{l.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>
      )}
      {m.status === "locked" && <p className="text-body text-muted-foreground">The figures are as they were when the review was locked.</p>}

      <SectionCard title="Agenda">
        <ol className="space-y-3">
          {m.agenda.map((a, i) => (
            <li key={i}>
              <div className="flex justify-between text-body font-medium">
                <span>
                  {i + 1}. {a.title}
                </span>
                <span className="text-muted-foreground">{a.minutes} min</span>
              </div>
              {a.note && <div className="text-body text-muted-foreground">{a.note}</div>}
              {runs ? (
                <Textarea
                  rows={2}
                  className="mt-1"
                  aria-label={`Notes on ${a.title}`}
                  value={notes[i] ?? m.notes[String(i)] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [i]: e.target.value })}
                  onBlur={() => saveNote(i)}
                />
              ) : (
                m.notes[String(i)] && <p className="mt-1 whitespace-pre-line text-body">{m.notes[String(i)]}</p>
              )}
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard title="Commitments to review" description="Each marked breakthrough (done) or breakdown (carried forward with what got in the way).">
        {m.toReview.length ? (
          <ul className="space-y-2">
            {m.toReview.map((c) => (
              <CommitmentLine key={c.id} c={c} meetingId={id} editable={runs} />
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">Nothing due by this review.</p>
        )}
      </SectionCard>

      <SectionCard title="New commitments">
        {m.made.length > 0 && (
          <ul className="mb-3 space-y-2">
            {m.made.map((c) => (
              <CommitmentLine key={c.id} c={c} editable={false} />
            ))}
          </ul>
        )}
        {runs && <NewCommitment meetingId={id} />}
      </SectionCard>

      <SectionCard title="Decisions">
        {m.decisions.length > 0 && (
          <ul className="mb-3 space-y-1 text-body">
            {m.decisions.map((d) => (
              <li key={d.id} className="flex gap-2">
                <Gavel className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {d.text}
                  {d.owner && <span className="text-muted-foreground"> · {d.owner.name}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {runs && (
          <div className="flex gap-2">
            <Input placeholder="What was decided" value={decision} onChange={(e) => setDecision(e.target.value)} />
            <Button
              variant="secondary"
              disabled={decision.trim().length < 3}
              onClick={() => act.mutate({ step: "decide", body: { text: decision, meetingId: id } }, { onSuccess: () => setDecision(""), onError })}
            >
              Record
            </Button>
          </div>
        )}
      </SectionCard>

      {(m.cadence === "strategic" || m.recognitions.length > 0) && (
        <SectionCard title="Celebration" description="Recognitions for the period.">
          {m.recognitions.length > 0 && (
            <ul className="mb-3 space-y-1 text-body">
              {m.recognitions.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <Trophy className="mt-0.5 size-4 shrink-0 text-accent-strong" />
                  <span>
                    <span className="font-medium">{r.name}</span> — {r.title}
                    {r.story && <span className="block text-muted-foreground">{r.story}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {runs && (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
              <Select
                value={rec.personId || undefined}
                placeholder="Who"
                onValueChange={(v) => setRec({ ...rec, personId: v })}
                options={(people.data ?? []).map((p) => ({ value: p.user.id, label: p.user.name }))}
              />
              <Input placeholder="For" value={rec.title} onChange={(e) => setRec({ ...rec, title: e.target.value })} />
              <Input placeholder="The story" value={rec.story} onChange={(e) => setRec({ ...rec, story: e.target.value })} />
              <Button
                variant="secondary"
                disabled={!rec.personId || rec.title.trim().length < 2}
                onClick={() =>
                  act.mutate(
                    { step: "update", id, body: { recognitions: [...m.recognitions.map(({ personId, title, story }) => ({ personId, title, story })), rec] } },
                    { onSuccess: () => setRec({ personId: "", title: "", story: "" }), onError },
                  )
                }
              >
                Add
              </Button>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

// ─── Setting up a rhythm ──────────────────────────────────────────────

function CadenceDialog({ c, onClose }: { c: CadenceRow; onClose: () => void }) {
  const act = useReviewAction();
  const people = usePeople();
  const [f, setF] = useState({ ...c, everyDays: String(c.everyDays), minutes: String(c.minutes) });
  const [agenda, setAgenda] = useState(c.agenda.map((a) => ({ ...a, minutes: String(a.minutes) })));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{c.name}</DialogTitle>
          <DialogDescription>How often, who takes part, the agenda, and the figures it looks at.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Name" className="sm:col-span-2">
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Every (days)">
              <Input type="number" min={1} value={f.everyDays} onChange={(e) => setF({ ...f, everyDays: e.target.value })} />
            </Field>
            <Field label="Minutes">
              <Input type="number" min={5} value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} />
            </Field>
            <Field label="When" className="sm:col-span-2">
              <Input value={f.schedule} onChange={(e) => setF({ ...f, schedule: e.target.value })} />
            </Field>
            <Field label="Facilitator">
              <Select
                value={f.facilitatorId ?? "_none"}
                onValueChange={(v) => setF({ ...f, facilitatorId: v === "_none" ? null : v })}
                options={[{ value: "_none", label: "No one" }, ...(people.data ?? []).map((p) => ({ value: p.user.id, label: p.user.name }))]}
              />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-body">
              <Switch aria-label="Everyone must attend" checked={f.mandatory} onCheckedChange={(mandatory) => setF({ ...f, mandatory })} />
              Everyone must attend
            </label>
            <Field label="What it is for" className="sm:col-span-4">
              <Textarea rows={2} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} />
            </Field>
          </div>
          <div>
            <div className="mb-1 text-body font-medium">Who takes part</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(people.data ?? []).map((p) => (
                <label key={p.user.id} className="flex items-center gap-1.5 text-body">
                  <Checkbox
                    aria-label={p.user.name}
                    checked={f.participantIds.includes(p.user.id)}
                    onCheckedChange={(on) =>
                      setF({ ...f, participantIds: on === true ? [...f.participantIds, p.user.id] : f.participantIds.filter((x) => x !== p.user.id) })
                    }
                  />
                  {p.user.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-body font-medium">Agenda</div>
            <div className="space-y-2">
              {agenda.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={a.title} onChange={(e) => setAgenda(agenda.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    aria-label="Minutes"
                    value={a.minutes}
                    onChange={(e) => setAgenda(agenda.map((x, j) => (j === i ? { ...x, minutes: e.target.value } : x)))}
                  />
                  <Button size="icon-sm" variant="ghost" aria-label="Remove item" onClick={() => setAgenda(agenda.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="secondary" onClick={() => setAgenda([...agenda, { title: "", minutes: "10", note: "" }])}>
                <Plus />
                Add an item
              </Button>
            </div>
          </div>
          <div>
            <div className="mb-1 text-body font-medium">Figures it looks at</div>
            <div className="grid gap-1 sm:grid-cols-2">
              {REVIEW_BLOCKS.map((b) => (
                <label key={b} className="flex items-center gap-1.5 text-body">
                  <Checkbox
                    aria-label={REVIEW_BLOCK_LABEL[b]}
                    checked={f.blocks.includes(b)}
                    onCheckedChange={(on) => setF({ ...f, blocks: on === true ? [...f.blocks, b] : (f.blocks.filter((x) => x !== b) as ReviewBlock[]) })}
                  />
                  {REVIEW_BLOCK_LABEL[b]}
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
            disabled={act.isPending}
            onClick={() =>
              act.mutate(
                {
                  step: "cadence",
                  cadence: c.cadence,
                  body: {
                    name: f.name,
                    everyDays: Number(f.everyDays) || 1,
                    purpose: f.purpose,
                    minutes: Number(f.minutes) || 15,
                    schedule: f.schedule,
                    mandatory: f.mandatory,
                    facilitatorId: f.facilitatorId,
                    participantIds: f.participantIds,
                    agenda: agenda.filter((a) => a.title.trim()).map((a) => ({ ...a, minutes: Number(a.minutes) || 0 })),
                    blocks: f.blocks,
                  },
                },
                { onSuccess: () => (toast.success("Saved"), onClose()), onError },
              )
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({ c, onClose, onScheduled }: { c: CadenceRow; onClose: () => void; onScheduled: (id: string) => void }) {
  const act = useReviewAction();
  const [at, setAt] = useState("");
  const [venue, setVenue] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule the {c.name.toLowerCase()}</DialogTitle>
          <DialogDescription>{c.schedule || `Every ${c.everyDays} days`}. Those taking part are told.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="When">
            <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </Field>
          <Field label="Where">
            <Input value={venue} placeholder="e.g. Studio, or a Meet link" onChange={(e) => setVenue(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!at || act.isPending}
            onClick={() =>
              act.mutate(
                { step: "schedule", body: { cadence: c.cadence, startsAt: new Date(at).toISOString(), venue: venue || undefined } },
                { onSuccess: (r) => (onClose(), onScheduled((r as { id: string }).id)), onError },
              )
            }
          >
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Rhythms({ onOpen }: { onOpen: (id: string) => void }) {
  const can = useCan();
  const cadences = useCadences(can("reports", "view"));
  const meetings = useMeetings();
  const [editing, setEditing] = useState<CadenceRow | null>(null);
  const [scheduling, setScheduling] = useState<CadenceRow | null>(null);
  return (
    <div className="space-y-4">
      {can("reports", "view") && (
        <div className="grid gap-3 md:grid-cols-2">
          {cadences.data?.map((c) => (
            <Card key={c.cadence} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft font-bold text-primary">
                    {LETTER[c.cadence]}
                  </span>
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-body text-muted-foreground">
                      Every {c.everyDays === 1 ? "day" : `${c.everyDays} days`} ·{" "}
                      {c.minutes >= 120 ? `${Math.round(c.minutes / 60)} hours` : `${c.minutes} min`}
                      {c.mandatory && " · everyone"}
                    </div>
                  </div>
                </div>
                {can("reports", "edit") && (
                  <Button size="xs" variant="ghost" onClick={() => setEditing(c)}>
                    Set up
                  </Button>
                )}
              </div>
              <p className="mt-2 text-body">{c.purpose}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-body">
                {c.next ? (
                  <Button size="xs" variant="secondary" onClick={() => onOpen(c.next!.id)}>
                    Next: {when(c.next.startsAt)}
                  </Button>
                ) : (
                  <span className="text-muted-foreground">Nothing scheduled</span>
                )}
                {can("reports", "edit") && (
                  <Button size="xs" onClick={() => setScheduling(c)}>
                    <CalendarPlus />
                    Schedule
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <SectionCard title="Reviews">
        {meetings.isPending ? (
          <SkeletonRows rows={3} />
        ) : !meetings.data?.length ? (
          <p className="text-body text-muted-foreground">No reviews yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Review</TH>
                <TH>When</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {meetings.data.map((m) => (
                <TR key={m.id} className="cursor-pointer" onClick={() => onOpen(m.id)}>
                  <TD className="font-medium">{m.title}</TD>
                  <TD>{when(m.startsAt)}</TD>
                  <TD>
                    <Badge tone={m.status === "locked" ? "success" : "info"}>{m.status === "locked" ? "Locked" : "Open"}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </SectionCard>
      {editing && <CadenceDialog c={editing} onClose={() => setEditing(null)} />}
      {scheduling && <ScheduleDialog c={scheduling} onClose={() => setScheduling(null)} onScheduled={onOpen} />}
    </div>
  );
}

function Commitments() {
  const can = useCan();
  const me = useMe().data!;
  const act = useReviewAction();
  const tasks = useProjectAction();
  const [mine, setMine] = useState(!can("reports", "view"));
  const [status, setStatus] = useState("open");
  const list = useCommitments({ status, mine });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={status}
          onValueChange={setStatus}
          options={[
            { value: "open", label: "Open" },
            { value: "done", label: "Done" },
          ]}
        />
        {can("reports", "view") && (
          <label className="flex items-center gap-2 text-body">
            <Switch aria-label="Only mine" checked={mine} onCheckedChange={setMine} />
            Only mine
          </label>
        )}
      </div>
      {can("reports", "edit") && <NewCommitment />}
      {list.isPending ? (
        <SkeletonRows rows={4} />
      ) : !list.data?.length ? (
        <EmptyState title="Nothing here" description="Commitments made in reviews show here." />
      ) : (
        <ul className="space-y-2">
          {list.data.map((c) => (
            <CommitmentLine
              key={c.id}
              c={c}
              editable={false}
              action={
                c.status === "open" &&
                (c.owner.id === me.user.id || can("reports", "edit")) && (
                  <span className="flex gap-1.5">
                    {c.taskId ? (
                      <Button size="xs" variant="ghost" asChild>
                        <Link href={`/app/projects?task=${c.taskId}`}>
                          <ListTodo />
                          Its task
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={tasks.isPending}
                        onClick={() => tasks.mutate({ step: "fromCommitment", commitmentId: c.id }, { onSuccess: () => toast.success("Carried forward as a task"), onError })}
                      >
                        <ListTodo />
                        Make it a task
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => act.mutate({ step: "done", id: c.id }, { onSuccess: () => toast.success("Done"), onError })}
                    >
                      <Check />
                      Done
                    </Button>
                  </span>
                )
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Decisions() {
  const can = useCan();
  const list = useDecisions();
  const act = useReviewAction();
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      {can("reports", "edit") && (
        <div className="flex gap-2">
          <Input placeholder="A decision made outside a review" value={text} onChange={(e) => setText(e.target.value)} />
          <Button
            variant="secondary"
            disabled={text.trim().length < 3}
            onClick={() => act.mutate({ step: "decide", body: { text } }, { onSuccess: () => setText(""), onError })}
          >
            Record
          </Button>
        </div>
      )}
      {!list.data?.length ? (
        <EmptyState icon={Gavel} title="No decisions yet" />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Decision</TH>
                <TH>Who carries it out</TH>
                <TH>Where</TH>
                <TH>When</TH>
              </TR>
            </THead>
            <TBody>
              {list.data.map((d) => (
                <TR key={d.id}>
                  <TD>{d.text}</TD>
                  <TD>{d.owner?.name ?? "—"}</TD>
                  <TD>{d.madeIn?.title ?? "—"}</TD>
                  <TD>{new Date(d.decidedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

/** /app/reviews: the STOP rhythm, each review, commitments and decisions. */
export function LiveReviews({ meetingId, tab: initialTab }: { meetingId?: string; tab?: string }) {
  const [tab, setTab] = useState(initialTab === "commitments" || initialTab === "decisions" ? initialTab : "reviews");
  const [open, setOpen] = useState<string | null>(meetingId ?? null);
  return (
    <>
      <PageHeader
        title="Reviews"
        description="The STOP rhythm — daily, weekly, 14-day and 45-day — with each review's agenda and figures, commitments carried until done, and decisions."
      />
      {open ? (
        <MeetingView id={open} onBack={() => setOpen(null)} />
      ) : (
        <>
          <Tabs value={tab} onValueChange={setTab} className="mb-4">
            <TabsList>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
              <TabsTrigger value="commitments">Commitments</TabsTrigger>
              <TabsTrigger value="decisions">Decisions</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "reviews" ? <Rhythms onOpen={setOpen} /> : tab === "commitments" ? <Commitments /> : <Decisions />}
        </>
      )}
    </>
  );
}
