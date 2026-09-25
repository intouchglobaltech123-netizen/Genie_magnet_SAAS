import { BadgeIndianRupee, ShieldCheck, Undo2, type LucideIcon } from "lucide-react";
import type { BadgeTone } from "@/components/ui/badge";
import type { ChangeRequest, RevisionKind } from "@/lib/store";

export const kindMeta: Record<RevisionKind, { label: string; short: string; tone: BadgeTone; iconCls: string; icon: LucideIcon; color: string; rule: string; effect: string }> = {
  "agency-correction": {
    label: "Agency correction",
    short: "Correction",
    tone: "success",
    iconCls: "bg-success-soft text-success",
    icon: ShieldCheck,
    color: "var(--color-chart-2)",
    rule: "Our mistake vs. the brief, brand guide or QC standard.",
    effect: "No allowance consumed · rework cost recorded internally",
  },
  "included-revision": {
    label: "Included revision",
    short: "Included",
    tone: "accent",
    iconCls: "bg-primary-soft text-primary",
    icon: Undo2,
    color: "var(--color-chart-1)",
    rule: "A new preference on an approved brief, within the agreement.",
    effect: "Consumes 1 round of the per-video allowance",
  },
  "out-of-scope": {
    label: "Out-of-scope",
    short: "Out-of-scope",
    tone: "warning",
    iconCls: "bg-warning-soft text-warning",
    icon: BadgeIndianRupee,
    color: "var(--color-chart-3)",
    rule: "New work beyond the brief, or rounds beyond the allowance.",
    effect: "Estimate + client approval before any billable work",
  },
};

export const statusMeta: Record<ChangeRequest["status"], { label: string; tone: BadgeTone }> = {
  open: { label: "Open", tone: "info" },
  "awaiting-client": { label: "Awaiting client", tone: "warning" },
  approved: { label: "Client approved", tone: "success" },
  rejected: { label: "Rejected", tone: "neutral" },
  done: { label: "Done", tone: "success" },
};
