"use client";

import { CalendarClock } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress, type ProgressTone } from "@/components/ui/progress";
import { personById } from "@/lib/mock/core";
import { cn } from "@/lib/utils";
import { CADENCES, GOAL_STATUS, GOAL_TYPES, goalProgress, goalStatus, type Goal, type GoalStatus, type GoalType } from "./goals-data";

export const statusProgressTone: Record<GoalStatus, ProgressTone> = {
  "on-track": "success",
  "at-risk": "warning",
  "off-track": "danger",
};

export function StatusBadge({ status, className }: { status: GoalStatus; className?: string }) {
  const s = GOAL_STATUS[status];
  return (
    <Badge tone={s.tone} dot className={className}>
      {s.label}
    </Badge>
  );
}

export function TypeBadge({ type }: { type: GoalType }) {
  const t = GOAL_TYPES[type];
  return <Badge tone={t.tone}>{t.label}</Badge>;
}

export function CadenceChip({ cadence, className }: { cadence: Goal["cadence"]; className?: string }) {
  const c = CADENCES[cadence];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11.5px] text-muted-foreground", className)}>
      <CalendarClock className="size-3" />
      {c.label} · {c.every}
    </span>
  );
}

export function OwnerAvatars({ ids, size = "sm" }: { ids: string[]; size?: "xs" | "sm" | "md" }) {
  return (
    <div className="flex -space-x-1.5">
      {ids.map((id) => (
        <Avatar key={id} name={personById(id).name} size={size} />
      ))}
    </div>
  );
}

export function GoalProgressBar({ goal, className }: { goal: Goal; className?: string }) {
  const p = goalProgress(goal);
  const st = goalStatus(goal);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Progress value={p * 100} tone={statusProgressTone[st]} className="flex-1" />
      <span className="w-9 text-right text-[12px] font-medium tabular text-muted-foreground">{Math.round(p * 100)}%</span>
    </div>
  );
}

export function ownerLabel(g: Goal) {
  return g.ownerNote ?? g.ownerIds.map((id) => personById(id).name).join(" · ");
}
