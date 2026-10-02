"use client";

import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { URGENCY_LABEL, VIDEO_STAGE_LABEL, type VideoStageKey } from "@gm/shared";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCan, useMe, useTeam } from "./queries";

export const STAGE_TONE: Record<VideoStageKey, BadgeTone> = {
  planned: "neutral",
  scripting: "info",
  shoot_scheduled: "info",
  shot: "info",
  editing: "accent",
  internal_qc: "warning",
  client_review: "warning",
  revision: "danger",
  approved: "success",
  published: "success",
};

export function StageBadge({ stage }: { stage: VideoStageKey | string }) {
  const s = stage as VideoStageKey;
  return (
    <Badge tone={STAGE_TONE[s] ?? "neutral"} dot>
      {VIDEO_STAGE_LABEL[s] ?? stage}
    </Badge>
  );
}

const URGENCY_TONE = { rush: "danger", priority: "warning", standard: "neutral" } as const;
export function UrgencyBadge({ urgency }: { urgency: "rush" | "priority" | "standard" | string }) {
  const u = urgency as keyof typeof URGENCY_TONE;
  if (u === "standard") return null;
  return <Badge tone={URGENCY_TONE[u] ?? "neutral"}>{URGENCY_LABEL[u] ?? urgency}</Badge>;
}

export function VpBadge({ on }: { on: boolean }) {
  return on ? (
    <Badge tone="success" title="Footage backed up and verified">
      <ShieldCheck />
      VP
    </Badge>
  ) : null;
}

export const CONTENT_STAGE_LABEL = {
  idea: "Ideas",
  topic: "Topic list",
  research: "Research",
  script: "Scripting",
  approval: "With the client",
  ready: "Ready for shoot",
} as const;

/** Team members to pick for a video or shoot (people who can see the team), or just me. */
export function usePeople() {
  const me = useMe().data;
  const can = useCan();
  const team = useTeam(can("team", "view"));
  return team.data?.members.map((m) => ({ value: m.user.id, label: m.user.name })) ?? (me ? [{ value: me.user.id, label: me.user.name }] : []);
}

/** "2026-10" → "October 2026" */
export const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
export const thisMonth = () => new Date().toISOString().slice(0, 7);
export const shiftMonth = (m: string, by: number) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
};

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
      <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeft />
      </Button>
      <span className="min-w-32 text-center text-body font-medium">{monthLabel(month)}</span>
      <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => onChange(shiftMonth(month, 1))}>
        <ChevronRight />
      </Button>
    </div>
  );
}

/** "5h 30m" */
export const minutes = (n: number) => (n < 60 ? `${n}m` : `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ""}`);
