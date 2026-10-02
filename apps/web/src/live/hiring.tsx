"use client";

import { useState } from "react";
import { Briefcase, CalendarPlus, Check, Copy, FileText, Plus, Settings2, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  CANDIDATE_STAGE_LABEL,
  CANDIDATE_STAGES,
  type CandidateRow,
  type CandidateStage,
  COMPETENCE_LABEL,
  COMPETENCES,
  type Competence,
  type HiringSettings,
  INTERVIEW_MODE_LABEL,
  INTERVIEW_MODES,
  type InterviewMode,
  OPENING_STATUS_LABEL,
  OPENING_STATUSES,
  type OpeningRow,
  type OpeningStatus,
  RECOMMENDATION_LABEL,
  type Recommendation,
  STAR_LABEL,
  STAR_STEPS,
  type StarStep,
  scoreOf,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, inr } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { FilesCard } from "./files";
import { useCan, useCandidate, useCandidates, useDepartments, useHiringAction, useHiringSettings, useMe, useOpenings, usePeople, useRoles } from "./queries";

const onError = (e: unknown) => toast.error(errorMessage(e));
const issuesOf = (setErrors: (e: Record<string, string>) => void) => (e: unknown) =>
  e instanceof ApiError && e.body.issues ? setErrors(Object.fromEntries(e.body.issues.map((i) => [i.path, i.message]))) : onError(e);
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const linesOf = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const REC_TONE: Record<Recommendation, BadgeTone> = { hire: "success", hold: "warning", not_taken: "danger" };
const BOARD: CandidateStage[] = CANDIDATE_STAGES.filter((s) => s !== "rejected");

// ─── Openings ─────────────────────────────────────────────────────────

function OpeningDialog({ opening, onClose }: { opening: OpeningRow | null; onClose: (saved?: OpeningRow) => void }) {
  const can = useCan();
  const act = useHiringAction();
  const deps = useDepartments();
  const people = usePeople();
  const settings = useHiringSettings();
  const editable = can("hr", "edit");
  const o = opening;
  const [f, setF] = useState({
    title: o?.title ?? "",
    departmentId: o?.department?.id ?? "",
    positions: String(o?.positions ?? 1),
    hiringManagerId: o?.hiringManager?.id ?? "",
    budgetFrom: o?.budgetFrom ? String(o.budgetFrom) : "",
    budgetTo: o?.budgetTo ? String(o.budgetTo) : "",
    status: (o?.status ?? "open") as OpeningStatus,
    definition: o?.definition ?? "",
    deliverables: (o?.deliverables ?? []).join("\n"),
    tasks: (o?.tasks ?? []).join("\n"),
    sources: o?.sources ?? [],
  });
  const [competence, setCompetence] = useState<Record<Competence, string>>(
    Object.fromEntries(COMPETENCES.map((c) => [c, (o?.competence[c] ?? []).join("\n")])) as Record<Competence, string>,
  );
  const [star, setStar] = useState<Record<StarStep, string>>(Object.fromEntries(STAR_STEPS.map((s) => [s, o?.star[s] ?? ""])) as Record<StarStep, string>);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () =>
    act.mutate(
      {
        step: "opening",
        id: o?.id,
        body: {
          title: f.title,
          departmentId: f.departmentId || null,
          positions: Number(f.positions) || 1,
          hiringManagerId: f.hiringManagerId || null,
          budgetFrom: f.budgetFrom ? Number(f.budgetFrom) : null,
          budgetTo: f.budgetTo ? Number(f.budgetTo) : null,
          status: f.status,
          definition: f.definition,
          deliverables: linesOf(f.deliverables),
          tasks: linesOf(f.tasks),
          competence: Object.fromEntries(COMPETENCES.map((c) => [c, linesOf(competence[c])])) as Record<Competence, string[]>,
          star,
          sources: f.sources,
        },
      },
      { onSuccess: (r) => (toast.success("Saved"), onClose(r as OpeningRow)), onError: issuesOf(setErrors) },
    );
  const sources = [...new Set([...(settings.data?.sources ?? []), ...f.sources])];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{o ? o.title : "New opening"}</DialogTitle>
          <DialogDescription>The role&rsquo;s task document: what the person is responsible for, delivers and does, and what to look for.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <fieldset disabled={!editable} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Role" error={errors.title} className="sm:col-span-2">
                <Input value={f.title} placeholder="e.g. Video Editor" onChange={(e) => setF({ ...f, title: e.target.value })} />
              </Field>
              <Field label="People to hire">
                <Input type="number" min={1} value={f.positions} onChange={(e) => setF({ ...f, positions: e.target.value })} />
              </Field>
              <Field label="Department">
                <Select
                  value={f.departmentId || "_none"}
                  onValueChange={(v) => setF({ ...f, departmentId: v === "_none" ? "" : v })}
                  options={[{ value: "_none", label: "None" }, ...(deps.data ?? []).map((d) => ({ value: d.id, label: d.name }))]}
                />
              </Field>
              <Field label="Hiring manager">
                <Select
                  value={f.hiringManagerId || "_none"}
                  onValueChange={(v) => setF({ ...f, hiringManagerId: v === "_none" ? "" : v })}
                  options={[{ value: "_none", label: "None" }, ...(people.data ?? []).map((p) => ({ value: p.user.id, label: p.user.name }))]}
                />
              </Field>
              <Field label="Status">
                <Select
                  value={f.status}
                  onValueChange={(v) => setF({ ...f, status: v as OpeningStatus })}
                  options={OPENING_STATUSES.map((s) => ({ value: s, label: OPENING_STATUS_LABEL[s] }))}
                />
              </Field>
              <Field label="Monthly pay from" hint="HR only">
                <Input type="number" min={0} value={f.budgetFrom} onChange={(e) => setF({ ...f, budgetFrom: e.target.value })} />
              </Field>
              <Field label="to" error={errors.budgetTo}>
                <Input type="number" min={0} value={f.budgetTo} onChange={(e) => setF({ ...f, budgetTo: e.target.value })} />
              </Field>
            </div>
            <Field label="What the role is responsible for">
              <Textarea rows={2} value={f.definition} onChange={(e) => setF({ ...f, definition: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="What they deliver" hint="One per line">
                <Textarea rows={4} value={f.deliverables} onChange={(e) => setF({ ...f, deliverables: e.target.value })} />
              </Field>
              <Field label="Their tasks" hint="One per line">
                <Textarea rows={4} value={f.tasks} onChange={(e) => setF({ ...f, tasks: e.target.value })} />
              </Field>
            </div>
            <div>
              <div className="mb-1 text-body font-medium">What to look for</div>
              <div className="grid gap-3 sm:grid-cols-5">
                {COMPETENCES.map((c) => (
                  <Field key={c} label={COMPETENCE_LABEL[c]}>
                    <Textarea rows={3} value={competence[c]} onChange={(e) => setCompetence({ ...competence, [c]: e.target.value })} />
                  </Field>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-body font-medium">The interview&rsquo;s questions (situation, task, action, result)</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {STAR_STEPS.map((s) => (
                  <Field key={s} label={STAR_LABEL[s]}>
                    <Input value={star[s]} onChange={(e) => setStar({ ...star, [s]: e.target.value })} />
                  </Field>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-body font-medium">Where to find people</div>
              <div className="flex flex-wrap gap-1.5">
                {sources.map((s) => {
                  const on = f.sources.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setF({ ...f, sources: on ? f.sources.filter((x) => x !== s) : [...f.sources, s] })}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-body",
                        on ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground",
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          </fieldset>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onClose()}>
            {editable ? "Cancel" : "Close"}
          </Button>
          {editable && (
            <Button disabled={act.isPending} onClick={save}>
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleDialog({ s, onClose }: { s: HiringSettings; onClose: () => void }) {
  const act = useHiringAction();
  const [f, setF] = useState({ ...s, sourcesText: s.sources.join("\n") });
  const n = (k: keyof HiringSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your hiring rule</DialogTitle>
          <DialogDescription>What a scorecard recommends. Five ratings of 1 to 5 count 70%, the role&rsquo;s task out of 10 counts 30%.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <p className="text-body">Hire when every rating is at least</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Each rating">
              <Input type="number" min={1} max={5} value={f.hireEach} onChange={n("hireEach")} />
            </Field>
            <Field label="or the total at least">
              <Input type="number" min={5} max={25} value={f.hireTotal} onChange={n("hireTotal")} />
            </Field>
            <Field label="and the task at least">
              <Input type="number" min={0} max={10} value={f.hireTask} onChange={n("hireTask")} />
            </Field>
            <Field label="Hold: total at least">
              <Input type="number" min={5} max={25} value={f.holdTotal} onChange={n("holdTotal")} />
            </Field>
            <Field label="and the task at least">
              <Input type="number" min={0} max={10} value={f.holdTask} onChange={n("holdTask")} />
            </Field>
          </div>
          <Field label="Where candidates come from" hint="One per line">
            <Textarea rows={5} value={f.sourcesText} onChange={(e) => setF({ ...f, sourcesText: e.target.value })} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending}
            onClick={() => {
              const { sourcesText, ...rule } = f;
              act.mutate(
                { step: "settings", body: { ...rule, sources: linesOf(sourcesText) } },
                { onSuccess: () => (toast.success("Saved"), onClose()), onError },
              );
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Candidates ───────────────────────────────────────────────────────

function CandidateForm({ candidate, openingId, onClose }: { candidate?: CandidateRow; openingId: string; onClose: () => void }) {
  const act = useHiringAction();
  const settings = useHiringSettings();
  const c = candidate;
  const [f, setF] = useState({
    name: c?.name ?? "",
    email: c?.email ?? "",
    phone: c?.phone ?? "",
    city: c?.city ?? "",
    source: c?.source ?? "",
    experience: c?.experience ?? "",
    currentPay: c?.currentPay ? String(c.currentPay) : "",
    expectedPay: c?.expectedPay ? String(c.expectedPay) : "",
    notes: c?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{c ? `Change ${c.name}` : "Add a candidate"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" error={errors.name}>
            <Input value={f.name} onChange={set("name")} />
          </Field>
          <Field label="Email" hint="Needed to invite them when they join" error={errors.email}>
            <Input type="email" value={f.email} onChange={set("email")} />
          </Field>
          <Field label="Phone">
            <Input value={f.phone} onChange={set("phone")} />
          </Field>
          <Field label="City">
            <Input value={f.city} onChange={set("city")} />
          </Field>
          <Field label="Where they came from">
            <Select
              value={f.source || "_none"}
              onValueChange={(v) => setF({ ...f, source: v === "_none" ? "" : v })}
              options={[
                { value: "_none", label: "Not known" },
                ...[...new Set([...(settings.data?.sources ?? []), ...(f.source ? [f.source] : [])])].map((s) => ({ value: s, label: s })),
              ]}
            />
          </Field>
          <Field label="Experience" hint="e.g. 2 years at a studio">
            <Input value={f.experience} onChange={set("experience")} />
          </Field>
          <Field label="Pay now (a month)">
            <Input type="number" min={0} value={f.currentPay} onChange={set("currentPay")} />
          </Field>
          <Field label="Pay expected (a month)">
            <Input type="number" min={0} value={f.expectedPay} onChange={set("expectedPay")} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={f.notes} onChange={set("notes")} />
          </Field>
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
                  step: "candidate",
                  id: c?.id,
                  body: {
                    openingId,
                    name: f.name,
                    email: f.email,
                    phone: f.phone || undefined,
                    city: f.city || undefined,
                    source: f.source || undefined,
                    experience: f.experience || undefined,
                    currentPay: f.currentPay ? Number(f.currentPay) : undefined,
                    expectedPay: f.expectedPay ? Number(f.expectedPay) : undefined,
                    notes: f.notes || undefined,
                  },
                },
                { onSuccess: () => (toast.success("Saved"), onClose()), onError: issuesOf(setErrors) },
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

function ScheduleForm({ c }: { c: CandidateRow }) {
  const act = useHiringAction();
  const people = usePeople();
  const [f, setF] = useState({ at: "", interviewerId: "", mode: "in_person" as InterviewMode, where: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <div className="mt-3 grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-4">
      <Field label="When" error={errors.at}>
        <Input type="datetime-local" value={f.at} onChange={(e) => setF({ ...f, at: e.target.value })} />
      </Field>
      <Field label="Who interviews" error={errors.interviewerId}>
        <Select
          value={f.interviewerId || undefined}
          placeholder="Choose"
          onValueChange={(v) => setF({ ...f, interviewerId: v })}
          options={(people.data ?? []).map((p) => ({ value: p.user.id, label: p.user.name }))}
        />
      </Field>
      <Field label="How">
        <Select
          value={f.mode}
          onValueChange={(v) => setF({ ...f, mode: v as InterviewMode })}
          options={INTERVIEW_MODES.map((m) => ({ value: m, label: INTERVIEW_MODE_LABEL[m] }))}
        />
      </Field>
      <Field label="Where or link">
        <Input value={f.where} onChange={(e) => setF({ ...f, where: e.target.value })} />
      </Field>
      <div className="sm:col-span-4">
        <Button
          size="sm"
          disabled={act.isPending || !f.at || !f.interviewerId}
          onClick={() =>
            act.mutate(
              {
                step: "interview",
                id: c.id,
                body: { at: new Date(f.at).toISOString(), interviewerId: f.interviewerId, mode: f.mode, where: f.where || undefined },
              },
              {
                onSuccess: () => (toast.success("Set up — the interviewer is told"), setF({ at: "", interviewerId: "", mode: "in_person", where: "" })),
                onError: issuesOf(setErrors),
              },
            )
          }
        >
          <CalendarPlus />
          Set up the interview
        </Button>
      </div>
    </div>
  );
}

function ScorecardForm({ c, questions, rule }: { c: CandidateRow; questions: Record<StarStep, string> | undefined; rule: HiringSettings | undefined }) {
  const me = useMe().data!;
  const act = useHiringAction();
  const mine = c.scorecards?.find((s) => s.interviewer.id === me.user.id);
  const [ratings, setRatings] = useState<Record<Competence, number>>(mine?.ratings ?? { skills: 0, knowledge: 0, selfImage: 0, traits: 0, motives: 0 });
  const [star, setStar] = useState<Record<StarStep, string>>(mine?.star ?? { situation: "", task: "", action: "", result: "" });
  const [taskScore, setTaskScore] = useState(String(mine?.taskScore ?? ""));
  const [remarks, setRemarks] = useState(mine?.remarks ?? "");
  const complete = COMPETENCES.every((k) => ratings[k] > 0) && taskScore !== "";
  const preview = complete && rule ? scoreOf({ ratings, taskScore: Number(taskScore) }, rule) : null;
  return (
    <SectionCard
      title={mine ? "Your scorecard" : "Fill in your scorecard"}
      description="Rate each from 1 (weak) to 5 (strong), note what they told you, and score the role's task out of 10."
    >
      <div className="space-y-2">
        {COMPETENCES.map((k) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <span className="text-body">{COMPETENCE_LABEL[k]}</span>
            <div className="flex gap-1" role="radiogroup" aria-label={COMPETENCE_LABEL[k]}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={ratings[k] === n}
                  onClick={() => setRatings((r) => ({ ...r, [k]: n }))}
                  className={cn(
                    "size-8 rounded-lg border text-body tabular-nums",
                    ratings[k] === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {STAR_STEPS.map((s) => (
          <Field key={s} label={STAR_LABEL[s]} hint={questions?.[s] || undefined}>
            <Textarea rows={2} value={star[s]} onChange={(e) => setStar({ ...star, [s]: e.target.value })} />
          </Field>
        ))}
        <Field label="The role's task, out of 10">
          <Input type="number" min={0} max={10} value={taskScore} onChange={(e) => setTaskScore(e.target.value)} />
        </Field>
        <Field label="Remarks">
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          disabled={!complete || act.isPending}
          onClick={() =>
            act.mutate(
              { step: "score", id: c.id, body: { ratings, star, taskScore: Number(taskScore), remarks } },
              { onSuccess: () => toast.success("Scorecard saved"), onError },
            )
          }
        >
          Save scorecard
        </Button>
        {preview && (
          <span className="text-body">
            {preview.total} of 25 · {preview.percent}% · <Badge tone={REC_TONE[preview.recommendation]}>{RECOMMENDATION_LABEL[preview.recommendation]}</Badge>
          </span>
        )}
      </div>
    </SectionCard>
  );
}

function OfferForm({ c }: { c: CandidateRow }) {
  const act = useHiringAction();
  const roles = useRoles();
  const [f, setF] = useState({
    designation: c.offer?.designation ?? c.opening.title,
    monthlyPay: c.offer?.monthlyPay ? String(c.offer.monthlyPay) : c.expectedPay ? String(c.expectedPay) : "",
    joiningDate: c.offer?.joiningDate ?? "",
    role: c.offer?.role ?? "",
    notes: c.offer?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Designation" error={errors.designation}>
        <Input value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} />
      </Field>
      <Field label="Monthly pay offered" error={errors.monthlyPay}>
        <Input type="number" min={0} value={f.monthlyPay} onChange={(e) => setF({ ...f, monthlyPay: e.target.value })} />
      </Field>
      <Field label="Joining day" error={errors.joiningDate}>
        <Input type="date" value={f.joiningDate} onChange={(e) => setF({ ...f, joiningDate: e.target.value })} />
      </Field>
      <Field label="Their role in the workspace" error={errors.role}>
        <Select
          value={f.role || undefined}
          placeholder="Choose"
          onValueChange={(v) => setF({ ...f, role: v })}
          options={(roles.data ?? []).filter((r) => r.key !== "owner" && !r.key.startsWith("client_")).map((r) => ({ value: r.key, label: r.name }))}
        />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Button
          size="sm"
          disabled={act.isPending}
          onClick={() =>
            act.mutate(
              {
                step: "offer",
                id: c.id,
                body: {
                  designation: f.designation,
                  monthlyPay: Number(f.monthlyPay) || 0,
                  joiningDate: f.joiningDate,
                  role: f.role,
                  notes: f.notes || undefined,
                },
              },
              { onSuccess: () => toast.success("Offer recorded"), onError: issuesOf(setErrors) },
            )
          }
        >
          {c.offer ? "Change the offer" : "Make the offer"}
        </Button>
      </div>
    </div>
  );
}

function CandidateDialog({ id, openings, onClose }: { id: string; openings: OpeningRow[]; onClose: () => void }) {
  const can = useCan();
  const me = useMe().data!;
  const cand = useCandidate(id);
  const rule = useHiringSettings();
  const act = useHiringAction();
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  if (editing && cand.data) return <CandidateForm candidate={cand.data} openingId={cand.data.opening.id} onClose={() => setEditing(false)} />;
  const c = cand.data;
  const opening = c && openings.find((o) => o.id === c.opening.id);
  const hr = can("hr", "edit");
  const mayScore = !!c && (hr || opening?.hiringManager?.id === me.user.id || !!c.interviews?.some((i) => i.interviewer.id === me.user.id));
  const open = !!c && !["joined", "rejected"].includes(c.stage);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        {!c ? (
          <DialogBody>{cand.error ? <Alert tone="danger">{errorMessage(cand.error)}</Alert> : <SkeletonRows rows={6} />}</DialogBody>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {c.name}
                <Badge tone={c.stage === "rejected" ? "danger" : c.stage === "joined" ? "success" : "info"}>{CANDIDATE_STAGE_LABEL[c.stage]}</Badge>
              </DialogTitle>
              <DialogDescription>
                {c.opening.title}
                {[c.city, c.source, c.experience].filter(Boolean).map((x) => ` · ${x}`)}
                {c.email && ` · ${c.email}`}
                {c.phone && ` · ${c.phone}`}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              {(c.currentPay || c.expectedPay) && (
                <p className="text-body text-muted-foreground">
                  Pay now {c.currentPay ? inr(c.currentPay) : "—"} · expects {c.expectedPay ? inr(c.expectedPay) : "—"}
                </p>
              )}
              {c.notes && <p className="text-body">{c.notes}</p>}
              {c.stage === "rejected" && c.rejectedReason && <Alert tone="danger">Not taken: {c.rejectedReason}</Alert>}

              {hr && open && MOVE_FROM.includes(c.stage) && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body text-muted-foreground">Move to</span>
                  {MOVE_FROM.filter((s) => s !== c.stage).map((s) => (
                    <Button key={s} size="xs" variant="secondary" onClick={() => act.mutate({ step: "move", id: c.id, stage: s }, { onError })}>
                      {CANDIDATE_STAGE_LABEL[s]}
                    </Button>
                  ))}
                  <Button
                    size="xs"
                    disabled={!c.scorecards?.length}
                    onClick={() => act.mutate({ step: "move", id: c.id, stage: "approval" }, { onSuccess: () => toast.success("Sent for approval"), onError })}
                  >
                    Ask for approval to hire
                  </Button>
                </div>
              )}

              {c.stage === "approval" && (
                <Alert tone="warning">
                  Waiting for approval to hire
                  {c.score ? ` — ${c.score.count} ${c.score.count === 1 ? "scorecard" : "scorecards"}, ${c.score.percent}% on average` : ""}.
                  {can("hr", "approve") && (
                    <span className="mt-2 flex flex-wrap gap-2">
                      <Input className="max-w-xs" placeholder="Note (needed to say no)" value={reason} onChange={(e) => setReason(e.target.value)} />
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={!reason.trim()}
                        onClick={() => act.mutate({ step: "approve", id: c.id, approved: false, note: reason }, { onError })}
                      >
                        <X />
                        Not taken
                      </Button>
                      <Button
                        size="xs"
                        variant="success"
                        onClick={() =>
                          act.mutate(
                            { step: "approve", id: c.id, approved: true, note: reason || undefined },
                            { onSuccess: () => toast.success("Approved — make the offer"), onError },
                          )
                        }
                      >
                        <Check />
                        Approve the hire
                      </Button>
                    </span>
                  )}
                </Alert>
              )}

              {c.stage === "offer" && (
                <SectionCard title="Offer" description={c.approvedBy ? `Hire approved by ${c.approvedBy}.` : undefined}>
                  {c.offer && (
                    <p className="mb-3 text-body">
                      {c.offer.designation}
                      {c.offer.monthlyPay ? ` · ${inr(c.offer.monthlyPay)} a month` : ""} · joins {c.offer.joiningDate} ·{" "}
                      <Badge tone={c.offer.status === "accepted" ? "success" : c.offer.status === "declined" ? "danger" : "warning"}>
                        {c.offer.status === "made" ? "Waiting for their answer" : c.offer.status === "accepted" ? "Accepted" : "Declined"}
                      </Badge>
                    </p>
                  )}
                  {hr && c.offer?.status !== "accepted" && <OfferForm c={c} />}
                  {hr && c.offer?.status === "made" && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => act.mutate({ step: "answer", id: c.id, accepted: false }, { onError })}>
                        They declined
                      </Button>
                      <Button size="sm" variant="success" onClick={() => act.mutate({ step: "answer", id: c.id, accepted: true }, { onError })}>
                        They accepted
                      </Button>
                    </div>
                  )}
                  {hr && c.offer?.status === "accepted" && (
                    <Button
                      size="sm"
                      onClick={() => act.mutate({ step: "join", id: c.id }, { onSuccess: () => toast.success("Invited — share the link with them"), onError })}
                    >
                      <UserPlus />
                      Join: invite them to the workspace
                    </Button>
                  )}
                </SectionCard>
              )}

              {c.stage === "joined" && (
                <Alert tone="success">
                  Joined as {c.offer?.designation}.{" "}
                  {c.invitationLink ? (
                    <>
                      Their invitation waits:{" "}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 underline"
                        onClick={() => void navigator.clipboard.writeText(c.invitationLink!).then(() => toast.success("Link copied"))}
                      >
                        <Copy className="size-3.5" />
                        copy the link
                      </button>{" "}
                      to send on WhatsApp. Their employee record starts from the offer when they accept.
                    </>
                  ) : (
                    "They have accepted the invitation."
                  )}
                </Alert>
              )}

              <SectionCard title="Interviews">
                {c.interviews?.length ? (
                  <ul className="divide-y divide-border-subtle text-body">
                    {c.interviews.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 py-1.5">
                        <span>
                          {when(i.at)} · {i.interviewer.name} · {INTERVIEW_MODE_LABEL[i.mode]}
                          {i.where && ` · ${i.where}`}
                          {i.scored && (
                            <Badge tone="success" className="ml-2">
                              Scored
                            </Badge>
                          )}
                        </span>
                        {hr && open && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Cancel the interview"
                            onClick={() => act.mutate({ step: "cancelInterview", interviewId: i.id }, { onError })}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body text-muted-foreground">None yet.</p>
                )}
                {hr && open && <ScheduleForm c={c} />}
              </SectionCard>

              {!!c.scorecards?.length && (
                <SectionCard title="Scorecards" description={c.score ? `${c.score.percent}% on average` : undefined}>
                  <ul className="space-y-3">
                    {c.scorecards.map((s) => (
                      <li key={s.id} className="rounded-xl border border-border p-3 text-body">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{s.interviewer.name}</span>
                          <span>
                            {s.total} of 25 · task {s.taskScore}/10 · {s.percent}%{" "}
                            <Badge tone={REC_TONE[s.recommendation]}>{RECOMMENDATION_LABEL[s.recommendation]}</Badge>
                          </span>
                        </div>
                        <div className="mt-1 text-muted-foreground">{COMPETENCES.map((k) => `${COMPETENCE_LABEL[k]} ${s.ratings[k]}`).join(" · ")}</div>
                        {STAR_STEPS.some((k) => s.star[k]) && (
                          <dl className="mt-2 grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-3">
                            {STAR_STEPS.filter((k) => s.star[k]).map((k) => (
                              <div key={k} className="contents">
                                <dt className="text-muted-foreground">{STAR_LABEL[k]}</dt>
                                <dd>{s.star[k]}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        {s.remarks && <p className="mt-1">{s.remarks}</p>}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              )}

              {mayScore && open && <ScorecardForm key={c.scorecards?.length} c={c} questions={opening?.star} rule={rule.data} />}

              {can("hr", "view") && <FilesCard entity="candidate" entityId={c.id} title="CV and papers" description="HR only." canEdit={hr} />}
            </DialogBody>
            <DialogFooter>
              {hr && open && (
                <span className="mr-auto flex flex-wrap gap-2">
                  <Input className="w-56" placeholder="Why not taken" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <Button
                    variant="ghost"
                    disabled={!reason.trim() || act.isPending}
                    onClick={() =>
                      act.mutate({ step: "move", id: c.id, stage: "rejected", reason }, { onSuccess: () => toast.success("Marked not taken"), onError })
                    }
                  >
                    Not taken
                  </Button>
                </span>
              )}
              {hr && (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Change details
                </Button>
              )}
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const MOVE_FROM: CandidateStage[] = ["applied", "screening", "interview", "scorecard"];

function Board({ opening, onOpen }: { opening: OpeningRow; onOpen: (id: string) => void }) {
  const list = useCandidates(opening.id);
  const [showRejected, setShowRejected] = useState(false);
  if (list.isPending) return <SkeletonRows rows={4} />;
  const rejected = (list.data ?? []).filter((c) => c.stage === "rejected");
  return (
    <div className="space-y-3">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {BOARD.map((stage) => {
          const here = (list.data ?? []).filter((c) => c.stage === stage);
          return (
            <div key={stage} className="w-56 shrink-0 rounded-xl bg-muted/50 p-2">
              <div className="mb-2 flex items-center justify-between px-1 text-body font-medium">
                {CANDIDATE_STAGE_LABEL[stage]}
                <span className="text-muted-foreground">{here.length}</span>
              </div>
              <div className="space-y-2">
                {here.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onOpen(c.id)}
                    className="w-full rounded-lg border border-border bg-card p-2 text-left text-body hover:border-primary/40"
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-muted-foreground">{[c.city, c.source].filter(Boolean).join(" · ") || "—"}</div>
                    {c.score && (
                      <div className="mt-1">
                        <Badge tone={REC_TONE[c.score.recommendation]}>
                          {c.score.percent}% · {RECOMMENDATION_LABEL[c.score.recommendation]}
                        </Badge>
                      </div>
                    )}
                    {c.nextInterview && <div className="mt-1 text-muted-foreground">Interview {when(c.nextInterview)}</div>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {rejected.length > 0 && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => setShowRejected(!showRejected)}>
            {showRejected ? "Hide" : "Show"} {rejected.length} not taken
          </Button>
          {showRejected && (
            <ul className="mt-1 divide-y divide-border-subtle text-body">
              {rejected.map((c) => (
                <li key={c.id} className="flex justify-between py-1.5">
                  <button type="button" className="hover:underline" onClick={() => onOpen(c.id)}>
                    {c.name}
                  </button>
                  <span className="text-muted-foreground">{c.rejectedReason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** /app/hiring: openings, each with its candidates through the stages. */
export function LiveHiring({ candidateId }: { candidateId?: string }) {
  const can = useCan();
  const openings = useOpenings();
  const settings = useHiringSettings();
  const [chosen, setChosen] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<string | null>(candidateId ?? null);
  const [dialog, setDialog] = useState<"opening" | "edit" | "candidate" | "rule" | null>(null);
  const list = openings.data ?? [];
  const opening = list.find((o) => o.id === chosen) ?? list.find((o) => o.status === "open") ?? list[0];
  return (
    <>
      <PageHeader
        title="Hiring"
        description="Openings with the role's task document; candidates through screening, interviews and scorecards, the hire approved, the offer, and joining."
        actions={
          can("hr", "edit") && (
            <>
              <Button variant="ghost" onClick={() => setDialog("rule")}>
                <Settings2 />
                Hiring rule
              </Button>
              <Button onClick={() => setDialog("opening")}>
                <Plus />
                New opening
              </Button>
            </>
          )
        }
      />
      {openings.isPending ? (
        <SkeletonRows rows={5} />
      ) : openings.error ? (
        <Alert tone="danger">{errorMessage(openings.error)}</Alert>
      ) : !list.length ? (
        <EmptyState
          icon={Briefcase}
          title="No openings"
          description={
            can("hr", "edit")
              ? "Start with the role: what the person is responsible for, delivers and does."
              : "Openings you manage or interview for show here."
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {list.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setChosen(o.id)}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-left text-body",
                  o.id === opening?.id ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
                )}
              >
                <span className="font-medium">{o.title}</span>
                <span className="ml-2 text-muted-foreground">
                  {OPENING_STATUS_LABEL[o.status]} · {Object.entries(o.pipeline).reduce((s, [k, n]) => s + (k === "rejected" ? 0 : (n ?? 0)), 0)} in play
                </span>
              </button>
            ))}
          </div>
          {opening && (
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{opening.title}</div>
                  <div className="text-body text-muted-foreground">
                    {[
                      opening.department?.name,
                      `${opening.positions} to hire`,
                      opening.hiringManager && `hiring manager ${opening.hiringManager.name}`,
                      opening.budgetFrom != null && opening.budgetTo != null && `${inr(opening.budgetFrom)}–${inr(opening.budgetTo)} a month`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {opening.definition && <p className="mt-1 max-w-2xl text-body">{opening.definition}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setDialog("edit")}>
                    <FileText />
                    Role document
                  </Button>
                  {can("hr", "edit") && opening.status !== "closed" && (
                    <Button onClick={() => setDialog("candidate")}>
                      <UserPlus />
                      Add a candidate
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <Board opening={opening} onOpen={setCandidate} />
              </div>
            </Card>
          )}
        </div>
      )}
      {dialog === "opening" && <OpeningDialog opening={null} onClose={(r) => (setDialog(null), r && setChosen(r.id))} />}
      {dialog === "edit" && opening && <OpeningDialog opening={opening} onClose={() => setDialog(null)} />}
      {dialog === "candidate" && opening && <CandidateForm openingId={opening.id} onClose={() => setDialog(null)} />}
      {dialog === "rule" && settings.data && <RuleDialog s={settings.data} onClose={() => setDialog(null)} />}
      {candidate && <CandidateDialog id={candidate} openings={list} onClose={() => setCandidate(null)} />}
    </>
  );
}
