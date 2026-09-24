"use client";

import { create } from "zustand";
import type { Agreement } from "@/lib/types";

export interface DiscountRequest {
  leadId: string;
  pct: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "auto-approved";
}

export interface AgreementOverride {
  status?: Agreement["status"];
  endDate?: string;
  monthlyFee?: number;
  changes: { at: string; text: string; by: string; kind: "create" | "sign" | "change" | "renew" | "note" }[];
}

interface CrmDemoState {
  discounts: Record<string, DiscountRequest>;
  requestDiscount: (leadId: string, pct: number, reason: string) => DiscountRequest;
  decideDiscount: (leadId: string, approve: boolean) => void;

  converted: string[];
  markConverted: (leadId: string) => void;

  agreementOverrides: Record<string, AgreementOverride>;
  patchAgreement: (id: string, patch: Partial<Omit<AgreementOverride, "changes">>, change?: AgreementOverride["changes"][number]) => void;

  octGenerated: boolean;
  setOctGenerated: () => void;

  onboarding: Record<string, string[]>;
  toggleOnboarding: (clientId: string, itemId: string, initial: string[]) => void;
  exceptions: Record<string, string>;
  requestException: (clientId: string, reason: string) => void;

  resolved: string[];
  resolve: (key: string) => void;
}

export const SALES_AUTHORITY = 10;

export const useCrmDemo = create<CrmDemoState>()((set, get) => ({
  discounts: {
    "l-09": { leadId: "l-09", pct: 12, reason: "Competing quote from Coimbatore agency at ₹66,000", status: "pending" },
  },
  requestDiscount: (leadId, pct, reason) => {
    const req: DiscountRequest = { leadId, pct, reason, status: pct <= SALES_AUTHORITY ? "auto-approved" : "pending" };
    set((s) => ({ discounts: { ...s.discounts, [leadId]: req } }));
    return req;
  },
  decideDiscount: (leadId, approve) => {
    const cur = get().discounts[leadId];
    if (!cur) return;
    set((s) => ({ discounts: { ...s.discounts, [leadId]: { ...cur, status: approve ? "approved" : "rejected" } } }));
  },

  converted: [],
  markConverted: (leadId) => set((s) => ({ converted: [...s.converted, leadId] })),

  agreementOverrides: {},
  patchAgreement: (id, patch, change) =>
    set((s) => {
      const cur = s.agreementOverrides[id] ?? { changes: [] };
      return {
        agreementOverrides: {
          ...s.agreementOverrides,
          [id]: { ...cur, ...patch, changes: change ? [change, ...cur.changes] : cur.changes },
        },
      };
    }),

  octGenerated: false,
  setOctGenerated: () => set({ octGenerated: true }),

  onboarding: {},
  toggleOnboarding: (clientId, itemId, initial) =>
    set((s) => {
      const cur = s.onboarding[clientId] ?? initial;
      const next = cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId];
      return { onboarding: { ...s.onboarding, [clientId]: next } };
    }),
  exceptions: {},
  requestException: (clientId, reason) => set((s) => ({ exceptions: { ...s.exceptions, [clientId]: reason } })),

  resolved: [],
  resolve: (key) => set((s) => ({ resolved: [...s.resolved, key] })),
}));
