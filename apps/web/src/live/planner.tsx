"use client";

import { useEffect, useState } from "react";
import { BarChart3, Brain, CalendarDays, CalendarPlus, Check, CloudOff, ListPlus, LoaderCircle, LockKeyhole, RotateCcw, Settings2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "zustand";
import type { PlannerData } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Answers } from "@/features/planner/calc";
import { LogTab } from "@/features/planner/log-tab";
import { ProfileTab } from "@/features/planner/profile-tab";
import { QuizTab } from "@/features/planner/quiz-tab";
import { SetupTab } from "@/features/planner/setup-tab";
import { createLivePlanner, PlannerStoreContext, type PlannerSaved, type PlannerState } from "@/features/planner/store";
import { MonthlyTab, WeeklyTab } from "@/features/planner/summary-tabs";
import { api, errorMessage } from "./api";
import { useMe, useMyPlanner } from "./queries";

/** This month, as yyyy-mm. */
const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const monthName = (month: string) =>
  new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/** A new planner: the person's name and this month, the rest for them to fill in. */
const fresh = (name: string, month: string): PlannerSaved => ({
  month,
  setup: { name, age: 30, monthlyIncome: 0, retireAge: 60, inflation: 7, expectedReturn: 12, postRetirementReturn: 6, monthlySip: 0 },
  log: [],
  answers: {},
  quizIndex: 0,
  completedAt: undefined,
  detoxJoined: false,
});

/** A saved planner; one kept before the month was recorded takes it from its log. */
const toSaved = (d: PlannerData, month: string): PlannerSaved => ({
  ...d,
  month: d.month ?? d.log[0]?.date.slice(0, 7) ?? month,
  answers: d.answers as Answers,
});

const toData = (s: PlannerState): PlannerData => ({
  month: s.month,
  setup: s.setup,
  log: s.log,
  answers: Object.fromEntries(Object.entries(s.answers).filter(([, v]) => v !== undefined)) as PlannerData["answers"],
  quizIndex: s.quizIndex,
  completedAt: s.completedAt,
  detoxJoined: s.detoxJoined,
});

/** The financial planner (P5-19): the person's own, saved as they go. */
export function LivePlanner() {
  const me = useMe().data;
  const q = useMyPlanner();
  return (
    <>
      <PageHeader
        title="My financial planner"
        description="Way To Fortune: where your money leaks, what it costs your retirement, and the money habits behind it."
      />
      {q.isPending || !me ? (
        <SkeletonRows rows={6} />
      ) : q.error ? (
        <Alert tone="danger">{errorMessage(q.error)}</Alert>
      ) : (
        <Planner saved={q.data} name={me.user.name} />
      )}
    </>
  );
}

type SaveState = "saved" | "saving" | "failed";

function Planner({ saved, name }: { saved: PlannerData | null; name: string }) {
  const [now] = useState(thisMonth);
  const [store] = useState(() => createLivePlanner(saved ? toSaved(saved, now) : fresh(name, now), fresh(name, now)));
  const month = useStore(store, (s) => s.month);
  const [starting, setStarting] = useState(false);
  const [tab, setTab] = useState("setup");
  const [state, setState] = useState<SaveState>("saved");
  const [resetting, setResetting] = useState(false);
  const qc = useQueryClient();

  // Each change is saved a moment after the last keystroke; anything still waiting is saved on leaving the page.
  useEffect(() => {
    let kept = JSON.stringify(toData(store.getState()));
    let pending: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = async () => {
      timer = undefined;
      const body = pending;
      pending = null;
      if (body === null || body === kept) return setState("saved");
      try {
        const data = JSON.parse(body) as PlannerData;
        await api("/planner", { method: "PUT", body: data });
        kept = body;
        qc.setQueryData(["planner"], data);
        if (pending === null) setState("saved");
      } catch (e) {
        setState("failed");
        toast.error("Your planner was not saved", { description: errorMessage(e) });
      }
    };
    const stop = store.subscribe((s) => {
      pending = JSON.stringify(toData(s));
      setState("saving");
      clearTimeout(timer);
      timer = setTimeout(save, 800);
    });
    const warn = (e: BeforeUnloadEvent) => {
      if (timer) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      stop();
      window.removeEventListener("beforeunload", warn);
      if (timer) {
        clearTimeout(timer);
        void save();
      }
    };
  }, [store, qc]);

  return (
    <PlannerStoreContext.Provider value={store}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
            <LockKeyhole className="size-3.5" />
          </span>
          <div className="text-body">
            <span className="font-medium">Private to you.</span>{" "}
            <span className="text-muted-foreground">
              Nobody else can open your planner, the owner included. It has its own permission, separate from the agency&apos;s finance, and nothing here feeds
              payroll or reports.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SaveBadge state={state} />
          <Button variant="ghost" size="sm" onClick={() => setResetting(true)}>
            <RotateCcw /> Start again
          </Button>
        </div>
      </div>

      {month < now && (
        <Alert tone="info" className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Your daily log is for {monthName(month)}. Start {monthName(now)} to log this month&apos;s spends.
            </span>
            <Button size="sm" variant="outline" onClick={() => setStarting(true)}>
              <CalendarPlus /> Start {monthName(now)}
            </Button>
          </div>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto scrollbar-thin">
          <TabsList>
            <TabsTrigger value="setup">
              <Settings2 /> My Setup
            </TabsTrigger>
            <TabsTrigger value="log">
              <ListPlus /> Daily Log
            </TabsTrigger>
            <TabsTrigger value="weekly">
              <CalendarDays /> Weekly Summary
            </TabsTrigger>
            <TabsTrigger value="monthly">
              <Trophy /> Monthly Report
            </TabsTrigger>
            <TabsTrigger value="quiz">
              <BarChart3 /> Money Diagnostic
            </TabsTrigger>
            <TabsTrigger value="profile">
              <Brain /> My Money Profile
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="setup">
          <SetupTab />
        </TabsContent>
        <TabsContent value="log">
          <LogTab />
        </TabsContent>
        <TabsContent value="weekly">
          <WeeklyTab />
        </TabsContent>
        <TabsContent value="monthly">
          <MonthlyTab />
        </TabsContent>
        <TabsContent value="quiz">
          <QuizTab onFinish={() => setTab("profile")} />
        </TabsContent>
        <TabsContent value="profile">
          <ProfileTab onStartQuiz={() => setTab("quiz")} />
        </TabsContent>
      </Tabs>

      <p className="mt-8 border-t border-border pt-4 text-body text-muted-foreground">Figures are educational estimates, not investment advice.</p>

      <Dialog open={starting} onOpenChange={setStarting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start {monthName(now)}?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-body text-muted-foreground">
              The daily log starts empty for {monthName(now)}; {monthName(month)}&apos;s spends are cleared. Your setup and diagnostic answers stay. Look over
              the monthly report first if you want to keep its figures.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStarting(false)}>
              Not yet
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                store.getState().startMonth(now);
                setStarting(false);
                setTab("log");
                toast.success(`${monthName(now)} started`);
              }}
            >
              Start {monthName(now)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetting} onOpenChange={setResetting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start your planner again?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-body text-muted-foreground">
              Your setup, every spend in the daily log and your diagnostic answers are cleared. This cannot be undone.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetting(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                store.getState().resetAll();
                setResetting(false);
                setTab("setup");
                toast("Planner cleared");
              }}
            >
              Clear everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PlannerStoreContext.Provider>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-body text-muted-foreground">
        <LoaderCircle className="size-3.5 animate-spin" /> Saving
      </span>
    );
  if (state === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-body text-danger">
        <CloudOff className="size-3.5" /> Not saved
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-body text-muted-foreground">
      <Check className="size-3.5" /> Saved
    </span>
  );
}
