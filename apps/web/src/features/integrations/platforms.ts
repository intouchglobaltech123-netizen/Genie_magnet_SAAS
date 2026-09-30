"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { TODAY } from "@/lib/mock/core";

// "Add a platform" — any social network is a connector behind one interface (publish, schedule, insights).
export type PlatformId = "instagram" | "facebook" | "youtube" | "linkedin" | "x" | "threads" | "pinterest" | "gbp";

export interface PlatformDef {
  id: PlatformId;
  name: string;
  abbr: string;
  color: string;
  provider: string;
  supports: string[];
  /** When the real connector ships (development plan). */
  phase: string;
  available: boolean;
}

export const PLATFORMS: PlatformDef[] = [
  { id: "instagram", name: "Instagram", abbr: "IG", color: "#D62976", provider: "Meta", supports: ["Reels", "Posts", "Stories", "Insights"], phase: "Phase 3", available: true },
  { id: "facebook", name: "Facebook Page", abbr: "f", color: "#1877F2", provider: "Meta", supports: ["Videos", "Posts", "Insights"], phase: "Phase 3", available: true },
  { id: "youtube", name: "YouTube", abbr: "YT", color: "#E62117", provider: "Google", supports: ["Videos", "Shorts", "Insights"], phase: "Phase 3", available: true },
  { id: "linkedin", name: "LinkedIn", abbr: "in", color: "#0A66C2", provider: "LinkedIn", supports: ["Videos", "Posts", "Page insights"], phase: "Phase 5", available: true },
  { id: "x", name: "X (Twitter)", abbr: "X", color: "#111111", provider: "X", supports: ["Posts", "Videos"], phase: "Phase 5", available: true },
  { id: "threads", name: "Threads", abbr: "@", color: "#1F1F1F", provider: "Meta", supports: ["Posts"], phase: "Phase 7", available: false },
  { id: "pinterest", name: "Pinterest", abbr: "P", color: "#E60023", provider: "Pinterest", supports: ["Pins", "Idea pins"], phase: "Phase 7", available: false },
  { id: "gbp", name: "Google Business Profile", abbr: "G", color: "#1E8E3E", provider: "Google", supports: ["Posts", "Reviews"], phase: "Phase 7", available: false },
];

export const platformById = (id: PlatformId) => PLATFORMS.find((p) => p.id === id)!;

/** Maps the free-text platform labels on videos ("YouTube Shorts") to connectors. */
export function platformForLabel(label: string): PlatformDef | undefined {
  const l = label.toLowerCase();
  if (l.includes("insta")) return platformById("instagram");
  if (l.includes("youtube")) return platformById("youtube");
  if (l.includes("face")) return platformById("facebook");
  if (l.includes("linked")) return platformById("linkedin");
  return undefined;
}

export interface Connection {
  id: string;
  clientId: string;
  platform: PlatformId;
  handle: string;
  status: "connected" | "expiring" | "error";
  since: string;
  note?: string;
}

const seed: Connection[] = [
  { id: "cn-1", clientId: "c-kaveri", platform: "instagram", handle: "@kaveriorganics", status: "connected", since: "2025-04-05" },
  { id: "cn-2", clientId: "c-kaveri", platform: "facebook", handle: "Kaveri Organics", status: "connected", since: "2025-04-05" },
  { id: "cn-3", clientId: "c-kaveri", platform: "youtube", handle: "@kaveriorganics", status: "connected", since: "2025-04-07" },
  { id: "cn-4", clientId: "c-lakshmi", platform: "instagram", handle: "@srilakshmisilks", status: "connected", since: "2025-09-03" },
  { id: "cn-5", clientId: "c-lakshmi", platform: "facebook", handle: "Sri Lakshmi Silks", status: "connected", since: "2025-09-03" },
  { id: "cn-6", clientId: "c-lakshmi", platform: "youtube", handle: "@srilakshmisilks", status: "expiring", since: "2025-10-01", note: "Access expires in 5 days — ask Meenakshi to reconnect" },
  { id: "cn-7", clientId: "c-nova", platform: "instagram", handle: "@novadental.cbe", status: "connected", since: "2026-02-03" },
  { id: "cn-8", clientId: "c-urban", platform: "youtube", handle: "@urbannestrealty", status: "connected", since: "2026-06-02" },
  { id: "cn-9", clientId: "c-urban", platform: "instagram", handle: "@urbannestrealty", status: "error", since: "2026-06-02", note: "Client removed our partner access on 18 Sep — posting paused" },
];

/** Clients whose partner agency posts for them — we only deliver files. */
export const POSTS_OWN_CHANNELS: Record<string, string> = {
  "c-bright": "Partner agency handles posting — we deliver final files only",
};

interface IntegrationsState {
  connections: Connection[];
  connect: (clientId: string, platform: PlatformId, handle: string) => void;
  reconnect: (id: string) => void;
  disconnect: (id: string) => void;
  reset: () => void;
}

export const useIntegrations = create<IntegrationsState>()(
  persist(
    (set) => ({
      connections: seed,
      connect: (clientId, platform, handle) =>
        set((s) => ({
          connections: [
            ...s.connections.filter((c) => !(c.clientId === clientId && c.platform === platform)),
            { id: `cn-${Math.random().toString(36).slice(2, 7)}`, clientId, platform, handle, status: "connected", since: TODAY },
          ],
        })),
      reconnect: (id) => set((s) => ({ connections: s.connections.map((c) => (c.id === id ? { ...c, status: "connected", note: undefined, since: TODAY } : c)) })),
      disconnect: (id) => set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),
      reset: () => set({ connections: seed }),
    }),
    { name: "gm-integrations-v1", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
