import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CadenceId } from "@/lib/mock/management";

export const cadenceTone: Record<CadenceId, BadgeTone> = {
  daily: "info",
  weekly: "neutral",
  tactical: "accent",
  strategic: "gold",
};

const letterCls: Record<CadenceId, string> = {
  daily: "bg-info-soft text-info",
  weekly: "bg-muted text-foreground",
  tactical: "bg-accent-soft text-accent",
  strategic: "bg-gold-soft text-gold",
};

export function CadenceLetter({ cadence, letter, className }: { cadence: CadenceId; letter: string; className?: string }) {
  return (
    <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold", letterCls[cadence], className)}>
      {letter}
    </span>
  );
}

export function MarkBadge({ mark }: { mark?: "BT" | "BD" }) {
  if (!mark) return <Badge tone="outline">Not marked</Badge>;
  return mark === "BT" ? (
    <Badge tone="success" dot>
      BT · Breakthrough
    </Badge>
  ) : (
    <Badge tone="danger" dot>
      BD · Breakdown
    </Badge>
  );
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function fmtLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
