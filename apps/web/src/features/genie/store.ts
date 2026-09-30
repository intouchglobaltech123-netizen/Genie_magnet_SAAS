"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type InsightStatus = "approved" | "dismissed";

interface GenieState {
  status: Record<string, InsightStatus>;
  edits: Record<string, string>;
  askOpen: boolean;
  setStatus: (id: string, s: InsightStatus) => void;
  edit: (id: string, text: string) => void;
  setAskOpen: (o: boolean) => void;
  reset: () => void;
}

export const useGenie = create<GenieState>()(
  persist(
    (set) => ({
      status: {},
      edits: {},
      askOpen: false,
      setStatus: (id, s) => set((st) => ({ status: { ...st.status, [id]: s } })),
      edit: (id, text) => set((st) => ({ edits: { ...st.edits, [id]: text } })),
      setAskOpen: (askOpen) => set({ askOpen }),
      reset: () => set({ status: {}, edits: {} }),
    }),
    {
      name: "gm-genie-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ status: s.status, edits: s.edits }),
    },
  ),
);
