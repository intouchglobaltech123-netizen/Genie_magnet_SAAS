"use client";

import { CalendarClock, MoreHorizontal, MoveRight, PanelRightOpen } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { daysBetween, personById, TODAY } from "@/lib/mock/core";
import { LEAD_STAGES } from "@/lib/mock/crm";
import type { Lead } from "@/lib/types";
import { cn, fmtDate, inrCompact } from "@/lib/utils";

export const sourceTone: Record<Lead["source"], BadgeTone> = {
  Website: "info",
  "Meta Ads": "accent",
  "Google Ads": "info",
  WhatsApp: "success",
  Referral: "gold",
  BNI: "gold",
  Instagram: "accent",
  Event: "warning",
  "Walk-in": "neutral",
};

export function ScoreRing({ score, size = 30 }: { score: number; size?: number }) {
  const r = 12;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "var(--color-success)" : score >= 60 ? "var(--color-primary)" : score >= 45 ? "var(--color-warning)" : "var(--color-danger)";
  return (
    <Tooltip content={`Qualification score ${score}/100`}>
      <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
        <svg viewBox="0 0 30 30" className="absolute inset-0 -rotate-90" width={size} height={size}>
          <circle cx="15" cy="15" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="3" />
          <circle cx="15" cy="15" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
        </svg>
        <span className="text-body font-semibold tabular">{score}</span>
      </span>
    </Tooltip>
  );
}

export function followUpState(l: Lead) {
  if (l.stage === "Won" || l.stage === "Lost") return "none" as const;
  const d = daysBetween(TODAY, l.nextFollowUp);
  return d < 0 ? ("overdue" as const) : d === 0 ? ("today" as const) : ("later" as const);
}

export function LeadCard({
  lead,
  onOpen,
  onMove,
  discountPending,
}: {
  lead: Lead;
  onOpen: () => void;
  onMove: (stage: Lead["stage"]) => void;
  discountPending?: boolean;
}) {
  const owner = personById(lead.ownerId);
  const fu = followUpState(lead);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/lead", lead.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      className="group cursor-grab rounded-xl border border-border bg-card p-3 shadow-card transition hover:border-primary/40 hover:shadow-pop active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-body font-semibold">{lead.company}</div>
          <div className="truncate text-body text-muted-foreground">{lead.name}</div>
        </div>
        <ScoreRing score={lead.score} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="-mr-1 inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground group-hover:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={onOpen}>
              <PanelRightOpen /> Open details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {LEAD_STAGES.filter((s) => s !== lead.stage).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onMove(s)}>
                <MoveRight /> {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge tone={sourceTone[lead.source]}>{lead.source}</Badge>
        <span className="truncate text-body text-muted-foreground">{lead.service}</span>
      </div>
      {discountPending && (
        <div className="mt-2">
          <Badge tone="warning" dot>
            Discount awaiting founder
          </Badge>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <span className="text-body font-semibold tabular">
          {inrCompact(lead.value)}
          <span className="text-body font-normal text-muted-foreground">/mo</span>
        </span>
        <div className="flex items-center gap-2">
          {fu !== "none" && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-body tabular",
                fu === "overdue" || fu === "today" ? "font-medium text-danger" : "text-muted-foreground",
              )}
            >
              <CalendarClock className="size-3.5" />
              {fu === "today" ? "Today" : fmtDate(lead.nextFollowUp)}
            </span>
          )}
          <Avatar name={owner.name} size="xs" />
        </div>
      </div>
    </div>
  );
}
