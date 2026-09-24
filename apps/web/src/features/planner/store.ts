"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Answers, LogEntry, PlannerSetup } from "@/features/planner/calc";
import { demoLog, sampleAnswers, sampleSetup, workbookSampleLog, WORKBOOK_SAMPLE_SIP } from "@/lib/mock/planner";

interface PlannerState {
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

const uid = () => `e-${Math.random().toString(36).slice(2, 9)}`;

export const usePlanner = create<PlannerState>()(
  persist(
    (set) => ({
      setup: sampleSetup,
      updateSetup: (patch) => set((s) => ({ setup: { ...s.setup, ...patch } })),

      log: demoLog,
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

      answers: {},
      answer: (n, v) => set((s) => ({ answers: { ...s.answers, [n]: v } })),
      quizIndex: 0,
      setQuizIndex: (quizIndex) => set({ quizIndex }),
      applySampleAnswers: () => set({ answers: { ...sampleAnswers }, quizIndex: 53, completedAt: new Date().toISOString() }),
      resetQuiz: () => set({ answers: {}, quizIndex: 0, completedAt: undefined }),
      completedAt: undefined,

      detoxJoined: false,
      setDetoxJoined: (detoxJoined) => set({ detoxJoined }),

      resetAll: () =>
        set({ setup: sampleSetup, log: demoLog, answers: {}, quizIndex: 0, completedAt: undefined, detoxJoined: false }),
    }),
    {
      name: "gm-planner-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
