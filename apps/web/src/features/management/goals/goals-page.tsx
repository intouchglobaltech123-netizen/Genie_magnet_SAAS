"use client";

import * as React from "react";
import { Calculator, CalendarClock, Download, ListTree, Plus, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AspirationHero } from "./aspiration-hero";
import { ByOwner } from "./by-owner";
import { GoalDetailSheet } from "./goal-detail-sheet";
import { GoalTree } from "./goal-tree";
import { CADENCES, GOAL_DEPARTMENTS, GOAL_STATUS, GOAL_TYPES, fmtStamp, goalStatus, type Cadence, type Goal, type GoalStatus } from "./goals-data";
import { useGoals } from "./goals-store";
import { NewGoalDialog } from "./new-goal-dialog";
import { RevenueBreakdown } from "./revenue-breakdown";

export function GoalsPage() {
  const goals = useGoals((s) => s.goals);
  const [tab, setTab] = React.useState("tree");
  const [dept, setDept] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [newOpen, setNewOpen] = React.useState(false);

  const matches = React.useCallback(
    (g: Goal) =>
      (dept === "all" || g.department === dept) &&
      (type === "all" || g.type === type) &&
      (status === "all" || goalStatus(g) === status),
    [dept, type, status],
  );
  const filtered = goals.filter(matches);
  const filtering = dept !== "all" || type !== "all" || status !== "all";

  const counts: Record<GoalStatus, number> = { "on-track": 0, "at-risk": 0, "off-track": 0 };
  goals.forEach((g) => counts[goalStatus(g)]++);

  return (
    <div>
      <PageHeader
        eyebrow="Management · Module 37"
        depth="demo"
        title="Goals"
        description="S.M.A.R.T. goals from the Business Aspiration down to every person — actuals pulled from live records, reviewed in STOP cadences."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success("Goal sheet exported", { description: `goals-fy2026-27.xlsx · ${goals.length} goals with S.M.A.R.T. fields & check-ins` })}
            >
              <Download /> Export
            </Button>
            <Button variant="accent" size="sm" onClick={() => setNewOpen(true)}>
              <Plus /> New goal
            </Button>
          </>
        }
      />

      <AspirationHero />

      {/* Health + STOP cadence strip */}
      <div className="mt-4 grid gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.6fr)]">
        {(Object.keys(GOAL_STATUS) as GoalStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus((cur) => (cur === s ? "all" : s));
              if (tab === "revenue") setTab("tree");
            }}
            className={cn(
              "cursor-pointer rounded-2xl border bg-card p-4 text-left shadow-card transition hover:border-foreground/20",
              status === s ? "border-foreground/40 ring-2 ring-ring/15" : "border-border",
            )}
          >
            <div className="flex items-center gap-2 text-body text-muted-foreground">
              <span
                className={cn(
                  "size-2 rounded-full",
                  s === "on-track" ? "bg-success" : s === "at-risk" ? "bg-warning" : "bg-danger",
                )}
              />
              {GOAL_STATUS[s].label}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-heading font-semibold tracking-tight tabular">{counts[s]}</span>
              <span className="text-body text-muted-foreground">of {goals.length} goals</span>
            </div>
          </button>
        ))}
        <Card className="p-4">
          <div className="flex items-center gap-2 text-body text-muted-foreground">
            <CalendarClock className="size-3.5" /> Next STOP reviews
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(Object.keys(CADENCES) as Cadence[]).map((c) => (
              <div key={c}>
                <div className="text-body font-medium">{CADENCES[c].label}</div>
                <div className="text-body text-muted-foreground">
                  {CADENCES[c].every} · {c === "operational" ? "9:30 huddle" : fmtStamp(CADENCES[c].next)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="max-w-full self-start overflow-x-auto scrollbar-thin">
            <TabsTrigger value="tree">
              <ListTree /> Goal tree
            </TabsTrigger>
            <TabsTrigger value="revenue">
              <Calculator /> Revenue breakdown
            </TabsTrigger>
            <TabsTrigger value="owner">
              <UsersRound /> By owner
            </TabsTrigger>
          </TabsList>

          {tab !== "revenue" && (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={dept}
                onValueChange={setDept}
                className="h-8 w-[150px] text-body"
                options={[{ value: "all", label: "All departments" }, ...GOAL_DEPARTMENTS.map((d) => ({ value: d, label: d }))]}
              />
              <Select
                value={type}
                onValueChange={setType}
                className="h-8 w-[130px] text-body"
                options={[{ value: "all", label: "All types" }, ...Object.entries(GOAL_TYPES).map(([k, t]) => ({ value: k, label: t.label }))]}
              />
              <Select
                value={status}
                onValueChange={setStatus}
                className="h-8 w-[130px] text-body"
                options={[{ value: "all", label: "Any status" }, ...Object.entries(GOAL_STATUS).map(([k, s]) => ({ value: k, label: s.label }))]}
              />
              {filtering && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setDept("all");
                    setType("all");
                    setStatus("all");
                  }}
                >
                  <X /> Clear
                </Button>
              )}
            </div>
          )}
        </div>

        <TabsContent value="tree">
          <GoalTree goals={goals} matches={matches} />
          {filtering && (
            <p className="mt-2 text-body text-muted-foreground">
              {filtered.length} matching goals · parent goals are shown faded for context.
            </p>
          )}
        </TabsContent>
        <TabsContent value="revenue">
          <RevenueBreakdown />
        </TabsContent>
        <TabsContent value="owner">
          <ByOwner goals={filtered} />
        </TabsContent>
      </Tabs>

      <GoalDetailSheet />
      <NewGoalDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
