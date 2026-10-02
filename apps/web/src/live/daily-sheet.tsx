"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Send, Signature, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { type DailySheetRow, type SheetRow, type SheetTeamRow, SIGNER_LABEL, type Signer, sheetTotals } from "@gm/shared";
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
import { ApiError, errorMessage } from "./api";
import { type SheetTemplateRow, useCan, useMe, useSheetAction, useSheetDay, useSheetSettings, useSheetTeam, useSheetTemplates } from "./queries";

const onError = (e: unknown) => toast.error(errorMessage(e));
const IST = 330 * 60_000;
const todayIST = () => new Date(Date.now() + IST).toISOString().slice(0, 10);
const shift = (d: string, by: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + by * 86_400_000).toISOString().slice(0, 10);
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const hm = (m: number) => `${Math.floor(Math.abs(m) / 60)}h ${String(Math.abs(m) % 60).padStart(2, "0")}m`;
const newId = () => Math.random().toString(36).slice(2, 10);
const STATE: Record<SheetTeamRow["state"], { label: string; tone: BadgeTone }> = {
  signed: { label: "Signed", tone: "success" },
  submitted: { label: "Submitted", tone: "info" },
  late: { label: "Late", tone: "warning" },
  draft: { label: "Being filled in", tone: "neutral" },
  pending: { label: "Not yet", tone: "neutral" },
  missed: { label: "Missed", tone: "danger" },
  on_leave: { label: "On leave", tone: "neutral" },
  off: { label: "Day off", tone: "neutral" },
};
const ORDERS: { value: string; label: string; signers: Signer[] }[] = [
  { value: "manager,hr", label: "Manager, then HR", signers: ["manager", "hr"] },
  { value: "hr,manager", label: "HR, then the manager", signers: ["hr", "manager"] },
  { value: "manager", label: "The manager only", signers: ["manager"] },
  { value: "hr", label: "HR only", signers: ["hr"] },
];

function DayView({ date, person, onTeam }: { date: string; person?: string; onTeam?: () => void }) {
  const me = useMe().data!;
  const day = useSheetDay(date, person);
  const settings = useSheetSettings();
  const act = useSheetAction();
  const [draft, setDraft] = useState<{ rows: SheetRow[]; counters: Record<string, number>; otherWorks: string; dayReason: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [note, setNote] = useState("");
  if (day.isPending) return <SkeletonRows rows={6} />;
  if (day.error)
    return (
      <Alert tone="info">
        {day.error instanceof ApiError && day.error.status === 409
          ? "HR has not given you a daily sheet yet — it is chosen on your employee record."
          : errorMessage(day.error)}
      </Alert>
    );
  const d: DailySheetRow = day.data;
  const own = d.user.id === me.user.id;
  const editable = own && d.status === "draft" && date <= todayIST();
  const s = draft ?? { rows: d.rows, counters: d.counters, otherWorks: d.otherWorks, dayReason: d.dayReason };
  const set = (patch: Partial<typeof s>) => setDraft({ ...s, ...patch });
  const setRow = (i: number, patch: Partial<SheetRow>) => set({ rows: s.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const totals = settings.data ? sheetTotals({ rows: s.rows }, settings.data) : d.totals;
  const save = (then?: () => void) =>
    act.mutate({ step: "save", date, body: s }, { onSuccess: () => (setDraft(null), then ? then() : toast.success("Saved")), onError });
  const submit = () =>
    save(() =>
      act.mutate(
        { step: "submit", date },
        {
          onSuccess: () => (setErrors([]), toast.success("Submitted")),
          onError: (e) => (e instanceof ApiError && e.body.issues ? setErrors(e.body.issues.map((i) => i.message)) : onError(e)),
        },
      ),
    );
  const videoLabel = (id: string | null) => d.videos.find((v) => v.id === id);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">
            {d.user.name} · {d.template.name}
          </span>
          <Badge tone={d.status === "signed" ? "success" : d.status === "submitted" ? (d.late ? "warning" : "info") : "neutral"}>
            {d.status === "signed" ? "Signed" : d.status === "submitted" ? (d.late ? "Submitted late" : "Submitted") : "Not submitted"}
          </Badge>
          {d.signatures.map((x) => (
            <Badge key={x.signer} tone="success">
              {SIGNER_LABEL[x.signer]}: {x.by}
            </Badge>
          ))}
          {d.waitingFor && <span className="text-body text-muted-foreground">waiting for the {d.waitingFor === "hr" ? "HR" : "manager's"} signature</span>}
        </div>
        {onTeam && (
          <Button variant="ghost" size="sm" onClick={onTeam}>
            Back to the team
          </Button>
        )}
      </div>
      {d.returnNote && d.status === "draft" && <Alert tone="warning">Sent back: {d.returnNote}</Alert>}
      {errors.length > 0 && (
        <Alert tone="danger">
          <ul className="list-disc pl-4">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["On tasks", hm(totals.minutes)],
          ["Productive", hm(totals.productive)],
          ["Done · pending", `${totals.completed} · ${totals.pending}`],
          [totals.gap >= 0 ? "Short of the shift" : "Over the shift", hm(totals.gap)],
        ].map(([k, v]) => (
          <Card key={k} className="p-3">
            <div className="text-body text-muted-foreground">{k}</div>
            <div className="text-lg font-semibold tabular-nums">{v}</div>
          </Card>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Video or task</TH>
              <TH>Details</TH>
              <TH>From</TH>
              <TH>To</TH>
              <TH>Status</TH>
              <TH>Productive</TH>
              {editable && <TH />}
            </TR>
          </THead>
          <TBody>
            {s.rows.map((r, i) => (
              <TR key={r.id}>
                <TD className="min-w-56">
                  {editable ? (
                    <div className="space-y-1">
                      {d.videos.length > 0 && (
                        <Select
                          value={r.videoId ?? "_none"}
                          onValueChange={(v) => setRow(i, { videoId: v === "_none" ? null : v })}
                          options={[{ value: "_none", label: "Not a video" }, ...d.videos.map((v) => ({ value: v.id, label: `${v.code} · ${v.title}` }))]}
                        />
                      )}
                      {!r.videoId && <Input placeholder={d.template.taskHint || "Task"} value={r.task} onChange={(e) => setRow(i, { task: e.target.value })} />}
                    </div>
                  ) : r.videoId ? (
                    `${videoLabel(r.videoId)?.code ?? "Video"} · ${videoLabel(r.videoId)?.title ?? ""}`
                  ) : (
                    r.task
                  )}
                </TD>
                <TD className="min-w-40">{editable ? <Input value={r.details} onChange={(e) => setRow(i, { details: e.target.value })} /> : r.details}</TD>
                <TD>
                  {editable ? (
                    <Input type="time" className="w-28" aria-label="From" value={r.start} onChange={(e) => setRow(i, { start: e.target.value })} />
                  ) : (
                    r.start
                  )}
                </TD>
                <TD>
                  {editable ? <Input type="time" className="w-28" aria-label="To" value={r.end} onChange={(e) => setRow(i, { end: e.target.value })} /> : r.end}
                </TD>
                <TD className="min-w-36">
                  {editable ? (
                    <div className="space-y-1">
                      <Select
                        value={r.status}
                        onValueChange={(v) => setRow(i, { status: v as SheetRow["status"] })}
                        options={[
                          { value: "completed", label: "Done" },
                          { value: "pending", label: "Pending" },
                        ]}
                      />
                      {r.status === "pending" && (
                        <Input placeholder="Why it is pending" value={r.delayReason} onChange={(e) => setRow(i, { delayReason: e.target.value })} />
                      )}
                    </div>
                  ) : (
                    <>
                      {r.status === "completed" ? "Done" : "Pending"}
                      {r.delayReason && <div className="text-muted-foreground">{r.delayReason}</div>}
                    </>
                  )}
                </TD>
                <TD>
                  {editable ? (
                    <Checkbox aria-label="Productive" checked={r.productive} onCheckedChange={(c) => setRow(i, { productive: c === true })} />
                  ) : r.productive ? (
                    "Yes"
                  ) : (
                    "No"
                  )}
                </TD>
                {editable && (
                  <TD>
                    <Button size="icon-sm" variant="ghost" aria-label="Remove row" onClick={() => set({ rows: s.rows.filter((_, j) => j !== i) })}>
                      <Trash2 />
                    </Button>
                  </TD>
                )}
              </TR>
            ))}
            {!s.rows.length && (
              <TR>
                <TD colSpan={7} className="text-muted-foreground">
                  No tasks yet.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
      {editable && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            set({
              rows: [
                ...s.rows,
                {
                  id: newId(),
                  videoId: null,
                  task: "",
                  details: "",
                  start: s.rows.at(-1)?.end ?? "",
                  end: "",
                  status: "completed",
                  delayReason: "",
                  productive: true,
                },
              ],
            })
          }
        >
          <Plus />
          Add a task
        </Button>
      )}
      {d.template.counters.length > 0 && (
        <SectionCard title="Today's counts">
          <div className="grid gap-3 sm:grid-cols-4">
            {d.template.counters.map((c) => (
              <Field key={c.key} label={c.label}>
                {editable ? (
                  <Input
                    type="number"
                    min={0}
                    step={c.hours ? 0.5 : 1}
                    value={s.counters[c.key] ?? ""}
                    onChange={(e) => set({ counters: { ...s.counters, [c.key]: Number(e.target.value) || 0 } })}
                  />
                ) : (
                  <div className={cn("text-lg font-semibold", c.bad && (s.counters[c.key] ?? 0) > 0 && "text-danger")}>
                    {s.counters[c.key] ?? 0}
                    {c.hours && " h"}
                  </div>
                )}
              </Field>
            ))}
          </div>
        </SectionCard>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Other work">
          {editable ? (
            <Textarea rows={2} value={s.otherWorks} onChange={(e) => set({ otherWorks: e.target.value })} />
          ) : (
            <p className="text-body">{s.otherWorks || "—"}</p>
          )}
        </Field>
        <Field label="Why the day is short of (or over) the shift">
          {editable ? (
            <Textarea rows={2} value={s.dayReason} onChange={(e) => set({ dayReason: e.target.value })} />
          ) : (
            <p className="text-body">{s.dayReason || "—"}</p>
          )}
        </Field>
      </div>
      {editable && (
        <div className="flex gap-2">
          <Button variant="secondary" disabled={act.isPending} onClick={() => save()}>
            Save
          </Button>
          <Button disabled={act.isPending} onClick={submit}>
            <Send />
            Submit
          </Button>
          {settings.data && <span className="self-center text-body text-muted-foreground">Submit by {settings.data.cutoff}; after that it is late.</span>}
        </div>
      )}
      {(!own || me.role?.key === "owner") && d.waitingFor && d.id && (
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-sm" placeholder="Note, to send it back" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button
            variant="ghost"
            disabled={note.trim().length < 2 || act.isPending}
            onClick={() => act.mutate({ step: "sendBack", id: d.id!, note }, { onSuccess: () => (setNote(""), toast.success("Sent back")), onError })}
          >
            <Undo2 />
            Send back
          </Button>
          <Button disabled={act.isPending} onClick={() => act.mutate({ step: "sign", id: d.id! }, { onSuccess: () => toast.success("Signed"), onError })}>
            <Signature />
            Sign as {d.waitingFor === "hr" ? "HR" : "manager"}
          </Button>
        </div>
      )}
    </div>
  );
}

function TeamDay({ date, onOpen }: { date: string; onOpen: (userId: string) => void }) {
  const team = useSheetTeam(date);
  if (team.isPending) return <SkeletonRows rows={5} />;
  if (!team.data?.length) return <EmptyState title="No one to show" description="People who report to you and have a daily sheet show here." />;
  const counts = Object.entries(team.data.reduce<Record<string, number>>((m, r) => ({ ...m, [r.state]: (m[r.state] ?? 0) + 1 }), {}));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {counts.map(([k, n]) => (
          <Badge key={k} tone={STATE[k as SheetTeamRow["state"]].tone}>
            {STATE[k as SheetTeamRow["state"]].label}: {n}
          </Badge>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Person</TH>
              <TH>Sheet</TH>
              <TH>Day</TH>
              <TH numeric>On tasks</TH>
              <TH>Waiting for</TH>
            </TR>
          </THead>
          <TBody>
            {team.data.map((r) => (
              <TR key={r.user.id} className={cn(r.sheetId && "cursor-pointer")} onClick={() => r.sheetId && onOpen(r.user.id)}>
                <TD className="font-medium">{r.user.name}</TD>
                <TD>{r.template}</TD>
                <TD>
                  <Badge tone={STATE[r.state].tone}>{STATE[r.state].label}</Badge>
                </TD>
                <TD numeric>{r.minutes ? hm(r.minutes) : "—"}</TD>
                <TD>{r.waitingFor ? SIGNER_LABEL[r.waitingFor] : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function TemplateDialog({ t, onClose }: { t: SheetTemplateRow | null; onClose: () => void }) {
  const act = useSheetAction();
  const [name, setName] = useState(t?.name ?? "");
  const [taskHint, setTaskHint] = useState(t?.taskHint ?? "");
  const [order, setOrder] = useState((t?.signers ?? ["manager", "hr"]).join(","));
  const [counters, setCounters] = useState(t?.counters ?? []);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t ? t.name : "New daily sheet"}</DialogTitle>
          <DialogDescription>What the role counts each day besides its tasks, and who signs it in which order.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Signed by">
              <Select value={order} onValueChange={setOrder} options={ORDERS.map((o) => ({ value: o.value, label: o.label }))} />
            </Field>
            <Field label="Example task" className="sm:col-span-2">
              <Input value={taskHint} onChange={(e) => setTaskHint(e.target.value)} />
            </Field>
          </div>
          <div className="text-body font-medium">Counts</div>
          {counters.map((c, i) => (
            <div key={c.key} className="flex flex-wrap items-center gap-2">
              <Input
                className="flex-1"
                value={c.label}
                placeholder="e.g. Posts done"
                onChange={(e) => setCounters(counters.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <label className="flex items-center gap-1.5 text-body">
                <Switch
                  aria-label="In hours"
                  checked={c.hours}
                  onCheckedChange={(hours) => setCounters(counters.map((x, j) => (j === i ? { ...x, hours } : x)))}
                />
                Hours
              </label>
              <label className="flex items-center gap-1.5 text-body">
                <Switch aria-label="A mistake" checked={c.bad} onCheckedChange={(bad) => setCounters(counters.map((x, j) => (j === i ? { ...x, bad } : x)))} />A
                mistake
              </label>
              <Button size="icon-sm" variant="ghost" aria-label="Remove count" onClick={() => setCounters(counters.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setCounters([...counters, { key: newId(), label: "", hours: false, bad: false }])}>
            <Plus />
            Add a count
          </Button>
        </DialogBody>
        <DialogFooter>
          {t && (
            <Button variant="ghost" className="mr-auto" onClick={() => act.mutate({ step: "removeTemplate", id: t.id }, { onSuccess: onClose, onError })}>
              <Trash2 />
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending}
            onClick={() =>
              act.mutate(
                {
                  step: "template",
                  id: t?.id,
                  body: { name, taskHint, counters: counters.filter((c) => c.label.trim()), signers: ORDERS.find((o) => o.value === order)!.signers },
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

function Sheets() {
  const templates = useSheetTemplates();
  const settings = useSheetSettings();
  const act = useSheetAction();
  const [open, setOpen] = useState<SheetTemplateRow | "new" | null>(null);
  const s = settings.data;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {templates.data?.map((t) => (
          <Card key={t.id} className="cursor-pointer p-4 hover:border-primary/40" onClick={() => setOpen(t)}>
            <div className="font-semibold">{t.name}</div>
            <div className="text-body text-muted-foreground">
              Signed by {t.signers.map((x) => SIGNER_LABEL[x]).join(", then ")} · {t.people} {t.people === 1 ? "person" : "people"}
            </div>
            {t.counters.length > 0 && <div className="mt-1 text-body">{t.counters.map((c) => c.label).join(" · ")}</div>}
          </Card>
        ))}
      </div>
      <Button onClick={() => setOpen("new")}>
        <Plus />
        New daily sheet
      </Button>
      {s && (
        <SectionCard title="Your rules" description="The day the sheet should add up to, the cut-off, and how far off before the day needs a reason.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Working day (hours)">
              <Input
                type="number"
                min={1}
                max={16}
                step={0.5}
                defaultValue={s.shiftMinutes / 60}
                onBlur={(e) => act.mutate({ step: "settings", body: { ...s, shiftMinutes: Math.round(Number(e.target.value) * 60) } }, { onError })}
              />
            </Field>
            <Field label="Submit by">
              <Input
                type="time"
                defaultValue={s.cutoff}
                onBlur={(e) => act.mutate({ step: "settings", body: { ...s, cutoff: e.target.value } }, { onError })}
              />
            </Field>
            <Field label="Allowed off by (minutes)">
              <Input
                type="number"
                min={0}
                max={240}
                defaultValue={s.slackMinutes}
                onBlur={(e) => act.mutate({ step: "settings", body: { ...s, slackMinutes: Number(e.target.value) } }, { onError })}
              />
            </Field>
          </div>
        </SectionCard>
      )}
      {open && <TemplateDialog t={open === "new" ? null : open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** /app/daily-sheet: my day, my team's day, and the agency's sheets. */
export function LiveDailySheet({ date: initialDate, person: initialPerson }: { date?: string; person?: string }) {
  const can = useCan();
  const [date, setDate] = useState(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : todayIST());
  const [tab, setTab] = useState(initialPerson ? "team" : "mine");
  const [person, setPerson] = useState<string | undefined>(initialPerson);
  return (
    <>
      <PageHeader
        title="Daily sheet"
        description="Each day's tasks with their times and the role's counts, submitted by the cut-off and signed by the manager and HR."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => (setTab(v), setPerson(undefined))}>
          <TabsList>
            <TabsTrigger value="mine">My day</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            {can("hr", "edit") && <TabsTrigger value="sheets">Sheets</TabsTrigger>}
          </TabsList>
        </Tabs>
        {tab !== "sheets" && (
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
            <Button size="icon-sm" variant="ghost" aria-label="Day before" onClick={() => setDate(shift(date, -1))}>
              <ChevronLeft />
            </Button>
            <span className="px-2 text-body font-medium">{dayLabel(date)}</span>
            <Button size="icon-sm" variant="ghost" aria-label="Day after" disabled={date >= todayIST()} onClick={() => setDate(shift(date, 1))}>
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
      {tab === "mine" ? (
        <DayView key={date} date={date} />
      ) : tab === "team" ? (
        person ? (
          <DayView key={`${date}${person}`} date={date} person={person} onTeam={() => setPerson(undefined)} />
        ) : (
          <TeamDay date={date} onOpen={setPerson} />
        )
      ) : (
        <Sheets />
      )}
    </>
  );
}
