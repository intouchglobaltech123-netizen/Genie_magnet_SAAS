"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { kitItems, preShootItems, shoots } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import type { Shoot, Video } from "@/lib/types";
import { stageIdx } from "./lib";

export interface Tick {
  packed: boolean;
  shot: boolean;
  received: boolean;
}
export interface Sig {
  by: string;
  at: string;
}
export interface TimeLog {
  id: string;
  date: string;
  start: string;
  end: string;
  note: string;
}
export interface Incident {
  id: string;
  shootId: string;
  items: string[];
  note: string;
  at: string;
}
export interface CorrectiveTask {
  id: string;
  videoId: string;
  check: string;
  note: string;
  ownerId: string;
  at: string;
  done: boolean;
}

interface ProdState {
  kit: Record<string, Record<string, Tick>>;
  preShoot: Record<string, Record<string, boolean>>;
  shootSign: Record<string, { giver?: Sig; receiver?: Sig; client?: Sig & { dataUrl?: string } }>;
  shootStatus: Record<string, Shoot["status"]>;
  shootNotes: Record<string, string>;
  incidents: Incident[];
  timeLogs: Record<string, TimeLog[]>;
  signatures: Record<string, { editor?: Sig; hr?: Sig; gm?: Sig }>;
  qcNotes: Record<string, Record<string, string>>;
  corrective: CorrectiveTask[];
  backups: Record<string, Sig>;
  taskDone: Record<string, boolean>;
  approvedPlans: Record<string, { publish: string; at: string; assignees: Record<string, string> }>;

  setTick: (shootId: string, item: string, col: keyof Tick, value: boolean) => void;
  setColumn: (shootId: string, col: keyof Tick, value: boolean) => void;
  setPreShoot: (shootId: string, item: string, value: boolean) => void;
  signShoot: (shootId: string, who: "giver" | "receiver" | "client", sig: Sig & { dataUrl?: string }) => void;
  setShootStatus: (shootId: string, status: Shoot["status"]) => void;
  setShootNotes: (shootId: string, notes: string) => void;
  addIncident: (i: Omit<Incident, "id" | "at">) => void;
  addTimeLog: (videoId: string, base: TimeLog[], log: Omit<TimeLog, "id">) => void;
  signVideo: (videoId: string, who: "editor" | "hr" | "gm", sig: Sig) => void;
  setQcNote: (videoId: string, check: string, note: string) => void;
  addCorrective: (t: Omit<CorrectiveTask, "id" | "at" | "done">) => void;
  resolveCorrective: (videoId: string, check: string) => void;
  setBackup: (videoId: string, sig: Sig) => void;
  toggleTask: (taskId: string, value: boolean) => void;
  approvePlan: (videoId: string, publish: string, assignees: Record<string, string>) => void;
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();

// ───────────── Defaults derived from seed data (used until the user edits) ─────────────

export function defaultKit(shoot: Shoot): Record<string, Tick> {
  const items = kitItems[shoot.kit];
  return Object.fromEntries(
    items.map((it, i) => {
      let t: Tick = { packed: false, shot: false, received: false };
      if (shoot.status === "closed") t = { packed: true, shot: true, received: true };
      else if (shoot.status === "returned") t = { packed: true, shot: i !== 18, received: i < 14 };
      else if (shoot.status === "on-shoot") t = { packed: true, shot: i < 10, received: false };
      else if (shoot.status === "packed") t = { packed: true, shot: false, received: false };
      else if (shoot.id === "sh-04") t = { packed: i < 9, shot: false, received: false };
      return [it, t];
    }),
  );
}

export function defaultPreShoot(shoot: Shoot): Record<string, boolean> {
  const done = shoot.status !== "planned";
  return Object.fromEntries(preShootItems.map((p) => [p, done]));
}

export function defaultTimeLogs(v: Video): TimeLog[] {
  const logs: TimeLog[] = [];
  let left = v.loggedMinutes;
  const startDay = new Date(`${v.dueDate}T00:00:00`);
  let dayOffset = Math.ceil(left / 240) + 1;
  let i = 0;
  while (left > 0 && i < 8) {
    const chunk = Math.min(left, i % 2 ? 150 : 210);
    const d = new Date(startDay.getTime() - dayOffset * 86_400_000);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const startMin = i % 2 ? 14 * 60 : 10 * 60;
    const endMin = startMin + chunk;
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    logs.push({ id: `${v.id}-tl${i}`, date: iso, start: hhmm(startMin), end: hhmm(endMin), note: ["Rough cut & selects", "B-rolls + text", "Colour & BGM", "Fixes after review"][i % 4]! });
    left -= chunk;
    i++;
    if (i % 2 === 0) dayOffset--;
  }
  return logs;
}

export function defaultSignatures(v: Video): { editor?: Sig; hr?: Sig; gm?: Sig } {
  const idx = stageIdx(v.stage);
  const out: { editor?: Sig; hr?: Sig; gm?: Sig } = {};
  if (idx >= 5) out.editor = { by: "Editor", at: "2026-09-22T18:10:00" };
  if (idx >= 6) {
    out.hr = { by: "Harini Selvam", at: "2026-09-23T10:05:00" };
    out.gm = { by: "Ashwin", at: "2026-09-23T11:30:00" };
  }
  return out;
}

export const minutesBetween = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh! * 60 + em!) - (sh! * 60 + sm!));
};

export const useProduction = create<ProdState>()(
  persist(
    (set, get) => ({
      kit: {},
      preShoot: {},
      shootSign: {},
      shootStatus: {},
      shootNotes: {},
      incidents: [],
      timeLogs: {},
      signatures: {},
      qcNotes: {},
      corrective: [],
      backups: {},
      taskDone: {},
      approvedPlans: {},

      setTick: (shootId, item, col, value) => {
        const shoot = shoots.find((s) => s.id === shootId)!;
        const cur = get().kit[shootId] ?? defaultKit(shoot);
        set((s) => ({ kit: { ...s.kit, [shootId]: { ...cur, [item]: { ...cur[item]!, [col]: value } } } }));
      },
      setColumn: (shootId, col, value) => {
        const shoot = shoots.find((s) => s.id === shootId)!;
        const cur = get().kit[shootId] ?? defaultKit(shoot);
        const next = Object.fromEntries(Object.entries(cur).map(([k, t]) => [k, { ...t, [col]: value }]));
        set((s) => ({ kit: { ...s.kit, [shootId]: next } }));
      },
      setPreShoot: (shootId, item, value) => {
        const shoot = shoots.find((s) => s.id === shootId)!;
        const cur = get().preShoot[shootId] ?? defaultPreShoot(shoot);
        set((s) => ({ preShoot: { ...s.preShoot, [shootId]: { ...cur, [item]: value } } }));
      },
      signShoot: (shootId, who, sig) =>
        set((s) => ({ shootSign: { ...s.shootSign, [shootId]: { ...s.shootSign[shootId], [who]: sig } } })),
      setShootStatus: (shootId, status) => set((s) => ({ shootStatus: { ...s.shootStatus, [shootId]: status } })),
      setShootNotes: (shootId, notes) => set((s) => ({ shootNotes: { ...s.shootNotes, [shootId]: notes } })),
      addIncident: (i) => set((s) => ({ incidents: [{ ...i, id: uid("inc"), at: nowIso() }, ...s.incidents] })),
      addTimeLog: (videoId, base, log) =>
        set((s) => ({ timeLogs: { ...s.timeLogs, [videoId]: [...(s.timeLogs[videoId] ?? base), { ...log, id: uid("tl") }] } })),
      signVideo: (videoId, who, sig) =>
        set((s) => {
          const v = useDemo.getState().videos.find((x) => x.id === videoId);
          const base = s.signatures[videoId] ?? (v ? defaultSignatures(v) : {});
          return { signatures: { ...s.signatures, [videoId]: { ...base, [who]: sig } } };
        }),
      setQcNote: (videoId, check, note) =>
        set((s) => ({ qcNotes: { ...s.qcNotes, [videoId]: { ...s.qcNotes[videoId], [check]: note } } })),
      addCorrective: (t) =>
        set((s) => ({
          corrective: [
            { ...t, id: uid("ct"), at: nowIso(), done: false },
            ...s.corrective.filter((c) => !(c.videoId === t.videoId && c.check === t.check && !c.done)),
          ],
        })),
      resolveCorrective: (videoId, check) =>
        set((s) => ({ corrective: s.corrective.map((c) => (c.videoId === videoId && c.check === check ? { ...c, done: true } : c)) })),
      setBackup: (videoId, sig) => set((s) => ({ backups: { ...s.backups, [videoId]: sig } })),
      toggleTask: (taskId, value) => set((s) => ({ taskDone: { ...s.taskDone, [taskId]: value } })),
      approvePlan: (videoId, publish, assignees) =>
        set((s) => ({ approvedPlans: { ...s.approvedPlans, [videoId]: { publish, assignees, at: nowIso() } } })),
    }),
    { name: "gm-production-v1", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

/** Rehydrate the production store on the client (avoids SSR hydration mismatch). */
export function useProductionHydration() {
  useEffect(() => {
    if (!useProduction.persist.hasHydrated()) void useProduction.persist.rehydrate();
  }, []);
}

/** The shared demo store has no addVideo — inject into its list so every action (setStage, updateVideo…) works. */
export function addVideoToDemo(v: Video) {
  useDemo.setState((s) => ({ videos: [...s.videos, v] }));
  useDemo.getState().log(`${v.code} “${v.title}” created and scheduled`, "accent");
}

export function useShootStatus(shoot: Shoot) {
  return useProduction((s) => s.shootStatus[shoot.id]) ?? shoot.status;
}
