"use client";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { agreements, daysBetween, TODAY } from "@/lib/mock/core";
import { agreementChanges } from "@/lib/mock/crm";
import type { Agreement } from "@/lib/types";
import { useCrmDemo } from "@/features/crm/crm-store";

export const statusMeta: Record<Agreement["status"], { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "success" },
  "renewal-due": { label: "Renewal due", tone: "warning" },
  paused: { label: "Paused", tone: "neutral" },
  draft: { label: "Draft", tone: "info" },
  ended: { label: "Ended", tone: "outline" },
};

export function StatusBadge({ status }: { status: Agreement["status"] }) {
  const m = statusMeta[status];
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  );
}

export function useAgreements() {
  const overrides = useCrmDemo((s) => s.agreementOverrides);
  return agreements.map((a) => {
    const o = overrides[a.id];
    const merged: Agreement = o ? { ...a, status: o.status ?? a.status, endDate: o.endDate ?? a.endDate, monthlyFee: o.monthlyFee ?? a.monthlyFee } : a;
    return {
      ...merged,
      original: a,
      changes: [...(o?.changes ?? []), ...(agreementChanges[a.id] ?? [])],
    };
  });
}

export type LiveAgreement = ReturnType<typeof useAgreements>[number];

export function periodProgress(a: Agreement) {
  const total = daysBetween(a.startDate, a.endDate);
  const done = daysBetween(a.startDate, TODAY);
  return Math.max(0, Math.min(1, done / total));
}

export const unitsTotal = (a: Agreement) => a.units.reduce((s, u) => s + u.perCycle, 0);
