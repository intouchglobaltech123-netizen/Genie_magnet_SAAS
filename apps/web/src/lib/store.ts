"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { videos as seedVideos, leads as seedLeads } from "@/lib/mock/core";
import type { ClientComment, EditStep, Lead, Role, Video, VideoStage } from "@/lib/types";

export type RevisionKind = "agency-correction" | "included-revision" | "out-of-scope";

export interface ChangeRequest {
  id: string;
  videoId: string;
  kind: RevisionKind;
  summary: string;
  estimate?: number;
  dateImpactDays?: number;
  status: "open" | "awaiting-client" | "approved" | "rejected" | "done";
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  at: string;
  text: string;
  tone?: "accent" | "success" | "warning" | "danger";
}

interface DemoState {
  role: Role;
  setRole: (r: Role) => void;

  videos: Video[];
  updateVideo: (id: string, patch: Partial<Video>) => void;
  setStage: (id: string, stage: VideoStage) => void;
  toggleEditStep: (id: string, step: EditStep) => void;
  setQc: (id: string, check: string, value: "pass" | "fail" | "pending") => void;
  addComment: (id: string, c: Omit<ClientComment, "id" | "at" | "resolved">) => void;
  approveVersion: (id: string, versionId: string) => void;
  requestChanges: (id: string, versionId: string) => void;
  publishNewVersion: (id: string, notes: string) => void;

  changeRequests: ChangeRequest[];
  addChangeRequest: (cr: Omit<ChangeRequest, "id" | "createdAt">) => void;
  updateChangeRequest: (id: string, patch: Partial<ChangeRequest>) => void;

  leads: Lead[];
  moveLead: (id: string, stage: Lead["stage"]) => void;
  addLead: (l: Omit<Lead, "id" | "createdAt">) => void;

  activity: ActivityItem[];
  log: (text: string, tone?: ActivityItem["tone"]) => void;

  reset: () => void;
}

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

const seedCRs: ChangeRequest[] = [
  {
    id: "cr-001",
    videoId: "v-unr-1",
    kind: "out-of-scope",
    summary: "Add animated floor-plan graphics for all 3 tower types",
    estimate: 18000,
    dateImpactDays: 4,
    status: "awaiting-client",
    createdAt: "2026-09-20T12:00:00",
  },
  {
    id: "cr-002",
    videoId: "v-sls-1",
    kind: "included-revision",
    summary: "Swap background music to classical veena track; tighten intro by 3s",
    status: "open",
    createdAt: "2026-09-23T16:40:00",
  },
  {
    id: "cr-003",
    videoId: "v-kvr-5",
    kind: "agency-correction",
    summary: "Logo was placed on the wrong corner per brand guide — fix before QC",
    status: "done",
    createdAt: "2026-09-21T11:05:00",
  },
];

const seedActivity: ActivityItem[] = [
  { id: "a1", at: "2026-09-25T09:42:00", text: "Ramesh Gounder opened “Founder story — 3 generations of farming” v1 in the client portal", tone: "accent" },
  { id: "a2", at: "2026-09-25T09:15:00", text: "Vignesh Kumar checked in 14/21 items for Kaveri — Testimonial shoot kit", tone: "success" },
  { id: "a3", at: "2026-09-25T08:58:00", text: "Invoice GM/26-27/041 to Urban Nest Realty is 32 days overdue", tone: "danger" },
  { id: "a4", at: "2026-09-24T19:20:00", text: "Divya Lakshmi completed Colour corrections on KVR-0926-05", tone: "success" },
  { id: "a5", at: "2026-09-24T17:05:00", text: "Balaji Textiles requested 12% discount — needs founder approval", tone: "warning" },
  { id: "a6", at: "2026-09-24T12:30:00", text: "Naveen Raj — sick leave approved (25–26 Sep). 2 tasks need reassignment", tone: "warning" },
];

export const useDemo = create<DemoState>()(
  persist(
    (set, get) => ({
      role: "founder",
      setRole: (role) => set({ role }),

      videos: seedVideos,
      updateVideo: (id, patch) => set((s) => ({ videos: s.videos.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),
      setStage: (id, stage) => {
        const v = get().videos.find((x) => x.id === id);
        get().updateVideo(id, { stage });
        if (v) get().log(`${v.code} moved to ${stage}`, stage === "Approved" || stage === "Published" ? "success" : "accent");
      },
      toggleEditStep: (id, step) =>
        set((s) => ({
          videos: s.videos.map((v) => (v.id === id ? { ...v, editSteps: { ...v.editSteps, [step]: !v.editSteps[step] } } : v)),
        })),
      setQc: (id, check, value) =>
        set((s) => ({ videos: s.videos.map((v) => (v.id === id ? { ...v, qc: { ...v.qc, [check]: value } } : v)) })),
      addComment: (id, c) =>
        set((s) => ({
          videos: s.videos.map((v) =>
            v.id === id ? { ...v, comments: [...v.comments, { ...c, id: uid("cm"), at: now(), resolved: false }] } : v,
          ),
        })),
      approveVersion: (id, versionId) => {
        const v = get().videos.find((x) => x.id === id);
        set((s) => ({
          videos: s.videos.map((x) =>
            x.id === id
              ? { ...x, stage: "Approved", versions: x.versions.map((ver) => (ver.id === versionId ? { ...ver, status: "approved" } : ver)) }
              : x,
          ),
        }));
        if (v) get().log(`Client approved ${v.code} (${v.versions.find((x) => x.id === versionId)?.label})`, "success");
      },
      requestChanges: (id, versionId) => {
        const v = get().videos.find((x) => x.id === id);
        set((s) => ({
          videos: s.videos.map((x) =>
            x.id === id
              ? { ...x, stage: "Revision", versions: x.versions.map((ver) => (ver.id === versionId ? { ...ver, status: "changes-requested" } : ver)) }
              : x,
          ),
        }));
        if (v) get().log(`Client requested changes on ${v.code}`, "warning");
      },
      publishNewVersion: (id, notes) => {
        const v = get().videos.find((x) => x.id === id);
        if (!v) return;
        const label = `v${v.versions.length + 1}`;
        set((s) => ({
          videos: s.videos.map((x) =>
            x.id === id
              ? {
                  ...x,
                  stage: "Client Review",
                  revisionsUsed: x.versions.length >= 1 ? x.revisionsUsed + 1 : x.revisionsUsed,
                  versions: [
                    ...x.versions,
                    { id: uid("ver"), label, createdAt: now(), by: "Divya Lakshmi", duration: x.versions.at(-1)?.duration ?? "00:45", notes, status: "sent" },
                  ],
                }
              : x,
          ),
        }));
        get().log(`${v.code} ${label} sent to client for review`, "accent");
      },

      changeRequests: seedCRs,
      addChangeRequest: (cr) => {
        set((s) => ({ changeRequests: [{ ...cr, id: uid("cr"), createdAt: now() }, ...s.changeRequests] }));
        get().log(`Revision logged as ${cr.kind.replace(/-/g, " ")}`, cr.kind === "out-of-scope" ? "warning" : "accent");
      },
      updateChangeRequest: (id, patch) =>
        set((s) => ({ changeRequests: s.changeRequests.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

      leads: seedLeads,
      moveLead: (id, stage) => {
        const l = get().leads.find((x) => x.id === id);
        set((s) => ({ leads: s.leads.map((x) => (x.id === id ? { ...x, stage } : x)) }));
        if (l) get().log(`${l.company} moved to ${stage}`, stage === "Won" ? "success" : stage === "Lost" ? "danger" : "accent");
      },
      addLead: (l) => set((s) => ({ leads: [{ ...l, id: uid("l"), createdAt: now() }, ...s.leads] })),

      activity: seedActivity,
      log: (text, tone) => set((s) => ({ activity: [{ id: uid("act"), at: now(), text, tone }, ...s.activity].slice(0, 40) })),

      reset: () =>
        set({ videos: seedVideos, leads: seedLeads, changeRequests: seedCRs, activity: seedActivity }),
    }),
    {
      name: "gm-demo-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
