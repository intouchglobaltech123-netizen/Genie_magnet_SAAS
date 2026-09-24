"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { personById } from "@/lib/mock/core";
import { cn } from "@/lib/utils";
import { GoalProgressBar, StatusBadge, TypeBadge } from "./goal-bits";
import { GOAL_STATUS, fmtValue, goalStatus, type Goal, type GoalStatus } from "./goals-data";
import { useGoals } from "./goals-store";

export function ByOwner({ goals }: { goals: Goal[] }) {
  const setOpen = useGoals((s) => s.setOpen);

  const byPerson = new Map<string, Goal[]>();
  for (const g of goals) for (const id of g.ownerIds) byPerson.set(id, [...(byPerson.get(id) ?? []), g]);

  const groups = [...byPerson.entries()]
    .map(([id, list]) => {
      const counts: Record<GoalStatus, number> = { "on-track": 0, "at-risk": 0, "off-track": 0 };
      list.forEach((g) => counts[goalStatus(g)]++);
      return { person: personById(id), list, counts };
    })
    .sort((a, b) => b.counts["off-track"] - a.counts["off-track"] || b.counts["at-risk"] - a.counts["at-risk"] || b.list.length - a.list.length);

  if (!groups.length) {
    return <Card className="px-5 py-12 text-center text-[13px] text-muted-foreground">No goals match these filters.</Card>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map(({ person, list, counts }) => (
        <Card key={person.id} className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={person.name} size="lg" />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold">{person.name}</div>
                <div className="truncate text-[12.5px] text-muted-foreground">
                  {person.role} · {person.department}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              {(Object.keys(GOAL_STATUS) as GoalStatus[]).map((s) =>
                counts[s] ? (
                  <Badge key={s} tone={GOAL_STATUS[s].tone} dot>
                    {counts[s]} {GOAL_STATUS[s].label.toLowerCase()}
                  </Badge>
                ) : null,
              )}
            </div>
          </div>
          <ul>
            {list.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setOpen(g.id)}
                  className={cn(
                    "grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_120px_88px] items-center gap-4 border-b border-border px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50",
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium">{g.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                      <TypeBadge type={g.type} />
                      <span className="truncate tabular">
                        {fmtValue(g.actual, g.unit)} / {fmtValue(g.target, g.unit)}
                      </span>
                    </div>
                  </div>
                  <GoalProgressBar goal={g} />
                  <div className="flex justify-end">
                    <StatusBadge status={goalStatus(g)} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
