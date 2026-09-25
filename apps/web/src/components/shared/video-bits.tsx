import { Clock3, Flame, ShieldCheck, ShieldOff, Zap } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import type { CustomerCategory, Urgency, VideoStage } from "@/lib/types";
import { cn } from "@/lib/utils";

export const urgencyMeta: Record<Urgency, { label: string; icon: typeof Zap; cls: string; desc: string }> = {
  rush: { label: "Rush", icon: Zap, cls: "text-danger bg-danger-soft", desc: "Rush — deliver within 24–48h, jumps the queue" },
  priority: { label: "Priority", icon: Flame, cls: "text-warning bg-warning-soft", desc: "Priority — client-committed date, protect capacity" },
  standard: { label: "Standard", icon: Clock3, cls: "text-info bg-info-soft", desc: "Standard — normal cycle turnaround" },
};

export function UrgencyIcon({ urgency, withLabel }: { urgency: Urgency; withLabel?: boolean }) {
  const m = urgencyMeta[urgency];
  const Icon = m.icon;
  return (
    <Tooltip content={m.desc}>
      <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-body font-medium", m.cls)}>
        <Icon className="size-3.5" strokeWidth={2.4} />
        {withLabel && m.label}
      </span>
    </Tooltip>
  );
}

export function VPBadge({ on }: { on: boolean }) {
  return (
    <Tooltip content={on ? "Video Protection: raw footage backed up & verified" : "Video Protection pending — footage not yet backed up"}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-body font-semibold",
          on ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
        )}
      >
        {on ? <ShieldCheck className="size-3.5" /> : <ShieldOff className="size-3.5" />}
        VP
      </span>
    </Tooltip>
  );
}

export const stageTone: Record<VideoStage, BadgeTone> = {
  Planned: "neutral",
  Scripting: "outline",
  "Shoot Scheduled": "info",
  Shot: "info",
  Editing: "accent",
  "Internal QC": "gold",
  "Client Review": "warning",
  Revision: "danger",
  Approved: "success",
  Published: "success",
};

export function StageBadge({ stage }: { stage: VideoStage }) {
  return (
    <Badge tone={stageTone[stage]} dot>
      {stage}
    </Badge>
  );
}

export const categoryMeta: Record<CustomerCategory, { tone: BadgeTone; desc: string; letter: string }> = {
  Awesome: { tone: "success", letter: "A", desc: "Low effort, high return — nurture and ask for referrals" },
  Breadwinning: { tone: "accent", letter: "B", desc: "High effort, high return — protect and grow" },
  Convincing: { tone: "warning", letter: "C", desc: "Needs convincing — improve value or margin" },
  Dangerous: { tone: "danger", letter: "D", desc: "High effort, low return / payment risk — fix or exit" },
};

export function CategoryBadge({ category }: { category: CustomerCategory }) {
  const m = categoryMeta[category];
  return (
    <Tooltip content={m.desc}>
      <span>
        <Badge tone={m.tone}>
          <span className="font-bold">{m.letter}</span> {category}
        </Badge>
      </span>
    </Tooltip>
  );
}
