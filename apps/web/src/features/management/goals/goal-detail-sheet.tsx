"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, Link2, PenLine, Plus, RefreshCw, ShieldCheck, TrendingDown, TrendingUp, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { TODAY, personById } from "@/lib/mock/core";
import { cn } from "@/lib/utils";
import { CadenceChip, StatusBadge, TypeBadge, ownerLabel, statusProgressTone } from "./goal-bits";
import {
  GOAL_STATUS,
  expectedProgress,
  fmtStamp,
  fmtValue,
  goalProgress,
  goalStatus,
  nowStamp,
  type CheckInKind,
  type Goal,
  type Smart,
} from "./goals-data";
import { useGoals } from "./goals-store";

const ME = { id: "p-jana", name: "Janarthanan" };

const SMART_FIELDS: { key: keyof Smart; letter: string; label: string }[] = [
  { key: "specific", letter: "S", label: "Specific" },
  { key: "measurable", letter: "M", label: "Measurable" },
  { key: "achievable", letter: "A", label: "Achievable" },
  { key: "relevant", letter: "R", label: "Relevant" },
  { key: "timeBound", letter: "T", label: "Time-bound" },
];

const KIND_META: Record<CheckInKind, { label: string; short: string; tone: "success" | "danger" | "neutral"; icon: typeof TrendingUp }> = {
  breakthrough: { label: "Breakthrough", short: "BT", tone: "success", icon: TrendingUp },
  breakdown: { label: "Breakdown", short: "BD", tone: "danger", icon: TrendingDown },
  update: { label: "Update", short: "Update", tone: "neutral", icon: MessageSquare },
};

export function GoalDetailSheet() {
  const openId = useGoals((s) => s.openId);
  const setOpen = useGoals((s) => s.setOpen);
  const goal = useGoals((s) => s.goals.find((g) => g.id === openId));

  return (
    <Dialog open={!!goal} onOpenChange={(o) => !o && setOpen(null)}>
      {goal && (
        <DialogContent side="right" className="max-w-2xl">
          <SheetInner key={goal.id} goal={goal} onClose={() => setOpen(null)} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function SheetInner({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const updateGoal = useGoals((s) => s.updateGoal);
  const addCheckIn = useGoals((s) => s.addCheckIn);

  const [smart, setSmart] = React.useState<Smart>(goal.smart);
  const [metric, setMetric] = React.useState(goal.metric);
  const [baseline, setBaseline] = React.useState(String(goal.baseline));
  const [target, setTarget] = React.useState(String(goal.target));
  const [actual, setActual] = React.useState(String(goal.actual));
  const [override, setOverride] = React.useState(goal.source.kind === "manual");
  const [reason, setReason] = React.useState(goal.source.kind === "manual" ? goal.source.reason ?? "" : "");
  const [syncedAt, setSyncedAt] = React.useState(goal.source.syncedAt);
  const [syncing, setSyncing] = React.useState(false);

  const [ciKind, setCiKind] = React.useState<CheckInKind>("update");
  const [ciNote, setCiNote] = React.useState("");
  const [ciValue, setCiValue] = React.useState("");

  const num = (s: string, fallback: number) => {
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) && s.trim() !== "" ? n : fallback;
  };
  const draft = { ...goal, baseline: num(baseline, goal.baseline), target: num(target, goal.target), actual: num(actual, goal.actual) };
  const status = goalStatus(draft);
  const progress = goalProgress(draft);
  const expected = expectedProgress(draft);
  const statusChanged = status !== goalStatus(goal);

  const linkedLabel = goal.source.kind === "linked" ? goal.source.label : goal.source.linkedLabel ?? "Connected records";
  const needsReason = override && reason.trim().length < 5;

  const dirty =
    JSON.stringify(smart) !== JSON.stringify(goal.smart) ||
    metric !== goal.metric ||
    draft.baseline !== goal.baseline ||
    draft.target !== goal.target ||
    draft.actual !== goal.actual ||
    override !== (goal.source.kind === "manual") ||
    (override && reason !== (goal.source.reason ?? ""));

  function onToggleOverride(v: boolean) {
    setOverride(v);
    if (!v) {
      setActual(String(goal.actual));
      setReason("");
    }
  }

  function syncNow() {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      const at = nowStamp();
      setSyncedAt(at);
      updateGoal(goal.id, { source: { ...goal.source, syncedAt: at } });
      toast.success(`Synced from ${linkedLabel}`, { description: `Actual confirmed at ${fmtValue(goal.actual, goal.unit)}` });
    }, 700);
  }

  function save() {
    const at = nowStamp();
    const wasManual = goal.source.kind === "manual";
    let audit: { at: string; by: string; text: string } | undefined;
    let source = goal.source;
    if (override) {
      source = { kind: "manual", label: "Manual override", reason: reason.trim(), syncedAt: at, linkedLabel };
      if (!wasManual || draft.actual !== goal.actual || reason.trim() !== (goal.source.reason ?? "")) {
        audit = {
          at,
          by: ME.name,
          text: `Manual override — actual set to ${fmtValue(draft.actual, goal.unit)} (was ${fmtValue(goal.actual, goal.unit)}). Reason: ${reason.trim()}`,
        };
      }
    } else if (wasManual) {
      source = { kind: "linked", label: linkedLabel, syncedAt: at };
      audit = { at, by: ME.name, text: `Override removed — actual now follows ${linkedLabel}.` };
    }
    updateGoal(
      goal.id,
      { smart, metric, baseline: draft.baseline, target: draft.target, actual: draft.actual, source },
      audit ?? (dirty ? { at, by: ME.name, text: "Goal definition edited (S.M.A.R.T. / measure)." } : undefined),
    );
    if (override) setReason(reason.trim());
    toast.success("Goal saved", {
      description: statusChanged ? `Status recalculated → ${GOAL_STATUS[status].label}` : `Status: ${GOAL_STATUS[status].label}`,
    });
  }

  function addCi() {
    const v = ciValue.trim() ? num(ciValue, NaN) : undefined;
    addCheckIn(goal.id, {
      id: `ci-${Date.now()}`,
      date: TODAY,
      by: ME.id,
      kind: ciKind,
      note: ciNote.trim(),
      value: v !== undefined && Number.isFinite(v) ? v : undefined,
    });
    toast.success(`${KIND_META[ciKind].label} logged`, { description: goal.title });
    setCiNote("");
    setCiValue("");
  }

  return (
    <>
      <DialogHeader className="border-b border-border pb-5">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          <span className="capitalize">{goal.level} goal</span>
          <span>·</span>
          <span>{goal.department}</span>
        </div>
        <DialogTitle className="text-[19px]">{goal.title}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
          <TypeBadge type={goal.type} />
          <StatusBadge status={status} />
          <CadenceChip cadence={goal.cadence} />
        </DialogDescription>
        <div className="flex items-center gap-2 pt-2 text-[13px]">
          <div className="flex -space-x-1.5">
            {goal.ownerIds.map((id) => (
              <Avatar key={id} name={personById(id).name} size="sm" />
            ))}
          </div>
          <span className="font-medium">{ownerLabel(goal)}</span>
          <span className="text-muted-foreground">· {goal.ownerIds.map((id) => personById(id).role).join(" / ")}</span>
        </div>
      </DialogHeader>

      <DialogBody className="space-y-7 pt-5">
        {/* Pace summary */}
        <section className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="text-[12px] text-muted-foreground">{metric}</div>
              <div className="mt-0.5 text-[24px] font-semibold tracking-tight tabular">
                {fmtValue(draft.actual, goal.unit)}
                <span className="text-[15px] font-normal text-muted-foreground"> / {fmtValue(draft.target, goal.unit)}</span>
              </div>
            </div>
            <div className="text-right text-[12px] text-muted-foreground tabular">
              Baseline {fmtValue(draft.baseline, goal.unit)}
              <br />
              {fmtStamp(goal.startDate, true)} → {fmtStamp(goal.dueDate, true)}
            </div>
          </div>
          <div className="relative mt-3">
            <Progress value={progress * 100} tone={statusProgressTone[status]} className="h-2" />
            <div
              className="absolute -top-1 h-4 w-0.5 rounded bg-foreground/60"
              style={{ left: `${Math.min(100, expected * 100)}%` }}
              title="Expected by today"
            />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-[12px] tabular">
            <span>
              Progress <span className="font-semibold">{Math.round(progress * 100)}%</span>
              <span className="text-muted-foreground"> · expected by today {Math.round(expected * 100)}%</span>
            </span>
            <span className="text-muted-foreground">
              {goal.expectedNow !== undefined ? "Pace vs planned break-up" : "Pace vs time elapsed"}
            </span>
          </div>
          {statusChanged && (
            <div className="mt-2 text-[12px] text-accent">
              Unsaved: status will change from {GOAL_STATUS[goalStatus(goal)].label} to {GOAL_STATUS[status].label}.
            </div>
          )}
        </section>

        {/* Measure */}
        <section className="space-y-3">
          <SectionTitle>Measure</SectionTitle>
          <div className="space-y-1.5">
            <Label>Metric</Label>
            <Input value={metric} onChange={(e) => setMetric(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NumField label="Baseline" value={baseline} onChange={setBaseline} unit={goal.unit} />
            <NumField label="Target" value={target} onChange={setTarget} unit={goal.unit} />
            <NumField
              label="Actual"
              value={actual}
              onChange={setActual}
              unit={goal.unit}
              disabled={!override}
              hint={!override ? "From linked source" : "Manual"}
            />
          </div>
        </section>

        {/* Actual source */}
        <section className="space-y-3">
          <SectionTitle>Actual source</SectionTitle>
          <div
            className={cn(
              "flex items-start justify-between gap-3 rounded-xl border p-3.5 transition-colors",
              override ? "border-border opacity-60" : "border-accent/30 bg-accent-soft/40",
            )}
          >
            <div className="flex gap-3">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Link2 className="size-4" />
              </span>
              <div>
                <div className="text-[13px] font-medium">Linked to connected records</div>
                <div className="text-[13px] text-muted-foreground">{linkedLabel}</div>
                <div className="mt-1 text-[12px] text-muted-foreground tabular">
                  {override ? "Paused while manual override is on" : syncedAt ? `Last synced ${fmtStamp(syncedAt)}` : "Not synced yet"}
                </div>
              </div>
            </div>
            <Button variant="outline" size="xs" disabled={override || syncing} onClick={syncNow}>
              <RefreshCw className={cn(syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
          </div>

          <div className={cn("rounded-xl border p-3.5 transition-colors", override ? "border-warning/40 bg-warning-soft/40" : "border-border")}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
                  <PenLine className="size-4" />
                </span>
                <div>
                  <div className="text-[13px] font-medium">Manual override</div>
                  <div className="text-[12px] text-muted-foreground">Type the actual yourself. A reason is required and is written to the audit log.</div>
                </div>
              </div>
              <Switch checked={override} onCheckedChange={onToggleOverride} aria-label="Manual override" />
            </div>
            <AnimatePresence initial={false}>
              {override && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5 pt-3">
                    <Label>
                      Reason for override <span className="text-danger">*</span>
                    </Label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. CRM missed two deals signed on paper at the Erode trade fair"
                      className={cn("min-h-16", needsReason && "border-warning/60")}
                    />
                    {needsReason && <p className="text-[12px] text-warning">Add a reason to enable Save.</p>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {goal.audit.length > 0 && (
            <div className="space-y-1.5">
              {goal.audit.map((a, i) => (
                <div key={i} className="flex gap-2 text-[12px] text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    <span className="font-medium text-foreground">{a.by}</span> · {fmtStamp(a.at)} — {a.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SMART */}
        <section className="space-y-3">
          <SectionTitle>S.M.A.R.T. definition</SectionTitle>
          {SMART_FIELDS.map((f) => (
            <div key={f.key} className="flex gap-3">
              <span className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-[13px] font-semibold text-accent">
                {f.letter}
              </span>
              <div className="flex-1 space-y-1">
                <Label className="text-[12px] text-muted-foreground">{f.label}</Label>
                <Textarea
                  value={smart[f.key]}
                  onChange={(e) => setSmart((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="min-h-14 text-[13px]"
                />
              </div>
            </div>
          ))}
        </section>

        {/* Check-ins */}
        <section className="space-y-3">
          <SectionTitle>
            Check-ins · BT / BD <span className="font-normal text-muted-foreground">({goal.checkIns.length})</span>
          </SectionTitle>
          <div className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg bg-muted p-0.5">
                {(["update", "breakthrough", "breakdown"] as CheckInKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCiKind(k)}
                    className={cn(
                      "h-7 cursor-pointer rounded-md px-2.5 text-[12px] font-medium transition",
                      ciKind === k ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                      ciKind === k && k === "breakthrough" && "text-success",
                      ciKind === k && k === "breakdown" && "text-danger",
                    )}
                  >
                    {KIND_META[k].label}
                  </button>
                ))}
              </div>
              <Input
                value={ciValue}
                onChange={(e) => setCiValue(e.target.value)}
                placeholder={`Reading (${goal.unit === "inr" ? "₹" : goal.unit}) — optional`}
                className="h-8 w-48 text-[13px]"
                inputMode="decimal"
              />
            </div>
            <Textarea
              value={ciNote}
              onChange={(e) => setCiNote(e.target.value)}
              placeholder={
                ciKind === "breakthrough"
                  ? "What moved the needle? e.g. Referral from Jana's coaching batch converted in 5 days"
                  : ciKind === "breakdown"
                    ? "What broke, and the corrective action?"
                    : "Progress note for the next STOP review"
              }
              className="mt-2 min-h-16 text-[13px]"
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="soft" disabled={!ciNote.trim()} onClick={addCi}>
                <Plus /> Add check-in
              </Button>
            </div>
          </div>

          <ol className="space-y-0">
            <AnimatePresence initial={false}>
              {goal.checkIns.map((c) => {
                const m = KIND_META[c.kind];
                const Icon = m.icon;
                return (
                  <motion.li
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative flex gap-3 pb-4 pl-1 last:pb-0"
                  >
                    <span
                      className={cn(
                        "relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full",
                        c.kind === "breakthrough" && "bg-success-soft text-success",
                        c.kind === "breakdown" && "bg-danger-soft text-danger",
                        c.kind === "update" && "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[12px]">
                        <Badge tone={m.tone}>{m.short}</Badge>
                        <span className="font-medium">{personById(c.by).name}</span>
                        <span className="text-muted-foreground">{fmtStamp(c.date, true)}</span>
                        {c.value !== undefined && <span className="text-muted-foreground tabular">· reading {fmtValue(c.value, goal.unit)}</span>}
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed">{c.note}</p>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
            {goal.checkIns.length === 0 && (
              <li className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <History className="size-4" /> No check-ins yet — the first one sets the tone for the next STOP review.
              </li>
            )}
          </ol>
        </section>
      </DialogBody>

      <DialogFooter className="sticky bottom-0 items-center bg-popover">
        <span className="mr-auto text-[12px] text-muted-foreground">
          {needsReason ? "Reason required for manual override" : dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" variant="accent" disabled={needsReason || !dirty} onClick={save}>
          Save changes
        </Button>
      </DialogFooter>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[13px] font-semibold tracking-tight">{children}</h4>;
}

function NumField({
  label,
  value,
  onChange,
  unit,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: Goal["unit"];
  disabled?: boolean;
  hint?: string;
}) {
  const suffix = { inr: "₹", pct: "%", count: "#", hours: "h", days: "d" }[unit];
  const n = Number(value);
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center justify-between">
        {label}
        {hint && <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>}
      </Label>
      <div className="relative">
        <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} inputMode="decimal" className="pr-8 tabular" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">{suffix}</span>
      </div>
      {unit === "inr" && Number.isFinite(n) && <div className="text-[11.5px] text-muted-foreground tabular">{fmtValue(n, unit)}</div>}
    </div>
  );
}
