"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { TODAY } from "@/lib/mock/core";
import {
  auditSeed,
  cadences,
  competenceSeed,
  creationSeed,
  meetings as seedMeetings,
  notesSeed,
  recognitionSeed,
  seedCommitments,
  standupSeed,
  type AgendaItem,
  type CadenceId,
  type Commitment,
  type CompetenceItem,
  type CreationGoal,
  type Meeting,
  type Recognition,
  type StandupEntry,
} from "@/lib/mock/management";
import { useDemo } from "@/lib/store";

export interface AuditEntry {
  at: string;
  by: string;
  reason: string;
  text: string;
}

export interface MeetingState {
  step: number;
  notes: Record<number, string>;
  attendance: Record<string, "present" | "late" | "absent" | undefined>;
  competence: CompetenceItem[];
  recognitions: Recognition[];
  creation: CreationGoal[];
  audit: AuditEntry[];
  snapshotAt?: string;
}

interface MgmtState {
  meetings: Meeting[];
  commitments: Commitment[];
  ws: Record<string, MeetingState>;
  agendas: Record<CadenceId, AgendaItem[]>;
  standups: StandupEntry[];

  getWs: (id: string) => MeetingState;
  patchWs: (id: string, patch: Partial<MeetingState>) => void;
  setNote: (id: string, step: number, text: string) => void;
  checkIn: (id: string, personId: string, v: "present" | "late" | "absent" | undefined) => void;

  addCommitment: (c: Omit<Commitment, "id" | "createdAt" | "status" | "carried">) => void;
  markCommitment: (id: string, mark: "BT" | "BD" | undefined, note?: string) => void;
  setDone: (id: string, done: boolean) => void;
  createTask: (id: string) => void;

  lockMeeting: (id: string, by: string) => { carried: number };
  addCorrection: (id: string, entry: Omit<AuditEntry, "at">) => void;
  scheduleMeeting: (m: Omit<Meeting, "id" | "status">) => void;

  setAgenda: (cadence: CadenceId, items: AgendaItem[]) => void;
  updateStandup: (personId: string, patch: Partial<StandupEntry>) => void;
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 7)}`;
const nowIso = () => `${TODAY}T${new Date().toTimeString().slice(0, 8)}`;

function initialWs(id: string): MeetingState {
  const m = seedMeetings.find((x) => x.id === id);
  const locked = m?.status === "locked";
  const attendance: MeetingState["attendance"] = {};
  if (m && locked)
    m.attendeeIds.forEach((p, i) => (attendance[p] = i === m.attendeeIds.length - 1 && (m.stats?.attended ?? 0) < m.attendeeIds.length ? "absent" : "present"));
  return {
    step: 0,
    notes: { ...(notesSeed[id] ?? {}) },
    attendance,
    competence: competenceSeed[id] ?? [],
    recognitions: recognitionSeed[id] ?? [],
    creation: creationSeed[id] ?? [],
    audit: auditSeed[id] ?? [],
    snapshotAt: locked ? m?.lockedAt : undefined,
  };
}

export const useMgmt = create<MgmtState>()((set, get) => ({
  meetings: seedMeetings,
  commitments: seedCommitments,
  ws: {},
  agendas: Object.fromEntries(cadences.map((c) => [c.id, c.agenda])) as Record<CadenceId, AgendaItem[]>,
  standups: standupSeed,

  getWs: (id) => get().ws[id] ?? initialWs(id),
  patchWs: (id, patch) => set((s) => ({ ws: { ...s.ws, [id]: { ...(s.ws[id] ?? initialWs(id)), ...patch } } })),
  setNote: (id, step, text) => {
    const cur = get().getWs(id);
    get().patchWs(id, { notes: { ...cur.notes, [step]: text } });
  },
  checkIn: (id, personId, v) => {
    const cur = get().getWs(id);
    get().patchWs(id, { attendance: { ...cur.attendance, [personId]: v } });
  },

  addCommitment: (c) => {
    set((s) => ({ commitments: [{ ...c, id: uid("cm"), createdAt: TODAY, status: "open", carried: 0 }, ...s.commitments] }));
    useDemo.getState().log(`Commitment added: “${c.text}”`, "accent");
  },
  markCommitment: (id, mark, note) =>
    set((s) => ({
      commitments: s.commitments.map((c) =>
        c.id === id ? { ...c, mark, markNote: note ?? c.markNote, status: mark === "BT" ? "done" : mark === undefined ? c.status : "open" } : c,
      ),
    })),
  setDone: (id, done) => {
    const c = get().commitments.find((x) => x.id === id);
    set((s) => ({ commitments: s.commitments.map((x) => (x.id === id ? { ...x, status: done ? "done" : "open" } : x)) }));
    if (c && done) useDemo.getState().log(`Commitment completed: “${c.text}”`, "success");
  },
  createTask: (id) => set((s) => ({ commitments: s.commitments.map((c) => (c.id === id ? { ...c, taskCreated: true } : c)) })),

  lockMeeting: (id, by) => {
    const meeting = get().meetings.find((m) => m.id === id)!;
    const nextSame = get()
      .meetings.filter((m) => m.cadence === meeting.cadence && m.date > meeting.date)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const unresolved = get().commitments.filter((c) => c.reviewInMeetingId === id && c.status !== "done");
    const at = nowIso();
    set((s) => ({
      meetings: s.meetings.map((m) =>
        m.id === id
          ? {
              ...m,
              status: "locked",
              lockedAt: at,
              lockedBy: by,
              stats: {
                attended: Object.values(get().getWs(id).attendance).filter((a) => a === "present" || a === "late").length,
                decisions: s.commitments.filter((c) => c.sourceMeetingId === id).length,
                bt: s.commitments.filter((c) => c.reviewInMeetingId === id && c.mark === "BT").length,
                bd: s.commitments.filter((c) => c.reviewInMeetingId === id && c.mark === "BD").length,
              },
            }
          : m,
      ),
      commitments: s.commitments.map((c) =>
        c.reviewInMeetingId === id && c.status !== "done"
          ? { ...c, carried: c.carried + 1, reviewInMeetingId: nextSame?.id ?? "rv-s8", reviewedIn: [...(c.reviewedIn ?? []), id], mark: c.mark ?? "BD" }
          : c,
      ),
    }));
    get().patchWs(id, { snapshotAt: at });
    useDemo.getState().log(`${meeting.title} locked by ${by} · ${unresolved.length} commitments carried forward`, "success");
    return { carried: unresolved.length };
  },
  addCorrection: (id, entry) => {
    const cur = get().getWs(id);
    get().patchWs(id, { audit: [{ ...entry, at: nowIso() }, ...cur.audit] });
    useDemo.getState().log(`Post-lock correction on review record — reason: ${entry.reason}`, "warning");
  },
  scheduleMeeting: (m) => set((s) => ({ meetings: [...s.meetings, { ...m, id: uid("rv"), status: "scheduled" }] })),

  setAgenda: (cadence, items) => set((s) => ({ agendas: { ...s.agendas, [cadence]: items } })),
  updateStandup: (personId, patch) =>
    set((s) => ({ standups: s.standups.map((x) => (x.personId === personId ? { ...x, ...patch } : x)) })),
}));

export function commitmentState(c: Commitment) {
  if (c.status === "done") return "done" as const;
  if (c.due < TODAY) return "overdue" as const;
  return "open" as const;
}

export function isEscalated(c: Commitment) {
  if (c.status === "done") return false;
  const overdueDays = (new Date(TODAY).getTime() - new Date(c.due).getTime()) / 86_400_000;
  return c.carried >= 2 || overdueDays > 7;
}

/** Stable workspace state for a meeting (falls back to seeded state until first edit). */
export function useWs(id: string) {
  const w = useMgmt((s) => s.ws[id]);
  return useMemo(() => w ?? initialWs(id), [w, id]);
}
