"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_QUESTIONS, seedSessions, type RTAnswer, type RTSession } from "./data";

interface RTState {
  sessions: RTSession[];
  create: (s: Pick<RTSession, "name" | "reviewTitle" | "participantIds" | "questions" | "secondsPerPerson" | "date">) => string;
  update: (id: string, patch: Partial<RTSession>) => void;
  start: (id: string) => void;
  submit: (id: string, a: Omit<RTAnswer, "id" | "hidden">) => void;
  next: (id: string) => void;
  toggleHidden: (id: string, answerId: string, reason?: string) => void;
  release: (id: string) => void;
  commit: (id: string, personId: string, text: string) => void;
  resetAll: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 9);

const patchSession = (sessions: RTSession[], id: string, fn: (s: RTSession) => RTSession) =>
  sessions.map((s) => (s.id === id ? fn(s) : s));

export const useRT = create<RTState>()(
  persist(
    (set) => ({
      sessions: seedSessions,
      create: (s) => {
        const id = `rt-${uid()}`;
        set((st) => ({
          sessions: [
            {
              ...s,
              id,
              facilitatorId: "p-ashwin",
              status: "draft",
              currentIndex: 0,
              answers: [],
              commitments: {},
              questions: s.questions ?? DEFAULT_QUESTIONS,
            },
            ...st.sessions,
          ],
        }));
        return id;
      },
      update: (id, patch) => set((st) => ({ sessions: patchSession(st.sessions, id, (s) => ({ ...s, ...patch })) })),
      start: (id) =>
        set((st) => ({ sessions: patchSession(st.sessions, id, (s) => ({ ...s, status: "live", currentIndex: 0, answers: [] })) })),
      submit: (id, a) =>
        set((st) => ({
          sessions: patchSession(st.sessions, id, (s) =>
            s.answers.some((x) => x.subjectId === a.subjectId && x.authorId === a.authorId)
              ? s
              : { ...s, answers: [...s.answers, { ...a, id: uid(), hidden: false }] },
          ),
        })),
      next: (id) =>
        set((st) => ({
          sessions: patchSession(st.sessions, id, (s) => {
            const nextIndex = s.currentIndex + 1;
            return nextIndex >= s.participantIds.length
              ? { ...s, currentIndex: nextIndex, status: "moderation" }
              : { ...s, currentIndex: nextIndex };
          }),
        })),
      toggleHidden: (id, answerId, reason) =>
        set((st) => ({
          sessions: patchSession(st.sessions, id, (s) => ({
            ...s,
            answers: s.answers.map((a) => (a.id === answerId ? { ...a, hidden: !a.hidden, hiddenReason: a.hidden ? undefined : reason } : a)),
          })),
        })),
      release: (id) =>
        set((st) => ({ sessions: patchSession(st.sessions, id, (s) => ({ ...s, status: "released", releasedAt: new Date().toISOString() })) })),
      commit: (id, personId, text) =>
        set((st) => ({ sessions: patchSession(st.sessions, id, (s) => ({ ...s, commitments: { ...s.commitments, [personId]: text } })) })),
      resetAll: () => set({ sessions: seedSessions }),
    }),
    { name: "gm-roundtable-v1", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
