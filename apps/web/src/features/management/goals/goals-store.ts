"use client";

import { create } from "zustand";
import { GOALS, type CheckIn, type Goal, type GoalAudit } from "./goals-data";

interface GoalsState {
  goals: Goal[];
  openId: string | null;
  setOpen: (id: string | null) => void;
  updateGoal: (id: string, patch: Partial<Goal>, audit?: GoalAudit) => void;
  addCheckIn: (id: string, c: CheckIn) => void;
  addGoal: (g: Goal) => void;
}

export const useGoals = create<GoalsState>((set) => ({
  goals: GOALS,
  openId: null,
  setOpen: (openId) => set({ openId }),
  updateGoal: (id, patch, audit) =>
    set((s) => ({
      goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch, audit: audit ? [audit, ...g.audit] : g.audit } : g)),
    })),
  addCheckIn: (id, c) =>
    set((s) => ({
      goals: s.goals.map((g) => (g.id === id ? { ...g, checkIns: [c, ...g.checkIns] } : g)),
    })),
  addGoal: (g) => set((s) => ({ goals: [...s.goals, g] })),
}));
