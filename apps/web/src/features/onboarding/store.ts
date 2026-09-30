"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { TODAY } from "@/lib/mock/core";
import { progress, windowState, withOverrides } from "./engine";
import { respondentById, respondents, type Reminder, type Respondent } from "./seed";
import { templates, type Answer, type Answers, type SectionWhen } from "./templates";

interface RespondentPatch {
  sentOn?: string;
  mode?: "link" | "assisted";
  reminders?: Reminder[];
  requiredDoneOn?: string;
  pillarsApproved?: boolean;
}

interface OnboardingState {
  answers: Record<string, Answers>;
  patches: Record<string, RespondentPatch>;
  whenOverrides: Record<string, SectionWhen>;
  windowDays: number;
  setAnswer: (respondentId: string, questionId: string, value: Answer) => void;
  send: (respondentId: string, mode: "link" | "assisted") => void;
  remind: (respondentId: string, channel: Reminder["channel"]) => void;
  patch: (respondentId: string, p: RespondentPatch) => void;
  setWhen: (templateId: string, sectionId: string, when: SectionWhen) => void;
  setWindowDays: (days: number) => void;
  reset: () => void;
}

const initial = { answers: {}, patches: {}, whenOverrides: {}, windowDays: 7 };

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initial,
      setAnswer: (rid, qid, value) =>
        set((s) => ({ answers: { ...s.answers, [rid]: { ...(s.answers[rid] ?? {}), [qid]: value } } })),
      send: (rid, mode) => set((s) => ({ patches: { ...s.patches, [rid]: { ...s.patches[rid], sentOn: TODAY, mode } } })),
      remind: (rid, channel) =>
        set((s) => {
          const base = s.patches[rid]?.reminders ?? respondentById(rid)?.reminders ?? [];
          return { patches: { ...s.patches, [rid]: { ...s.patches[rid], reminders: [...base, { day: -1, on: TODAY, channel }] } } };
        }),
      patch: (rid, p) => set((s) => ({ patches: { ...s.patches, [rid]: { ...s.patches[rid], ...p } } })),
      setWhen: (tid, sid, when) => set((s) => ({ whenOverrides: { ...s.whenOverrides, [`${tid}:${sid}`]: when } })),
      setWindowDays: (windowDays) => set({ windowDays }),
      reset: () => set(initial),
    }),
    { name: "gm-onboarding-v1", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

export interface LiveRespondent extends Respondent {
  pillarsApproved?: boolean;
}

/** Seed respondent merged with everything changed during the demo, plus derived progress. */
export function useRespondent(id: string) {
  const answersPatch = useOnboarding((s) => s.answers[id]);
  const p = useOnboarding((s) => s.patches[id]);
  const whenOverrides = useOnboarding((s) => s.whenOverrides);
  const windowDays = useOnboarding((s) => s.windowDays);
  return useMemo(() => {
    const seed = respondentById(id);
    if (!seed) return undefined;
    const r: LiveRespondent = {
      ...seed,
      answers: { ...seed.answers, ...answersPatch },
      sentOn: p?.sentOn ?? seed.sentOn,
      mode: p?.mode ?? seed.mode,
      reminders: p?.reminders ?? seed.reminders,
      pillarsApproved: p?.pillarsApproved,
    };
    const template = withOverrides(templates[r.template], whenOverrides);
    const prog = progress(template, r.answers);
    const win = windowState(r.sentOn, prog.later.complete, windowDays);
    return { r, template, prog, win, windowDays };
  }, [id, answersPatch, p, whenOverrides, windowDays]);
}

export const clientRespondents = respondents.filter((r) => r.template === "client");
