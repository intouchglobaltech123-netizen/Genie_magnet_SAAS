"use client";

import { useMemo, useState } from "react";
import { Calculator, ChevronRight, Flag, Plus, RotateCcw, Target, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  cascade,
  type CascadeInputs,
  CHECK_IN_LABEL,
  type CheckInKind,
  GOAL_CADENCE_LABEL,
  GOAL_CADENCES,
  GOAL_LEVEL_LABEL,
  GOAL_LEVELS,
  GOAL_METRIC_LABEL,
  GOAL_METRICS,
  GOAL_STATUS_LABEL,
  GOAL_TYPE_LABEL,
  GOAL_TYPES,
  GOAL_UNIT_LABEL,
  GOAL_UNITS,
  type GoalCadence,
  type GoalLevel,
  type GoalMetric,
  type GoalRow,
  type GoalStatus,
  type GoalType,
  type GoalUnit,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, inr, inrCompact } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { useCan, useCascade, useDepartments, useGoalAction, useGoals, useMe, usePeople } from "./queries";

const onError = (e: unknown) => toast.error(errorMessage(e));
const STATUS_TONE: Record<GoalStatus, BadgeTone> = { on_track: "success", at_risk: "warning", off_track: "danger", done: "success" };
const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export function valueOf(v: number, unit: GoalUnit) {
  const n = Math.round(v * 100) / 100;
  return unit === "inr"
    ? Math.abs(n) >= 1e5
      ? inrCompact(n)
      : inr(n)
    : unit === "pct"
      ? `${n}%`
      : unit === "hours"
        ? `${n} h`
        : unit === "days"
          ? `${n} days`
          : String(n);
}

// ─── A goal ───────────────────────────────────────────────────────────

function GoalForm({ goal, goals, parentId, onClose }: { goal: GoalRow | null; goals: GoalRow[]; parentId?: string; onClose: () => void }) {
  const act = useGoalAction();
  const deps = useDepartments();
  const people = usePeople();
  const g = goal;
  const [f, setF] = useState({
    parentId: g?.parentId ?? parentId ?? "",
    level: (g?.level ?? (parentId ? (goals.find((x) => x.id === parentId)?.level === "company" ? "department" : "person") : "company")) as GoalLevel,
    title: g?.title ?? "",
    departmentId: g?.department?.id ?? "",
    type: (g?.type ?? "functional") as GoalType,
    ownerIds: g?.owners.map((o) => o.id) ?? [],
    measure: g?.measure ?? "",
    unit: (g?.unit ?? "count") as GoalUnit,
    baseline: String(g?.baseline ?? 0),
    target: g ? String(g.target) : "",
    actual: String(g?.actual ?? 0),
    metric: (g?.metric ?? "") as GoalMetric | "",
    startDate: g?.startDate ?? today(),
    dueDate: g?.dueDate ?? "",
    cadence: (g?.cadence ?? "tactical") as GoalCadence,
  });
  const [smart, setSmart] = useState(g?.smart ?? { specific: "", measurable: "", achievable: "", relevant: "", timeBound: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const parents = goals.filter(
    (x) => x.id !== g?.id && (f.level === "department" ? x.level === "company" : f.level === "person" ? x.level !== "person" : false),
  );
  const save = () =>
    act.mutate(
      {
        step: "save",
        id: g?.id,
        body: {
          ...f,
          parentId: f.level === "company" ? null : f.parentId || null,
          departmentId: f.departmentId || null,
          baseline: Number(f.baseline) || 0,
          target: Number(f.target),
          actual: Number(f.actual) || 0,
          metric: f.metric || null,
          smart,
        },
      },
      {
        onSuccess: () => (toast.success("Saved"), onClose()),
        onError: (e) => (e instanceof ApiError && e.body.issues ? setErrors(Object.fromEntries(e.body.issues.map((i) => [i.path, i.message]))) : onError(e)),
      },
    );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{g ? "Change the goal" : "New goal"}</DialogTitle>
          <DialogDescription>
            A department&rsquo;s goal serves the company&rsquo;s; a person&rsquo;s serves a department&rsquo;s or the company&rsquo;s.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Level">
              <Select
                value={f.level}
                onValueChange={(v) => setF({ ...f, level: v as GoalLevel })}
                options={GOAL_LEVELS.map((l) => ({ value: l, label: GOAL_LEVEL_LABEL[l] }))}
              />
            </Field>
            {f.level !== "company" && (
              <Field label="Serves" error={errors.parentId} className="sm:col-span-2">
                <Select
                  value={f.parentId || undefined}
                  placeholder="Choose"
                  onValueChange={(v) => setF({ ...f, parentId: v })}
                  options={parents.map((p) => ({ value: p.id, label: p.title }))}
                />
              </Field>
            )}
            <Field label="Goal" error={errors.title} className="sm:col-span-3">
              <Input value={f.title} placeholder="e.g. ₹60 lakh revenue this year" onChange={(e) => setF({ ...f, title: e.target.value })} />
            </Field>
            <Field label="Kind">
              <Select
                value={f.type}
                onValueChange={(v) => setF({ ...f, type: v as GoalType })}
                options={GOAL_TYPES.map((x) => ({ value: x, label: GOAL_TYPE_LABEL[x] }))}
              />
            </Field>
            <Field label="Department">
              <Select
                value={f.departmentId || "_none"}
                onValueChange={(v) => setF({ ...f, departmentId: v === "_none" ? "" : v })}
                options={[{ value: "_none", label: "None" }, ...(deps.data ?? []).map((d) => ({ value: d.id, label: d.name }))]}
              />
            </Field>
            <Field label="Reviewed in">
              <Select
                value={f.cadence}
                onValueChange={(v) => setF({ ...f, cadence: v as GoalCadence })}
                options={GOAL_CADENCES.map((c) => ({ value: c, label: GOAL_CADENCE_LABEL[c] }))}
              />
            </Field>
            <Field label="Follows" hint="A figure the app knows, or entered by hand" className="sm:col-span-2">
              <Select
                value={f.metric || "_manual"}
                onValueChange={(v) => {
                  const metric = v === "_manual" ? "" : (v as GoalMetric);
                  setF({
                    ...f,
                    metric,
                    ...(metric && { unit: GOAL_METRIC_LABEL[metric].unit, measure: f.measure || GOAL_METRIC_LABEL[metric].label }),
                    ...(metric && GOAL_METRIC_LABEL[metric].unit === "inr" && { type: "financial" as GoalType }),
                  });
                }}
                options={[{ value: "_manual", label: "Entered by hand" }, ...GOAL_METRICS.map((m) => ({ value: m, label: GOAL_METRIC_LABEL[m].label }))]}
              />
            </Field>
            <Field label="Unit">
              <Select
                value={f.unit}
                onValueChange={(v) => setF({ ...f, unit: v as GoalUnit })}
                options={GOAL_UNITS.map((u) => ({ value: u, label: GOAL_UNIT_LABEL[u] }))}
              />
            </Field>
            <Field label="What is measured" className="sm:col-span-3">
              <Input value={f.measure} onChange={(e) => setF({ ...f, measure: e.target.value })} />
            </Field>
            <Field label="From">
              <Input type="number" step="any" value={f.baseline} onChange={(e) => setF({ ...f, baseline: e.target.value })} />
            </Field>
            <Field label="To" error={errors.target}>
              <Input type="number" step="any" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />
            </Field>
            {!f.metric && (
              <Field label="Now">
                <Input type="number" step="any" value={f.actual} onChange={(e) => setF({ ...f, actual: e.target.value })} />
              </Field>
            )}
            <Field label="Starts">
              <Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
            </Field>
            <Field label="Due" error={errors.dueDate}>
              <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            </Field>
          </div>
          <div>
            <div className="mb-1 text-body font-medium">Owners</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(people.data ?? []).map((p) => (
                <label key={p.user.id} className="flex items-center gap-1.5 text-body">
                  <Checkbox
                    aria-label={p.user.name}
                    checked={f.ownerIds.includes(p.user.id)}
                    onCheckedChange={(c) => setF({ ...f, ownerIds: c === true ? [...f.ownerIds, p.user.id] : f.ownerIds.filter((x) => x !== p.user.id) })}
                  />
                  {p.user.name}
                </label>
              ))}
            </div>
          </div>
          <SectionCard title="S.M.A.R.T." description="Specific, measurable, achievable, relevant and time-bound, in your words.">
            <div className="grid gap-3 sm:grid-cols-2">
              {(["specific", "measurable", "achievable", "relevant", "timeBound"] as const).map((k) => (
                <Field key={k} label={k === "timeBound" ? "Time-bound" : k[0]!.toUpperCase() + k.slice(1)}>
                  <Textarea rows={2} value={smart[k]} onChange={(e) => setSmart({ ...smart, [k]: e.target.value })} />
                </Field>
              ))}
            </div>
          </SectionCard>
        </DialogBody>
        <DialogFooter>
          {g && (
            <Button variant="ghost" className="mr-auto" onClick={() => act.mutate({ step: "remove", id: g.id }, { onSuccess: onClose, onError })}>
              <Trash2 />
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={act.isPending} onClick={save}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoalDialog({ goal, goals, onClose, onEdit, onAdd }: { goal: GoalRow; goals: GoalRow[]; onClose: () => void; onEdit: () => void; onAdd: () => void }) {
  const can = useCan();
  const me = useMe().data!;
  const act = useGoalAction();
  const [kind, setKind] = useState<CheckInKind>("update");
  const [note, setNote] = useState("");
  const [value, setValue] = useState("");
  const g = goal;
  const mayCheckIn = can("reports", "edit") || g.owners.some((o) => o.id === me.user.id);
  const parent = goals.find((x) => x.id === g.parentId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {g.title}
            <Badge tone={STATUS_TONE[g.status]}>{GOAL_STATUS_LABEL[g.status]}</Badge>
          </DialogTitle>
          <DialogDescription>
            {GOAL_LEVEL_LABEL[g.level]} · {GOAL_TYPE_LABEL[g.type]}
            {g.department && ` · ${g.department.name}`} · {GOAL_CADENCE_LABEL[g.cadence]} review
            {parent && ` · serves “${parent.title}”`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div>
            <div className="mb-1 flex justify-between text-body">
              <span>
                {valueOf(g.actual, g.unit)} of {valueOf(g.target, g.unit)}
                {g.metric && <span className="text-muted-foreground"> · {GOAL_METRIC_LABEL[g.metric].label.toLowerCase()}, from the app</span>}
              </span>
              <span className="text-muted-foreground">should be {Math.round(g.expected * 100)}% by now</span>
            </div>
            <Progress
              value={Math.max(0, Math.min(100, g.progress * 100))}
              tone={g.status === "off_track" ? "danger" : g.status === "at_risk" ? "warning" : "success"}
            />
            <div className="mt-1 text-body text-muted-foreground">
              {fmtDate(g.startDate)} to {fmtDate(g.dueDate)} · {g.owners.map((o) => o.name).join(", ") || "No owner"}
            </div>
          </div>
          {Object.values(g.smart).some(Boolean) && (
            <dl className="grid gap-1 text-body sm:grid-cols-[auto_1fr] sm:gap-x-3">
              {(["specific", "measurable", "achievable", "relevant", "timeBound"] as const)
                .filter((k) => g.smart[k])
                .map((k) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k === "timeBound" ? "Time-bound" : k[0]!.toUpperCase() + k.slice(1)}</dt>
                    <dd>{g.smart[k]}</dd>
                  </div>
                ))}
            </dl>
          )}
          {mayCheckIn && (
            <SectionCard title="Check in">
              <div className="grid gap-2 sm:grid-cols-[160px_1fr_120px]">
                <Select
                  value={kind}
                  onValueChange={(v) => setKind(v as CheckInKind)}
                  options={(["update", "breakthrough", "breakdown"] as const).map((k) => ({ value: k, label: CHECK_IN_LABEL[k] }))}
                />
                <Input placeholder="What happened" value={note} onChange={(e) => setNote(e.target.value)} />
                {!g.metric && <Input type="number" step="any" placeholder="Now at" value={value} onChange={(e) => setValue(e.target.value)} />}
              </div>
              <Button
                size="sm"
                className="mt-2"
                disabled={note.trim().length < 2 || act.isPending}
                onClick={() =>
                  act.mutate(
                    { step: "checkIn", id: g.id, body: { kind, note, ...(value !== "" && !g.metric && { value: Number(value) }) } },
                    { onSuccess: () => (setNote(""), setValue(""), toast.success("Checked in")), onError },
                  )
                }
              >
                Check in
              </Button>
            </SectionCard>
          )}
          <div>
            <div className="mb-1 text-body font-medium">Check-ins</div>
            {g.checkIns.length ? (
              <ul className="space-y-1.5 text-body">
                {g.checkIns.map((c) => (
                  <li key={c.id} className="flex gap-2">
                    {c.kind === "breakthrough" ? (
                      <TrendingUp className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : c.kind === "breakdown" ? (
                      <TrendingDown className="mt-0.5 size-4 shrink-0 text-danger" />
                    ) : (
                      <Flag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span>
                      {c.note}
                      {c.value !== null && ` (${valueOf(c.value, g.unit)})`}
                      <span className="text-muted-foreground">
                        {" "}
                        · {c.by}, {new Date(c.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-muted-foreground">None yet.</p>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          {can("reports", "edit") && g.level !== "person" && (
            <Button variant="ghost" className="mr-auto" onClick={onAdd}>
              <Plus />A goal serving this
            </Button>
          )}
          {can("reports", "edit") && (
            <Button variant="secondary" onClick={onEdit}>
              Change
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoalLine({ g, depth, childrenOf, onOpen }: { g: GoalRow; depth: number; childrenOf: (id: string) => GoalRow[]; onOpen: (id: string) => void }) {
  const kids = childrenOf(g.id);
  const [open, setOpen] = useState(depth < 1);
  return (
    <>
      <div className={cn("flex items-center gap-3 border-b border-border-subtle py-2 pr-2")} style={{ paddingLeft: depth * 20 }}>
        <button
          type="button"
          aria-label={open ? "Fold" : "Unfold"}
          className={cn("size-5 shrink-0 text-muted-foreground", !kids.length && "invisible")}
          onClick={() => setOpen(!open)}
        >
          <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(g.id)}>
          <div className="truncate font-medium">{g.title}</div>
          <div className="text-body text-muted-foreground">
            {GOAL_LEVEL_LABEL[g.level]}
            {g.department && ` · ${g.department.name}`}
            {g.owners.length > 0 && ` · ${g.owners.map((o) => o.name).join(", ")}`} · due {fmtDate(g.dueDate)}
          </div>
        </button>
        <div className="hidden w-48 sm:block">
          <Progress
            value={Math.max(0, Math.min(100, g.progress * 100))}
            tone={g.status === "off_track" ? "danger" : g.status === "at_risk" ? "warning" : "success"}
          />
          <div className="mt-0.5 text-right text-[12px] text-muted-foreground">
            {valueOf(g.actual, g.unit)} / {valueOf(g.target, g.unit)}
          </div>
        </div>
        <Badge tone={STATUS_TONE[g.status]}>{GOAL_STATUS_LABEL[g.status]}</Badge>
      </div>
      {open && kids.map((k) => <GoalLine key={k.id} g={k} depth={depth + 1} childrenOf={childrenOf} onOpen={onOpen} />)}
    </>
  );
}

// ─── The revenue cascade ──────────────────────────────────────────────

type Key = keyof CascadeInputs;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const FIELDS: { group: string; keys: { key: Key; label: string; step: number; pct?: boolean }[] }[] = [
  {
    group: "Revenue",
    keys: [
      { key: "revenueTarget", label: "The year's revenue target (₹)", step: 50000 },
      { key: "baseBook", label: "Running agreements, for a year (₹)", step: 50000 },
      { key: "retention", label: "Share that renews", step: 0.01, pct: true },
      { key: "churn", label: "Share lost during the year", step: 0.01, pct: true },
    ],
  },
  {
    group: "Sales",
    keys: [
      { key: "avgDeal", label: "A new client, for a year (₹)", step: 10000 },
      { key: "winRate", label: "Proposals accepted", step: 0.01, pct: true },
      { key: "proposalRate", label: "Leads that get a proposal", step: 0.01, pct: true },
      { key: "costPerLead", label: "What a lead costs (₹)", step: 25 },
    ],
  },
  {
    group: "Capacity",
    keys: [
      { key: "editors", label: "Editors", step: 1 },
      { key: "productiveHours", label: "Editing hours a month each", step: 5 },
      { key: "hoursPerVideo", label: "Editing hours a video", step: 0.5 },
      { key: "videosPerClient", label: "Videos a month for a new client", step: 1 },
      { key: "currentLoad", label: "Videos a month promised now", step: 1 },
    ],
  },
];
const FIGURES = [
  { value: "newNeeded", label: "New sales needed (₹)" },
  { value: "deals", label: "Clients to win" },
  { value: "proposals", label: "Proposals" },
  { value: "leads", label: "Leads" },
  { value: "requiredVideos", label: "Videos a month" },
  { value: "hires", label: "Editors to hire" },
];

function Cascade({ goals }: { goals: GoalRow[] }) {
  const can = useCan();
  const view = useCascade();
  const act = useGoalAction();
  const [v, setV] = useState<CascadeInputs | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const values = v ?? view.data?.saved ?? view.data?.history ?? null;
  const out = useMemo(() => (values ? cascade(values) : null), [values]);
  if (view.isPending) return <SkeletonRows rows={6} />;
  if (view.error || !values || !out) return <Alert tone="info">{errorMessage(view.error)}</Alert>;
  const h = view.data!.history;
  const editable = can("reports", "edit");
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {FIELDS.map((group) => (
          <SectionCard key={group.group} title={group.group}>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.keys.map((k) => (
                <Field
                  key={k.key}
                  label={k.label}
                  hint={`${view.data!.basis[k.key] ?? ""}${view.data!.basis[k.key] ? " — " : ""}history: ${k.pct ? pct(h[k.key]) : h[k.key].toLocaleString("en-IN")}`}
                >
                  <Input
                    type="number"
                    step={k.step}
                    disabled={!editable}
                    value={k.pct ? Math.round(values[k.key] * 100) : values[k.key]}
                    onChange={(e) => setV({ ...values, [k.key]: k.pct ? Number(e.target.value) / 100 : Number(e.target.value) })}
                  />
                </Field>
              ))}
            </div>
          </SectionCard>
        ))}
        {editable && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setV(h)}>
              <RotateCcw />
              Back to your history
            </Button>
            <Button
              disabled={act.isPending}
              onClick={() => act.mutate({ step: "cascade", body: values }, { onSuccess: () => (setV(null), toast.success("Saved")), onError })}
            >
              Save
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <SectionCard title="What it takes">
          <dl className="space-y-1.5 text-body">
            {[
              ["The book keeps", inrCompact(out.kept)],
              ["New sales needed", inrCompact(out.newNeeded)],
              ["Clients to win", out.deals],
              ["Proposals", out.proposals],
              ["Leads", `${out.leads} (${out.leadsPerMonth} a month)`],
              ["Advertising", inrCompact(out.adBudget)],
              ["Videos a month", out.requiredVideos],
              ["Editing capacity", `${out.capacity} a month`],
              ["Capacity used", out.utilisation === null ? "—" : `${out.utilisation}%`],
              ["Editors to hire", out.hires],
            ].map(([k, val]) => (
              <div key={String(k)} className="flex justify-between gap-3 border-b border-border-subtle pb-1">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className={cn("font-medium tabular-nums", k === "Capacity used" && (out.utilisation ?? 0) > 100 && "text-danger")}>{val}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
        {editable && view.data!.saved && (
          <SectionCard title="Set goals' targets" description="From the saved cascade, for the goals you choose.">
            <div className="space-y-2">
              {FIGURES.map((fig) => (
                <Field key={fig.value} label={fig.label}>
                  <Select
                    value={links[fig.value] ?? "_none"}
                    onValueChange={(id) => setLinks({ ...links, [fig.value]: id === "_none" ? "" : id })}
                    options={[{ value: "_none", label: "No goal" }, ...goals.map((g) => ({ value: g.id, label: g.title }))]}
                  />
                </Field>
              ))}
              <Button
                size="sm"
                disabled={!Object.values(links).some(Boolean) || act.isPending}
                onClick={() =>
                  act.mutate(
                    {
                      step: "apply",
                      links: Object.entries(links)
                        .filter(([, id]) => id)
                        .map(([figure, goalId]) => ({ figure, goalId })),
                    },
                    { onSuccess: () => toast.success("Targets set"), onError },
                  )
                }
              >
                <Target />
                Set the targets
              </Button>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

/** /app/goals: the goal tree, my goals, and the revenue cascade. */
export function LiveGoals({ goalId }: { goalId?: string }) {
  const can = useCan();
  const me = useMe().data!;
  const goals = useGoals();
  const [tab, setTab] = useState("tree");
  const [open, setOpen] = useState<string | null>(goalId ?? null);
  const [form, setForm] = useState<{ goal: GoalRow | null; parentId?: string } | null>(null);
  const list = goals.data ?? [];
  const ids = new Set(list.map((g) => g.id));
  const childrenOf = (id: string) => list.filter((g) => g.parentId === id);
  const roots = list.filter((g) => !g.parentId || !ids.has(g.parentId));
  const mine = list.filter((g) => g.owners.some((o) => o.id === me.user.id));
  const current = list.find((g) => g.id === open);
  return (
    <>
      <PageHeader
        title="Goals"
        description="The company's goals, each department's serving them, and each person's — with what the app knows filled in, and check-ins."
        actions={
          can("reports", "edit") && (
            <Button onClick={() => setForm({ goal: null })}>
              <Plus />
              New goal
            </Button>
          )
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="tree">Goal tree</TabsTrigger>
          <TabsTrigger value="mine">Mine</TabsTrigger>
          {can("reports", "view") && <TabsTrigger value="cascade">Revenue cascade</TabsTrigger>}
        </TabsList>
      </Tabs>
      {goals.isPending ? (
        <SkeletonRows rows={6} />
      ) : tab === "cascade" ? (
        <Cascade goals={list} />
      ) : !list.length ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description={can("reports", "edit") ? "Start with the company's goal for the year." : "Goals you own show here."}
        />
      ) : (
        <Card className="px-3">
          {(tab === "tree" ? roots : mine).map((g) => (
            <GoalLine key={g.id} g={g} depth={0} childrenOf={tab === "tree" ? childrenOf : () => []} onOpen={setOpen} />
          ))}
          {tab === "mine" && !mine.length && <p className="py-4 text-body text-muted-foreground">You own no goals yet.</p>}
        </Card>
      )}
      {can("reports", "view") && tab === "tree" && (
        <p className="mt-3 flex items-center gap-1.5 text-body text-muted-foreground">
          <Calculator className="size-4" />
          The revenue cascade works the year&rsquo;s target back to clients, proposals, leads and editing capacity.
        </p>
      )}
      {current && (
        <GoalDialog
          goal={current}
          goals={list}
          onClose={() => setOpen(null)}
          onEdit={() => (setForm({ goal: current }), setOpen(null))}
          onAdd={() => (setForm({ goal: null, parentId: current.id }), setOpen(null))}
        />
      )}
      {form && <GoalForm goal={form.goal} goals={list} parentId={form.parentId} onClose={() => setForm(null)} />}
    </>
  );
}
