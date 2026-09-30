"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { agreements, TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { EDIT_STEPS, QC_CHECKS, type Video } from "@/lib/types";
import { addVideoToDemo } from "@/features/production/store";
import { cycleFor, nextVideoCode, PLANNED_MIN } from "@/features/production/lib";
import { seedContent, seedTopicLists, type ContentItem, type ContentStage, type ScriptVersion, type TopicList } from "./data";

type ScriptDraft = Pick<ScriptVersion, "hook" | "body" | "cta" | "onScreen">;

interface ContentState {
  items: ContentItem[];
  lists: TopicList[];
  addIdea: (idea: Pick<ContentItem, "clientId" | "title" | "pillar" | "format" | "source" | "ownerId">) => void;
  move: (id: string, stage: ContentStage) => void;
  setPick: (id: string, pick: ContentItem["pick"]) => void;
  sendList: (listId: string) => void;
  confirmList: (listId: string) => void;
  setNotes: (id: string, notes: string) => void;
  addLink: (id: string, link: { label: string; url: string }) => void;
  saveDraft: (id: string, draft: ScriptDraft, by: string) => void;
  sendScript: (id: string) => void;
  decide: (id: string, approve: boolean, note?: string) => string | undefined;
  reset: () => void;
}

const now = () => new Date().toISOString().slice(0, 16);
const uid = () => Math.random().toString(36).slice(2, 8);
const monthOf = (l: TopicList) => l.month;

/** Script approved → the deliverable enters Video Production (new video, or the linked one moves on). */
function handToProduction(item: ContentItem): string {
  const demo = useDemo.getState();
  if (item.videoCode) {
    const linked = demo.videos.find((v) => v.code === item.videoCode);
    if (linked && (linked.stage === "Planned" || linked.stage === "Scripting")) demo.setStage(linked.id, "Shoot Scheduled");
    return item.videoCode;
  }
  const agreement = agreements.find((a) => a.clientId === item.clientId)!;
  const due = item.due < TODAY ? TODAY : item.due;
  const code = nextVideoCode(demo.videos, item.clientId, due);
  const v: Video = {
    id: `v-ct-${uid()}`,
    code,
    title: item.title,
    clientId: item.clientId,
    agreementId: agreement.id,
    cycleId: cycleFor(agreement.id, due).id,
    format: item.format,
    aspect: item.format === "Long-form" ? "16:9" : item.format === "Ad" ? "4:5" : "9:16",
    urgency: "standard",
    stage: "Planned",
    clipNo: "—",
    videoProtection: false,
    editorId: "p-surya",
    directorId: "p-karthik",
    cameraId: "p-vignesh",
    dueDate: due,
    publishDate: due,
    plannedMinutes: PLANNED_MIN[item.format],
    loggedMinutes: 0,
    editSteps: Object.fromEntries(EDIT_STEPS.map((s) => [s, false])) as Video["editSteps"],
    qc: Object.fromEntries(QC_CHECKS.map((c) => [c, "pending"])),
    revisionsUsed: 0,
    versions: [],
    comments: [],
    platform: item.format === "Long-form" ? ["YouTube"] : ["Instagram", "YouTube Shorts"],
  };
  addVideoToDemo(v);
  return code;
}

export const useContent = create<ContentState>()(
  persist(
    (set, get) => ({
      items: seedContent,
      lists: seedTopicLists,
      addIdea: (idea) =>
        set((s) => ({
          items: [{ ...idea, id: `ct-${uid()}`, stage: "idea", month: "Oct 2026", due: "2026-10-10", notes: "", links: [], versions: [] }, ...s.items],
        })),
      move: (id, stage) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, stage } : i)) })),
      setPick: (id, pick) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, pick } : i)) })),
      sendList: (listId) => {
        const list = get().lists.find((l) => l.id === listId)!;
        set((s) => ({
          lists: s.lists.map((l) => (l.id === listId ? { ...l, status: "sent", sentOn: TODAY } : l)),
          items: s.items.map((i) => (i.clientId === list.clientId && i.month === monthOf(list) && i.stage === "idea" ? { ...i, stage: "topic" } : i)),
        }));
        useDemo.getState().log(`${monthOf(list)} topic list sent to client on WhatsApp`, "accent");
      },
      confirmList: (listId) => {
        const list = get().lists.find((l) => l.id === listId)!;
        set((s) => ({
          lists: s.lists.map((l) => (l.id === listId ? { ...l, status: "confirmed" } : l)),
          items: s.items.map((i) =>
            i.clientId === list.clientId && i.month === monthOf(list) && i.stage === "topic"
              ? i.pick === "picked"
                ? { ...i, stage: "research" }
                : { ...i, stage: "idea", pick: undefined }
              : i,
          ),
        }));
        useDemo.getState().log(`${monthOf(list)} topics confirmed — research started`, "success");
      },
      setNotes: (id, notes) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, notes } : i)) })),
      addLink: (id, link) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, links: [...i.links, link] } : i)) })),
      saveDraft: (id, draft, by) =>
        set((s) => ({
          items: s.items.map((i) => {
            if (i.id !== id) return i;
            const last = i.versions.at(-1);
            if (last?.status === "draft") return { ...i, stage: "script", versions: [...i.versions.slice(0, -1), { ...last, ...draft, at: now(), by }] };
            const next: ScriptVersion = { id: `sv-${uid()}`, label: `v${i.versions.length + 1}`, at: now(), by, status: "draft", ...draft };
            return { ...i, stage: "script", versions: [...i.versions, next] };
          }),
        })),
      sendScript: (id) => {
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, stage: "approval", sentOn: TODAY, versions: i.versions.map((v, k) => (k === i.versions.length - 1 ? { ...v, status: "sent" } : v)) } : i,
          ),
        }));
      },
      decide: (id, approve, note) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;
        const code = approve ? handToProduction(item) : undefined;
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? {
                  ...i,
                  stage: approve ? "ready" : "script",
                  videoCode: code ?? i.videoCode,
                  versions: i.versions.map((v, k) => (k === i.versions.length - 1 ? { ...v, status: approve ? "approved" : "changes", clientNote: note } : v)),
                }
              : i,
          ),
        }));
        useDemo.getState().log(approve ? `Script approved: “${item.title}” → ${code}` : `Changes requested on script “${item.title}”`, approve ? "success" : "warning");
        return code;
      },
      reset: () => set({ items: seedContent, lists: seedTopicLists }),
    }),
    { name: "gm-content-v1", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
