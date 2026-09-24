"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Verdict = "approve" | "change" | "remove";

export interface ModuleFeedback {
  verdict?: Verdict;
  note?: string;
  at?: string;
}

interface FeedbackState {
  items: Record<number, ModuleFeedback>;
  setVerdict: (no: number, verdict: Verdict | undefined) => void;
  setNote: (no: number, note: string) => void;
  clear: () => void;
}

export const useModuleFeedback = create<FeedbackState>()(
  persist(
    (set) => ({
      items: {},
      setVerdict: (no, verdict) =>
        set((s) => ({ items: { ...s.items, [no]: { ...s.items[no], verdict, at: new Date().toISOString() } } })),
      setNote: (no, note) => set((s) => ({ items: { ...s.items, [no]: { ...s.items[no], note } } })),
      clear: () => set({ items: {} }),
    }),
    { name: "gm-module-feedback-v1", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
