"use client";

import { createContext, useContext } from "react";
import { create, createStore, useStore, type StateCreator, type StoreApi } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Answers, LogEntry, PlannerSetup } from "@/features/planner/calc";
import { demoLog, sampleAnswers, sampleSetup, workbookSampleLog, WORKBOOK_SAMPLE_SIP } from "@/lib/mock/planner";

export interface PlannerState {
  /** The demo offers sample data; a person's own planner does not. */
  demo: boolean;

  /** The month the daily log is for (yyyy-mm). */
  month: string;
  /** Opens a new month: the log starts empty. */
  startMonth: (month: string) => void;

  setup: PlannerSetup;
  updateSetup: (patch: Partial<PlannerSetup>) => void;

  log: LogEntry[];
  addEntry: (e: Omit<LogEntry, "id">) => void;
  updateEntry: (id: string, patch: Partial<LogEntry>) => void;
  removeEntry: (id: string) => void;
  loadLog: (which: "demo" | "workbook" | "empty") => void;

  answers: Answers;
  answer: (n: number, v: number) => void;
  quizIndex: number;
  setQuizIndex: (i: number) => void;
  applySampleAnswers: () => void;
  resetQuiz: () => void;
  completedAt?: string;

  detoxJoined: boolean;
  setDetoxJoined: (v: boolean) => void;

  resetAll: () => void;
}

/** What is kept of a planner: the state without its actions. */
export type PlannerSaved = Pick<PlannerState, "month" | "setup" | "log" | "answers" | "quizIndex" | "completedAt" | "detoxJoined">;

const uid = () => `e-${Math.random().toString(36).slice(2, 9)}`;

/** The planner's state and actions, starting from `start`; "reset" goes back to `fresh`. */
function plannerState(demo: boolean, start: PlannerSaved, fresh: PlannerSaved): StateCreator<PlannerState> {
  return (set) => ({
    demo,
    ...start,
    startMonth: (month) => set({ month, log: [] }),
    updateSetup: (patch) => set((s) => ({ setup: { ...s.setup, ...patch } })),

    addEntry: (e) => set((s) => ({ log: [...s.log, { ...e, id: uid() }] })),
    updateEntry: (id, patch) => set((s) => ({ log: s.log.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
    removeEntry: (id) => set((s) => ({ log: s.log.filter((e) => e.id !== id) })),
    loadLog: (which) =>
      set((s) => ({
        log: which === "demo" ? demoLog : which === "workbook" ? workbookSampleLog : [],
        setup:
          which === "workbook"
            ? { ...s.setup, monthlySip: WORKBOOK_SAMPLE_SIP }
            : which === "demo"
              ? { ...s.setup, monthlySip: sampleSetup.monthlySip }
              : s.setup,
      })),

    answer: (n, v) => set((s) => ({ answers: { ...s.answers, [n]: v } })),
    setQuizIndex: (quizIndex) => set({ quizIndex }),
    applySampleAnswers: () => set({ answers: { ...sampleAnswers }, quizIndex: 53, completedAt: new Date().toISOString() }),
    resetQuiz: () => set({ answers: {}, quizIndex: 0, completedAt: undefined }),

    setDetoxJoined: (detoxJoined) => set({ detoxJoined }),

    resetAll: () => set({ ...fresh, completedAt: undefined }),
  });
}

const DEMO: PlannerSaved = { month: "2026-09", setup: sampleSetup, log: demoLog, answers: {}, quizIndex: 0, completedAt: undefined, detoxJoined: false };

/** The demo planner, kept in this browser. */
export const demoPlanner = create<PlannerState>()(
  persist(plannerState(true, DEMO, DEMO), {
    name: "gm-planner-v1",
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  }),
);

/** A person's own planner, filled from the server; `fresh` is what "reset" returns to. */
export function createLivePlanner(start: PlannerSaved, fresh: PlannerSaved): StoreApi<PlannerState> {
  return createStore<PlannerState>()(plannerState(false, start, fresh));
}

/** The planner the screens below read: a person's own when provided, the demo otherwise. */
export const PlannerStoreContext = createContext<StoreApi<PlannerState> | null>(null);

export function usePlanner<T>(selector: (s: PlannerState) => T): T {
  const live = useContext(PlannerStoreContext);
  return useStore(live ?? demoPlanner, selector);
}
