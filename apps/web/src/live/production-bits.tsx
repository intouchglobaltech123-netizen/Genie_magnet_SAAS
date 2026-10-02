"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { URGENCY_LABEL, VIDEO_STAGE_LABEL, type VideoStageKey } from "@gm/shared";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate } from "./format";
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

export interface TimeLogRow {
  id: string;
  date: string;
  minutes: number;
  note: string | null;
  by: { id: string; name: string | null } | null;
}

/** "1:30" or "1.5" hours as minutes; 0 when unclear. */
export function hoursToMinutes(text: string) {
  const [h, m] = text.includes(":") ? text.split(":").map(Number) : [Number(text), 0];
  const n = Math.round((h ?? 0) * 60 + (m ?? 0));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Logging time (hours or h:mm, with what was done) and the entries so far — on a video or a shoot. */
export function TimeLog({
  logs,
  canEdit,
  defaultDate,
  onLog,
  onRemove,
}: {
  logs: TimeLogRow[];
  canEdit: boolean;
  defaultDate?: string;
  onLog: (entry: { date: string; minutes: number; note?: string }, done: () => void) => void;
  onRemove: (id: string) => void;
}) {
  const [log, setLog] = useState(() => ({ date: defaultDate ?? new Date().toISOString().slice(0, 10), hours: "", note: "" }));
  return (
    <>
      {canEdit && (
        <div className="mb-3 grid gap-2 sm:grid-cols-[140px_90px_1fr_auto]">
          <Input type="date" aria-label="Date" value={log.date} onChange={(e) => setLog({ ...log, date: e.target.value })} />
          <Input aria-label="Hours" placeholder="h:mm" value={log.hours} onChange={(e) => setLog({ ...log, hours: e.target.value })} />
          <Input aria-label="What" placeholder="What was done" value={log.note} onChange={(e) => setLog({ ...log, note: e.target.value })} />
          <Button
            variant="secondary"
            disabled={!log.hours}
            onClick={() => {
              const mins = hoursToMinutes(log.hours);
              if (!mins) return toast.error("Enter the time as hours or h:mm");
              onLog({ date: log.date, minutes: mins, note: log.note || undefined }, () => setLog({ ...log, hours: "", note: "" }));
            }}
          >
            <Clock />
            Log
          </Button>
        </div>
      )}
      {logs.length ? (
        <ul className="divide-y divide-border-subtle text-body">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 py-1.5">
              <span>
                {fmtDate(l.date)} · {minutes(l.minutes)} · {l.by?.name ?? "—"}
                {l.note && <span className="text-muted-foreground"> — {l.note}</span>}
              </span>
              {canEdit && (
                <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => onRemove(l.id)}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-muted-foreground">No time logged yet.</p>
      )}
    </>
  );
}
