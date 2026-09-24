"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { emptySheet, seedSheets, sheetKey, type DaySheet, type SheetRow } from "./daily-sheet/seed";
import { stampFor } from "./daily-sheet/time";

const uid = () => `sr-${Math.random().toString(36).slice(2, 9)}`;

interface DailyState {
  sheets: Record<string, DaySheet>;
  addRow: (personId: string, date: string, preset?: Partial<SheetRow>) => void;
  updateRow: (personId: string, date: string, rowId: string, patch: Partial<SheetRow>) => void;
  removeRow: (personId: string, date: string, rowId: string) => void;
  setCounter: (personId: string, date: string, key: string, value: number) => void;
  setField: (personId: string, date: string, patch: Partial<Pick<DaySheet, "otherWorks" | "dayReason" | "gmNote">>) => void;
  carryForward: (personId: string, date: string, fromDate: string) => number;
  submit: (personId: string, date: string) => void;
  signGm: (personId: string, date: string) => void;
  signHr: (personId: string, date: string) => void;
  reopen: (personId: string, date: string) => void;
  reset: () => void;
}

export const newRow = (preset?: Partial<SheetRow>): SheetRow => ({
  id: uid(),
  task: "",
  details: "",
  duration: "",
  start: "",
  end: "",
  status: "Pending",
  delayReason: "",
  productive: true,
  ...preset,
});

export const useDaily = create<DailyState>()(
  persist(
    (set, get) => {
      const mutate = (personId: string, date: string, fn: (s: DaySheet) => DaySheet) =>
        set((st) => {
          const k = sheetKey(personId, date);
          return { sheets: { ...st.sheets, [k]: fn(st.sheets[k] ?? emptySheet()) } };
        });
      return {
        sheets: seedSheets,
        addRow: (p, d, preset) => {
          const cur = get().sheets[sheetKey(p, d)];
          const last = cur?.rows.at(-1);
          mutate(p, d, (s) => ({ ...s, rows: [...s.rows, newRow({ start: last?.end ?? "09:30", ...preset })] }));
        },
        updateRow: (p, d, id, patch) => mutate(p, d, (s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
        removeRow: (p, d, id) => mutate(p, d, (s) => ({ ...s, rows: s.rows.filter((r) => r.id !== id) })),
        setCounter: (p, d, key, value) => mutate(p, d, (s) => ({ ...s, counters: { ...s.counters, [key]: Math.max(0, value) } })),
        setField: (p, d, patch) => mutate(p, d, (s) => ({ ...s, ...patch })),
        carryForward: (p, d, from) => {
          const src = get().sheets[sheetKey(p, from)];
          const pending = src?.rows.filter((r) => r.status === "Pending") ?? [];
          let start = 9 * 60 + 30;
          const rows = pending.map((r) => {
            const s = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
            start += 60;
            return newRow({ videoId: r.videoId, task: r.task, details: `Carried forward — ${r.details}`, duration: r.duration, start: s, end: "" });
          });
          mutate(p, d, (s) => ({ ...s, rows: [...s.rows, ...(rows.length ? rows : [newRow({ start: "09:30" })])] }));
          return rows.length;
        },
        submit: (p, d) => mutate(p, d, (s) => ({ ...s, submittedAt: stampFor(d) })),
        signGm: (p, d) => mutate(p, d, (s) => ({ ...s, gmSignedAt: stampFor(d) })),
        signHr: (p, d) => mutate(p, d, (s) => ({ ...s, hrSignedAt: stampFor(d) })),
        reopen: (p, d) => mutate(p, d, (s) => ({ ...s, submittedAt: undefined, gmSignedAt: undefined, hrSignedAt: undefined })),
        reset: () => set({ sheets: seedSheets }),
      };
    },
    {
      name: "gm-daily-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
