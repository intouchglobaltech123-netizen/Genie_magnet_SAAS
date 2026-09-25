"use client";

import * as React from "react";
import { ChevronRight, Link2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, fmtDate } from "@/lib/utils";
import { CadenceChip, GoalProgressBar, OwnerAvatars, StatusBadge, TypeBadge, ownerLabel } from "./goal-bits";
import { daysLeft, fmtValue, goalStatus, type Goal } from "./goals-data";
import { useGoals } from "./goals-store";

interface Row {
  goal: Goal;
  depth: number;
  guides: boolean[]; // per ancestor level: draw a continuing vertical line
  isLast: boolean;
  hasChildren: boolean;
  dim: boolean;
}

const INDENT = 22;

export function GoalTree({ goals, matches }: { goals: Goal[]; matches: (g: Goal) => boolean }) {
  const setOpen = useGoals((s) => s.setOpen);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const children = React.useMemo(() => {
    const m = new Map<string | null, Goal[]>();
    for (const g of goals) m.set(g.parentId, [...(m.get(g.parentId) ?? []), g]);
    return m;
  }, [goals]);

  const visible = React.useMemo(() => {
    const memo = new Map<string, boolean>();
    const vis = (g: Goal): boolean => {
      if (memo.has(g.id)) return memo.get(g.id)!;
      const v = matches(g) || (children.get(g.id) ?? []).some(vis);
      memo.set(g.id, v);
      return v;
    };
    return vis;
  }, [children, matches]);

  const rows: Row[] = [];
  const walk = (parent: string | null, depth: number, guides: boolean[]) => {
    const kids = (children.get(parent) ?? []).filter(visible);
    kids.forEach((g, i) => {
      const isLast = i === kids.length - 1;
      const grand = (children.get(g.id) ?? []).filter(visible);
      rows.push({ goal: g, depth, guides, isLast, hasChildren: grand.length > 0, dim: !matches(g) });
      if (!collapsed.has(g.id)) walk(g.id, depth + 1, [...guides, !isLast]);
    });
  };
  walk(null, 0, []);

  const allParents = goals.filter((g) => (children.get(g.id) ?? []).length > 0).map((g) => g.id);
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-5 py-3">
        <div className="text-body text-muted-foreground">
          Company <span className="text-muted-foreground/50">→</span> Department <span className="text-muted-foreground/50">→</span> Individual
          <span className="ml-2 tabular">· {rows.length} shown</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="xs" onClick={() => setCollapsed(new Set())}>
            Expand all
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setCollapsed(new Set(goals.filter((g) => g.level === "department").map((g) => g.id)))}>
            Departments only
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setCollapsed(new Set(allParents))}>
            Collapse all
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[minmax(0,1fr)_84px_170px_170px_104px_96px] items-center gap-4 border-b border-border bg-muted/40 px-5 py-2 text-body font-medium uppercase tracking-wide text-muted-foreground">
            <span>Goal</span>
            <span>Owner</span>
            <span>Actual / target</span>
            <span>Progress</span>
            <span>Status</span>
            <span className="text-right">Due</span>
          </div>

          {rows.length === 0 && <div className="px-5 py-12 text-center text-body text-muted-foreground">No goals match these filters.</div>}

          {rows.map(({ goal: g, depth, guides, isLast, hasChildren, dim }) => {
            const st = goalStatus(g);
            const left = daysLeft(g);
            const open = !collapsed.has(g.id);
            return (
              <div
                key={g.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpen(g.id)}
                onKeyDown={(e) => e.key === "Enter" && setOpen(g.id)}
                className={cn(
                  "group grid cursor-pointer grid-cols-[minmax(0,1fr)_84px_170px_170px_104px_96px] items-stretch gap-4 border-b border-border px-5 transition-colors last:border-b-0 hover:bg-muted/50",
                  g.level === "company" && "bg-primary-soft/25",
                  dim && "opacity-55",
                )}
              >
                {/* Goal cell with tree connectors */}
                <div className="flex min-w-0 items-stretch">
                  {guides.slice(1).map((line, i) => (
                    <span key={i} className="relative shrink-0" style={{ width: INDENT }}>
                      {line && <span className="absolute left-[10px] top-0 bottom-0 border-l border-border" />}
                    </span>
                  ))}
                  {depth > 0 && (
                    <span className="relative shrink-0" style={{ width: INDENT }}>
                      <span className={cn("absolute left-[10px] top-0 border-l border-border", isLast ? "h-1/2" : "bottom-0")} />
                      <span className="absolute left-[10px] top-1/2 w-[10px] border-t border-border" />
                    </span>
                  )}
                  <div className="flex min-w-0 items-center gap-2 py-3">
                    {hasChildren ? (
                      <button
                        type="button"
                        aria-label={open ? "Collapse" : "Expand"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(g.id);
                        }}
                        className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
                      </button>
                    ) : (
                      <span className="inline-flex size-5 shrink-0 items-center justify-center">
                        <span className="size-1.5 rounded-full bg-border" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "truncate text-body group-hover:text-primary",
                          g.level === "company" ? "font-semibold" : g.level === "department" ? "font-medium" : "",
                        )}
                      >
                        {g.title}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <TypeBadge type={g.type} />
                        <CadenceChip cadence={g.cadence} />
                        <Tooltip
                          content={g.source.kind === "linked" ? "Actual pulled from connected records" : `Manual override: ${g.source.reason ?? ""}`}
                        >
                          <span className="inline-flex items-center gap-1 text-body text-muted-foreground">
                            {g.source.kind === "linked" ? <Link2 className="size-3" /> : <PenLine className="size-3 text-warning" />}
                            {g.source.kind === "linked" ? g.source.label : "Manual"}
                          </span>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center" title={ownerLabel(g)}>
                  <OwnerAvatars ids={g.ownerIds} />
                </div>

                <div className="flex flex-col justify-center text-body tabular">
                  <span>
                    <span className="font-semibold">{fmtValue(g.actual, g.unit)}</span>
                    <span className="text-muted-foreground"> / {fmtValue(g.target, g.unit)}</span>
                  </span>
                  <span className="truncate text-body text-muted-foreground">{g.metric}</span>
                </div>

                <div className="flex items-center">
                  <GoalProgressBar goal={g} className="w-full" />
                </div>

                <div className="flex items-center">
                  <StatusBadge status={st} />
                </div>

                <div className="flex flex-col items-end justify-center text-body tabular">
                  <span>{fmtDate(g.dueDate, { day: "numeric", month: "short", year: "2-digit" })}</span>
                  <span className={cn("text-body", left < 30 ? "text-warning" : "text-muted-foreground")}>{left} days left</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
