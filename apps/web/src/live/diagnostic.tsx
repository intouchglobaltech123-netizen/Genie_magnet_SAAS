"use client";

import { useState } from "react";
import { Activity, Compass, Map as MapIcon, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  BFA_ACTIONS,
  type BfaRow,
  bfaScores,
  FITMENT_MEANING,
  FITMENT_QUADRANTS,
  type FitmentQuadrant,
  project,
  ROAD_MAP_STATUS_LABEL,
  ROAD_MAP_STATUSES,
  type RoadMapRow,
  type RoadMapStatus,
  type ScenarioInputs,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, inr, inrCompact } from "@/lib/utils";
import { errorMessage } from "./api";
import { monthLabel } from "./production-bits";
import {
  useCan,
  useDiagnostic,
  useDiagnosticAction,
  useDiagnosticClients,
  useGoals,
  usePeople,
  useRoadMap,
  useScenarioBaseline,
  useScenarios,
} from "./queries";

const onError = (e: unknown) => toast.error(errorMessage(e));
const tone = (pct: number | null): BadgeTone => (pct === null ? "neutral" : pct >= 75 ? "success" : pct >= 50 ? "warning" : "danger");
const QUADRANT_TONE: Record<FitmentQuadrant, string> = {
  Amazing: "bg-success-soft",
  "Bread-winning": "bg-info-soft",
  Convenience: "bg-muted",
  Dangerous: "bg-danger-soft",
};

// ─── BFA ──────────────────────────────────────────────────────────────

const YES_NO = [
  { value: "_", label: "—" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
const yn = (v: boolean | null) => (v === null ? "_" : v ? "yes" : "no");
const toBool = (v: string) => (v === "_" ? null : v === "yes");

function Bfa() {
  const can = useCan();
  const q = useDiagnostic();
  const act = useDiagnosticAction();
  const [rows, setRows] = useState<BfaRow[] | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  if (q.isPending) return <SkeletonRows rows={6} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const v = q.data;
  const base: BfaRow[] =
    v.current?.rows ?? v.functions.map((f) => ({ function: f, consistent: null, ownerDependent: null, results: null, leader: null, action: null }));
  const editing = rows ?? base;
  const scores = bfaScores(editing);
  const set = (i: number, patch: Partial<BfaRow>) => setRows(editing.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-4">
      {!v.current && <Alert tone="info">Answer the BFA in the agency questionnaire, or fill it in here.</Alert>}
      {v.current && (
        <p className="text-body text-muted-foreground">
          {v.current.source === "questionnaire"
            ? "From the agency questionnaire"
            : `Taken ${new Date(v.current.takenAt!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
          {rows && " — changed, not yet saved"}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-body text-muted-foreground">BFA score</div>
          <div className="text-heading font-semibold">{scores.overall === null ? "—" : `${scores.overall}%`}</div>
          <Progress value={scores.overall ?? 0} tone={scores.overall !== null && scores.overall < 50 ? "danger" : "success"} />
        </Card>
        <Card className="p-4">
          <div className="text-body text-muted-foreground">Founder dependency</div>
          <div className="text-heading font-semibold">{scores.founderDependency === null ? "—" : `${scores.founderDependency}%`}</div>
          <Progress value={scores.founderDependency ?? 0} tone={scores.founderDependency !== null && scores.founderDependency > 50 ? "danger" : "warning"} />
          <div className="mt-1 text-body text-muted-foreground">How much of the business runs only through the owner.</div>
        </Card>
      </div>
      <Card className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Function</TH>
              <TH>Done consistently</TH>
              <TH>Depends on the owner</TH>
              <TH>Results</TH>
              <TH>Second-line leader</TH>
              <TH>Next step</TH>
              <TH numeric>Score</TH>
            </TR>
          </THead>
          <TBody>
            {editing.map((r, i) => {
              const sc = scores.functions[i]!;
              return (
                <TR key={r.function}>
                  <TD className="font-medium">{r.function}</TD>
                  <TD>
                    {can("reports", "edit") ? (
                      <Select value={yn(r.consistent)} onValueChange={(x) => set(i, { consistent: toBool(x) })} options={YES_NO} />
                    ) : (
                      yn(r.consistent)
                    )}
                  </TD>
                  <TD>
                    {can("reports", "edit") ? (
                      <Select value={yn(r.ownerDependent)} onValueChange={(x) => set(i, { ownerDependent: toBool(x) })} options={YES_NO} />
                    ) : (
                      yn(r.ownerDependent)
                    )}
                  </TD>
                  <TD>
                    {can("reports", "edit") ? (
                      <Select
                        value={r.results ?? "_"}
                        onValueChange={(x) => set(i, { results: x === "_" ? null : (x as "High" | "Low") })}
                        options={[
                          { value: "_", label: "—" },
                          { value: "High", label: "High" },
                          { value: "Low", label: "Low" },
                        ]}
                      />
                    ) : (
                      (r.results ?? "—")
                    )}
                  </TD>
                  <TD>
                    {can("reports", "edit") ? (
                      <Select value={yn(r.leader)} onValueChange={(x) => set(i, { leader: toBool(x) })} options={YES_NO} />
                    ) : (
                      yn(r.leader)
                    )}
                  </TD>
                  <TD>
                    {can("reports", "edit") ? (
                      <Select
                        value={r.action ?? "_"}
                        onValueChange={(x) => set(i, { action: x === "_" ? null : x })}
                        options={[{ value: "_", label: "—" }, ...BFA_ACTIONS.map((a) => ({ value: a, label: a }))]}
                      />
                    ) : (
                      (r.action ?? "—")
                    )}
                  </TD>
                  <TD numeric>
                    <Badge tone={tone(sc.percent)}>{sc.points}/4</Badge>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
      {v.current && v.current.challenges.some((c) => c.challenge) && (
        <SectionCard title="Challenges" description="The biggest first.">
          <ul className="space-y-1 text-body">
            {[...v.current.challenges]
              .filter((c) => c.challenge)
              .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
              .map((c, i) => (
                <li key={i}>
                  <span className="font-medium">{c.function}</span>: {c.challenge}
                  {c.rating !== null && <span className="text-muted-foreground"> · {c.rating}/10</span>}
                </li>
              ))}
          </ul>
        </SectionCard>
      )}
      {can("reports", "edit") ? (
        <Field label="What is working, and what is not">
          <Textarea rows={3} value={notes ?? v.current?.notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      ) : (
        v.current?.notes && <p className="text-body">{v.current.notes}</p>
      )}
      {can("reports", "edit") && (
        <Button
          disabled={act.isPending}
          onClick={() =>
            act.mutate(
              { step: "take", body: { rows: editing, challenges: v.current?.challenges ?? [], notes: notes ?? v.current?.notes ?? "" } },
              { onSuccess: () => (setRows(null), setNotes(null), toast.success("Saved with today's date")), onError },
            )
          }
        >
          <Save />
          Save the diagnostic
        </Button>
      )}
      {v.history.length > 1 && (
        <SectionCard title="Over time">
          <Table>
            <THead>
              <TR>
                <TH>Taken</TH>
                <TH numeric>BFA</TH>
                <TH numeric>Founder dependency</TH>
              </TR>
            </THead>
            <TBody>
              {v.history.map((h) => (
                <TR key={h.id}>
                  <TD>{new Date(h.takenAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</TD>
                  <TD numeric>{h.overall ?? "—"}%</TD>
                  <TD numeric>{h.founderDependency ?? "—"}%</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </SectionCard>
      )}
    </div>
  );
}

// ─── Clients ──────────────────────────────────────────────────────────

function Clients() {
  const can = useCan();
  const q = useDiagnosticClients();
  const act = useDiagnosticAction();
  if (q.isPending) return <SkeletonRows rows={6} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const { rows, medianFee, medianHours } = q.data;
  if (!rows.length) return <EmptyState title="No running clients" description="Clients with a running agreement show here." />;
  const placed = (c: (typeof rows)[number]) => c.fitment ?? c.suggested;
  // High return on top, low effort on the left.
  const grid: FitmentQuadrant[] = ["Amazing", "Bread-winning", "Convenience", "Dangerous"];
  return (
    <div className="space-y-4">
      <p className="text-body text-muted-foreground">
        Return is the client&rsquo;s monthly fee (the middle is {inr(medianFee)}); effort is the hours a month their work took over the last three months (the
        middle is {medianHours} h).
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {grid.map((quad) => (
          <Card key={quad} className={cn("p-4", QUADRANT_TONE[quad])}>
            <div className="font-semibold">{quad}</div>
            <div className="mb-2 text-body text-muted-foreground">{FITMENT_MEANING[quad]}</div>
            <ul className="flex flex-wrap gap-1.5">
              {rows
                .filter((c) => placed(c) === quad)
                .map((c) => (
                  <li key={c.client.id}>
                    <Badge tone="outline">
                      {c.client.name}
                      {!c.fitment && " (suggested)"}
                    </Badge>
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Client</TH>
              <TH numeric>Fee a month</TH>
              <TH numeric>Hours a month</TH>
              <TH>Fitment</TH>
              <TH numeric>Health</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((c) => (
              <TR key={c.client.id}>
                <TD className="font-medium">{c.client.name}</TD>
                <TD numeric>{inr(c.fee)}</TD>
                <TD numeric>{c.hours}</TD>
                <TD>
                  {can("reports", "edit") ? (
                    <Select
                      value={c.fitment ?? "_"}
                      onValueChange={(v) =>
                        act.mutate({ step: "fitment", clientId: c.client.id, fitment: v === "_" ? null : (v as FitmentQuadrant) }, { onError })
                      }
                      options={[{ value: "_", label: `Suggested: ${c.suggested}` }, ...FITMENT_QUADRANTS.map((f) => ({ value: f, label: f }))]}
                    />
                  ) : (
                    placed(c)
                  )}
                </TD>
                <TD numeric>
                  <span
                    title={`Delivery ${c.health.parts.delivery}/30 · revisions ${c.health.parts.revisions}/20 · payments ${c.health.parts.payments}/25 · agreement ${c.health.parts.agreement}/15 · onboarding ${c.health.parts.onboarding}/10`}
                  >
                    <Badge tone={tone(c.health.score)}>{c.health.score}</Badge>
                  </span>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <p className="text-body text-muted-foreground">
        Health out of 100: delivery on time (30), revisions (20), paying on time (25), the agreement (15) and onboarding (10).
      </p>
    </div>
  );
}

// ─── Road map ─────────────────────────────────────────────────────────

const STATUS_TONE: Record<RoadMapStatus, BadgeTone> = { planned: "neutral", in_progress: "info", done: "success", dropped: "outline" };

function ItemDialog({ item, functions, onClose }: { item: RoadMapRow | null; functions: readonly string[]; onClose: () => void }) {
  const act = useDiagnosticAction();
  const people = usePeople();
  const goals = useGoals();
  const [thisMonth] = useState(() => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 7));
  const [f, setF] = useState({
    function: item?.function ?? functions[0] ?? "Management",
    title: item?.title ?? "",
    detail: item?.detail ?? "",
    startMonth: item?.startMonth ?? thisMonth,
    endMonth: item?.endMonth ?? thisMonth,
    ownerId: item?.owner?.id ?? "",
    status: (item?.status ?? "planned") as RoadMapStatus,
    priority: String(item?.priority ?? 5),
    goalId: item?.goal?.id ?? "",
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Change the item" : "New road map item"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="What will be done" className="sm:col-span-2">
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Function">
            <Select value={f.function} onValueChange={(v) => setF({ ...f, function: v })} options={functions.map((x) => ({ value: x, label: x }))} />
          </Field>
          <Field label="Status">
            <Select
              value={f.status}
              onValueChange={(v) => setF({ ...f, status: v as RoadMapStatus })}
              options={ROAD_MAP_STATUSES.map((s) => ({ value: s, label: ROAD_MAP_STATUS_LABEL[s] }))}
            />
          </Field>
          <Field label="From">
            <Input type="month" value={f.startMonth} onChange={(e) => setF({ ...f, startMonth: e.target.value })} />
          </Field>
          <Field label="To">
            <Input type="month" value={f.endMonth} onChange={(e) => setF({ ...f, endMonth: e.target.value })} />
          </Field>
          <Field label="Owner">
            <Select
              value={f.ownerId || "_none"}
              onValueChange={(v) => setF({ ...f, ownerId: v === "_none" ? "" : v })}
              options={[{ value: "_none", label: "No one" }, ...(people.data ?? []).map((p) => ({ value: p.user.id, label: p.user.name }))]}
            />
          </Field>
          <Field label="Priority (1 to 10)">
            <Input type="number" min={1} max={10} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} />
          </Field>
          <Field label="Goal it serves" className="sm:col-span-2">
            <Select
              value={f.goalId || "_none"}
              onValueChange={(v) => setF({ ...f, goalId: v === "_none" ? "" : v })}
              options={[{ value: "_none", label: "None" }, ...(goals.data ?? []).map((g) => ({ value: g.id, label: g.title }))]}
            />
          </Field>
          <Field label="Detail" className="sm:col-span-2">
            <Textarea rows={3} value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
          </Field>
        </DialogBody>
        <DialogFooter>
          {item && (
            <Button variant="ghost" className="mr-auto" onClick={() => act.mutate({ step: "removeItem", id: item.id }, { onSuccess: onClose, onError })}>
              <Trash2 />
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={f.title.trim().length < 3 || act.isPending}
            onClick={() =>
              act.mutate(
                { step: "item", id: item?.id, body: { ...f, ownerId: f.ownerId || null, goalId: f.goalId || null, priority: Number(f.priority) || 5 } },
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

function RoadMap() {
  const can = useCan();
  const q = useRoadMap();
  const diag = useDiagnostic();
  const act = useDiagnosticAction();
  const [open, setOpen] = useState<RoadMapRow | "new" | null>(null);
  const functions = diag.data?.functions ?? [];
  if (q.isPending) return <SkeletonRows rows={5} />;
  const items = q.data ?? [];
  const months = [...new Set(items.flatMap((i) => [i.startMonth, i.endMonth]))].sort();
  const quarters = [...new Set(items.map((i) => i.startMonth))].sort();
  return (
    <div className="space-y-4">
      {can("reports", "edit") && (
        <div className="flex gap-2">
          <Button onClick={() => setOpen("new")}>
            <Plus />
            New item
          </Button>
          {!items.length && (
            <Button
              variant="secondary"
              disabled={act.isPending}
              onClick={() => act.mutate({ step: "draft" }, { onSuccess: () => toast.success("Drafted from the challenges"), onError })}
            >
              <Sparkles />
              Draft it from the diagnostic
            </Button>
          )}
        </div>
      )}
      {!items.length ? (
        <EmptyState
          icon={MapIcon}
          title="No road map yet"
          description="Plan what the agency fixes and builds, month by month, starting from the biggest challenges."
        />
      ) : (
        <div className="space-y-3">
          {quarters.map((start) => (
            <SectionCard key={start} title={`From ${monthLabel(start)}`}>
              <ul className="space-y-2">
                {items
                  .filter((i) => i.startMonth === start)
                  .map((i) => (
                    <li
                      key={i.id}
                      className={cn(
                        "flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border p-3 text-body",
                        can("reports", "edit") && "cursor-pointer hover:border-primary/40",
                      )}
                      onClick={() => can("reports", "edit") && setOpen(i)}
                    >
                      <span>
                        <span className="font-medium">{i.title}</span>
                        <span className="block text-muted-foreground">
                          {i.function} · {monthLabel(i.startMonth)}
                          {i.endMonth !== i.startMonth && ` to ${monthLabel(i.endMonth)}`}
                          {i.owner && ` · ${i.owner.name}`}
                          {i.goal && ` · for “${i.goal.title}”`}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Badge tone="outline">P{i.priority}</Badge>
                        <Badge tone={STATUS_TONE[i.status]}>{ROAD_MAP_STATUS_LABEL[i.status]}</Badge>
                      </span>
                    </li>
                  ))}
              </ul>
            </SectionCard>
          ))}
          {months.length > 0 && (
            <p className="text-body text-muted-foreground">
              {items.filter((i) => i.status === "done").length} of {items.length} done.
            </p>
          )}
        </div>
      )}
      {open && <ItemDialog item={open === "new" ? null : open} functions={functions.length ? functions : ["Management"]} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ─── Scenarios ────────────────────────────────────────────────────────

type Key = Exclude<keyof ScenarioInputs, "hires">;
const SCENARIO_FIELDS: { key: Key; label: string; step: number; pct?: boolean }[] = [
  { key: "months", label: "Months to look ahead", step: 1 },
  { key: "startClients", label: "Clients now", step: 1 },
  { key: "avgFee", label: "Average fee a month (₹)", step: 1000 },
  { key: "feeRise", label: "Fee rise each year", step: 1, pct: true },
  { key: "newClientsPerMonth", label: "New clients a month", step: 0.5 },
  { key: "churnPerMonth", label: "Clients leaving a month", step: 0.5, pct: true },
  { key: "teamCostPerMonth", label: "Team cost a month (₹)", step: 5000 },
  { key: "overheadPerMonth", label: "Overheads a month (₹)", step: 1000 },
  { key: "adSpendPerMonth", label: "Advertising a month (₹)", step: 1000 },
];

function Scenarios() {
  const can = useCan();
  const baseline = useScenarioBaseline();
  const list = useScenarios();
  const act = useDiagnosticAction();
  const [current, setCurrent] = useState<{ id?: string; name: string; inputs: ScenarioInputs } | null>(null);
  const [hire, setHire] = useState({ month: "", cost: "" });
  const s = current ?? (baseline.data ? { name: "From where we stand", inputs: baseline.data } : null);
  const p = s ? project(s.inputs) : null;
  if (!s || !p) return <SkeletonRows rows={6} />;
  const set = (k: Key, v: number) => setCurrent({ ...s, inputs: { ...s.inputs, [k]: v } });
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        {(list.data?.length ?? 0) > 0 && (
          <Field label="Saved scenarios">
            <Select
              value={current?.id ?? "_base"}
              onValueChange={(id) => {
                const found = list.data!.find((x) => x.id === id);
                setCurrent(found ? { id: found.id, name: found.name, inputs: found.inputs } : null);
              }}
              options={[{ value: "_base", label: "From where we stand" }, ...list.data!.map((x) => ({ value: x.id, label: x.name }))]}
            />
          </Field>
        )}
        <SectionCard title="What if">
          <div className="space-y-2">
            {SCENARIO_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <Input
                  type="number"
                  step={f.step}
                  value={f.pct ? Math.round(s.inputs[f.key] * 1000) / 10 : s.inputs[f.key]}
                  onChange={(e) => set(f.key, f.pct ? Number(e.target.value) / 100 : Number(e.target.value))}
                />
              </Field>
            ))}
            <div>
              <div className="mb-1 text-body font-medium">People added</div>
              <ul className="mb-2 space-y-1 text-body">
                {s.inputs.hires.map((h, i) => (
                  <li key={i} className="flex items-center justify-between">
                    From month {h.month}: {inr(h.cost)} a month
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove"
                      onClick={() => setCurrent({ ...s, inputs: { ...s.inputs, hires: s.inputs.hires.filter((_, j) => j !== i) } })}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input type="number" min={1} placeholder="Month" value={hire.month} onChange={(e) => setHire({ ...hire, month: e.target.value })} />
                <Input type="number" min={0} placeholder="Cost a month" value={hire.cost} onChange={(e) => setHire({ ...hire, cost: e.target.value })} />
                <Button
                  variant="secondary"
                  disabled={!hire.month || !hire.cost}
                  onClick={() => (
                    setCurrent({ ...s, inputs: { ...s.inputs, hires: [...s.inputs.hires, { month: Number(hire.month), cost: Number(hire.cost) }] } }),
                    setHire({ month: "", cost: "" })
                  )}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>
        {can("reports", "edit") && (
          <div className="flex flex-wrap gap-2">
            <Input value={s.name} onChange={(e) => setCurrent({ ...s, name: e.target.value })} />
            <Button
              disabled={s.name.trim().length < 2 || act.isPending}
              onClick={() =>
                act.mutate(
                  { step: "scenario", id: current?.id, body: { name: s.name, inputs: s.inputs } },
                  {
                    onSuccess: (rows) => {
                      const saved = (rows as { id: string; name: string }[]).find((x) => x.name === s.name);
                      if (saved) setCurrent({ ...s, id: saved.id });
                      toast.success("Saved");
                    },
                    onError,
                  },
                )
              }
            >
              <Save />
              Save
            </Button>
            {current?.id && (
              <Button variant="ghost" onClick={() => act.mutate({ step: "removeScenario", id: current.id! }, { onSuccess: () => setCurrent(null), onError })}>
                <Trash2 />
                Remove
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Revenue", inrCompact(p.revenue)],
            ["Costs", inrCompact(p.costs)],
            ["Profit", inrCompact(p.profit)],
            ["Margin", p.margin === null ? "—" : `${p.margin}%`],
          ].map(([k, v]) => (
            <Card key={k} className="p-3">
              <div className="text-body text-muted-foreground">{k}</div>
              <div className={cn("text-subheading font-semibold", k === "Profit" && p.profit < 0 && "text-danger")}>{v}</div>
            </Card>
          ))}
        </div>
        {p.firstProfitable !== 1 && (
          <Alert tone={p.firstProfitable ? "info" : "warning"}>
            {p.firstProfitable ? `Profitable from month ${p.firstProfitable}.` : "Not profitable in these months."}
          </Alert>
        )}
        <Card className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Month</TH>
                <TH numeric>Clients</TH>
                <TH numeric>Revenue</TH>
                <TH numeric>Costs</TH>
                <TH numeric>Profit</TH>
              </TR>
            </THead>
            <TBody>
              {p.rows.map((r) => (
                <TR key={r.month}>
                  <TD>{r.month}</TD>
                  <TD numeric>{r.clients}</TD>
                  <TD numeric>{inr(r.revenue)}</TD>
                  <TD numeric>{inr(r.costs)}</TD>
                  <TD numeric className={cn(r.profit < 0 && "text-danger")}>
                    {inr(r.profit)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

/** /app/diagnostic: the BFA and founder dependency, client fitment and health, the road map, scenarios. */
export function LiveDiagnostic() {
  const [tab, setTab] = useState("bfa");
  return (
    <>
      <PageHeader
        title="Business diagnostic"
        description="How each function runs and how much rests on the founder; which clients are worth the effort and how healthy they are; the Strategic Road Map; and what-if scenarios."
      />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="bfa">
            <Activity className="size-4" />
            BFA
          </TabsTrigger>
          <TabsTrigger value="clients">Client fitment and health</TabsTrigger>
          <TabsTrigger value="road">
            <Compass className="size-4" />
            Road map
          </TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "bfa" ? <Bfa /> : tab === "clients" ? <Clients /> : tab === "road" ? <RoadMap /> : <Scenarios />}
    </>
  );
}
