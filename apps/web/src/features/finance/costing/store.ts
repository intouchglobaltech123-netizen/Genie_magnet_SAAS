"use client";

import { create } from "zustand";
import { BASE_SCENARIO, type Scenario } from "./model";

interface CostingState {
  scenarioOn: boolean;
  scenario: Scenario;
  selectedId: string;
  setScenarioOn: (on: boolean) => void;
  patchScenario: (p: Partial<Scenario>) => void;
  resetScenario: () => void;
  select: (id: string) => void;
}

export const useCosting = create<CostingState>()((set) => ({
  scenarioOn: false,
  scenario: BASE_SCENARIO,
  selectedId: "v-kvr-4",
  setScenarioOn: (scenarioOn) => set({ scenarioOn }),
  patchScenario: (p) => set((s) => ({ scenario: { ...s.scenario, ...p } })),
  resetScenario: () => set({ scenario: BASE_SCENARIO }),
  select: (selectedId) => set({ selectedId }),
}));

/** The scenario actually applied to figures (base when scenario mode is off). */
export function useActiveScenario() {
  const on = useCosting((s) => s.scenarioOn);
  const sc = useCosting((s) => s.scenario);
  return on ? sc : BASE_SCENARIO;
}
