"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TODAY, employees } from "@/lib/mock/core";
import { GOAL_TYPES, nowStamp, type Cadence, type GoalType, type GoalUnit } from "./goals-data";
import { useGoals } from "./goals-store";

export function NewGoalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const goals = useGoals((s) => s.goals);
  const addGoal = useGoals((s) => s.addGoal);
  const setOpen = useGoals((s) => s.setOpen);

  const parents = goals.filter((g) => g.level !== "individual");
  const [title, setTitle] = React.useState("");
  const [parentId, setParentId] = React.useState("g-prod-ontime");
  const [type, setType] = React.useState<GoalType>("operational");
  const [owner, setOwner] = React.useState("p-surya");
  const [metric, setMetric] = React.useState("");
  const [unit, setUnit] = React.useState<GoalUnit>("count");
  const [baseline, setBaseline] = React.useState("0");
  const [target, setTarget] = React.useState("");
  const [due, setDue] = React.useState("2026-12-31");
  const [cadence, setCadence] = React.useState<Cadence>("tactical");

  const valid = title.trim().length > 3 && metric.trim() && target.trim() !== "" && Number.isFinite(Number(target));

  function create() {
    const parent = goals.find((g) => g.id === parentId)!;
    const id = `i-new-${Date.now()}`;
    const b = Number(baseline) || 0;
    addGoal({
      id,
      parentId,
      level: parent.level === "company" ? "department" : "individual",
      title: title.trim(),
      department: parent.department,
      type,
      ownerIds: [owner],
      metric: metric.trim(),
      unit,
      baseline: b,
      target: Number(target),
      actual: b,
      startDate: TODAY,
      dueDate: due,
      cadence,
      source: { kind: "manual", label: "Manual override", reason: "New goal — link a data source once the metric is agreed.", syncedAt: nowStamp(), linkedLabel: "Connected records" },
      smart: {
        specific: title.trim(),
        measurable: metric.trim(),
        achievable: "",
        relevant: `Supports “${parent.title}”.`,
        timeBound: `By ${new Date(due).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`,
      },
      checkIns: [],
      audit: [{ at: nowStamp(), by: "Janarthanan", text: "Goal created." }],
    });
    toast.success("Goal created", { description: `${title.trim()} — under “${parent.title}”` });
    onOpenChange(false);
    setTitle("");
    setMetric("");
    setTarget("");
    setTimeout(() => setOpen(id), 150);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New goal</DialogTitle>
          <DialogDescription>Add it under a company or department goal. You can complete the S.M.A.R.T. fields next.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Goal">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deliver all Diwali campaign reels by 20 Oct" autoFocus />
          </Field>
          <Field label="Rolls up to">
            <Select value={parentId} onValueChange={setParentId} options={parents.map((p) => ({ value: p.id, label: p.title }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              <Select value={owner} onValueChange={setOwner} options={employees.map((p) => ({ value: p.id, label: p.name }))} />
            </Field>
            <Field label="Type">
              <Select
                value={type}
                onValueChange={(v) => setType(v as GoalType)}
                options={Object.entries(GOAL_TYPES).map(([k, t]) => ({ value: k, label: t.label }))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label="Metric">
              <Input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="e.g. Reels delivered on time" />
            </Field>
            <Field label="Unit">
              <Select
                value={unit}
                onValueChange={(v) => setUnit(v as GoalUnit)}
                options={[
                  { value: "count", label: "Count" },
                  { value: "pct", label: "%" },
                  { value: "inr", label: "₹" },
                  { value: "hours", label: "Hours" },
                  { value: "days", label: "Days" },
                ]}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Baseline">
              <Input value={baseline} onChange={(e) => setBaseline(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Target">
              <Input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="—" />
            </Field>
            <Field label="Due" className="col-span-2">
              <Input type="date" value={due} min={TODAY} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
          <Field label="STOP review cadence">
            <Select
              value={cadence}
              onValueChange={(v) => setCadence(v as Cadence)}
              options={[
                { value: "strategic", label: "Strategic · 45-day" },
                { value: "tactical", label: "Tactical · 14-day" },
                { value: "operational", label: "Operational · daily" },
              ]}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="accent" size="sm" disabled={!valid} onClick={create}>
            Create goal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
