"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { TODAY, daysBetween, clientById } from "@/lib/mock/core";
import {
  advancesSeed,
  creditNotesSeed,
  gstSplit,
  invoicesSeed,
  partyByKey,
  type ClientAdvance,
  type CreditNote,
  type Invoice,
  type InvoicePayment,
} from "@/lib/mock/finance";

export type InvoiceStatus = "draft" | "paid" | "partial" | "due" | "overdue";

export interface InvoiceView extends Invoice {
  partyName: string;
  city: string;
  interState: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  gst: number;
  total: number;
  received: number; // cash + TDS
  tds: number;
  balance: number;
  status: InvoiceStatus;
  daysOverdue: number; // >0 when past due and unpaid
  category?: string;
}

export function viewInvoice(inv: Invoice): InvoiceView {
  const party = partyByKey(inv.partyKey);
  const split = gstSplit(inv.taxable, party.interState);
  const received = inv.payments.reduce((s, p) => s + p.amount + p.tds, 0);
  const tds = inv.payments.reduce((s, p) => s + p.tds, 0);
  const balance = Math.max(0, split.total - received - inv.creditAdj);
  const pastDue = daysBetween(inv.dueDate, TODAY);
  let status: InvoiceStatus;
  if (inv.draft) status = "draft";
  else if (balance <= 0) status = "paid";
  else if (pastDue > 0) status = "overdue";
  else if (received > 0) status = "partial";
  else status = "due";
  return {
    ...inv,
    ...split,
    partyName: party.name,
    city: party.city,
    interState: party.interState,
    received,
    tds,
    balance,
    status,
    daysOverdue: balance > 0 && !inv.draft ? Math.max(0, pastDue) : 0,
    category: party.clientId ? clientById(party.clientId).category : undefined,
  };
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

interface BillingState {
  invoices: Invoice[];
  advances: ClientAdvance[];
  creditNotes: CreditNote[];
  sendReminder: (id: string) => void;
  recordPayment: (id: string, p: Omit<InvoicePayment, "id">) => void;
  addInvoice: (inv: Pick<Invoice, "partyKey" | "period" | "description" | "taxable" | "dueDate">) => string;
  issueInvoice: (id: string) => void;
  adjustAdvance: (advId: string) => { invoiceNo: string; amount: number } | null;
  approveCreditNote: (cnId: string) => void;
}

export const useBilling = create<BillingState>()((set, get) => ({
  invoices: invoicesSeed,
  advances: advancesSeed,
  creditNotes: creditNotesSeed,

  sendReminder: (id) =>
    set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? { ...i, reminders: i.reminders + 1, lastReminder: TODAY } : i)) })),

  recordPayment: (id, p) =>
    set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? { ...i, payments: [...i.payments, { ...p, id: uid("pay") }] } : i)) })),

  addInvoice: (inv) => {
    const max = Math.max(...get().invoices.map((i) => Number(i.number.slice(-3))));
    const n = String(max + 1).padStart(3, "0");
    const number = `GM/26-27/${n}`;
    set((s) => ({
      invoices: [
        ...s.invoices,
        { ...inv, id: `inv-${n}`, number, issueDate: TODAY, payments: [], creditAdj: 0, reminders: 0, draft: true },
      ],
    }));
    return number;
  },

  issueInvoice: (id) => set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? { ...i, draft: false } : i)) })),

  adjustAdvance: (advId) => {
    const adv = get().advances.find((a) => a.id === advId);
    if (!adv) return null;
    const left = adv.amount - adv.adjustments.reduce((s, a) => s + a.amount, 0);
    const target = get()
      .invoices.map(viewInvoice)
      .filter((i) => i.partyKey === adv.partyKey && i.balance > 0 && i.status !== "draft")
      .sort((a, b) => a.issueDate.localeCompare(b.issueDate))[0];
    if (!target || left <= 0) return null;
    const amount = Math.min(left, target.balance);
    set((s) => ({
      advances: s.advances.map((a) =>
        a.id === advId ? { ...a, adjustments: [...a.adjustments, { invoiceNo: target.number, amount, date: TODAY }] } : a,
      ),
      invoices: s.invoices.map((i) =>
        i.id === target.id
          ? { ...i, payments: [...i.payments, { id: uid("pay"), date: TODAY, amount, tds: 0, mode: "Advance", ref: `${adv.number} adjusted` }] }
          : i,
      ),
    }));
    return { invoiceNo: target.number, amount };
  },

  approveCreditNote: (cnId) => {
    const cn = get().creditNotes.find((c) => c.id === cnId);
    if (!cn) return;
    const gross = gstSplit(cn.taxable, partyByKey(cn.partyKey).interState).total;
    set((s) => ({
      creditNotes: s.creditNotes.map((c) => (c.id === cnId ? { ...c, status: "applied", date: TODAY } : c)),
      invoices: s.invoices.map((i) => (i.number === cn.invoiceNo ? { ...i, creditAdj: i.creditAdj + gross } : i)),
    }));
  },
}));

export function useInvoiceViews() {
  const invoices = useBilling((s) => s.invoices);
  return useMemo(() => invoices.map(viewInvoice), [invoices]);
}

export const statusMeta: Record<InvoiceStatus, { label: string; tone: "neutral" | "success" | "info" | "warning" | "danger" | "outline" }> = {
  draft: { label: "Draft", tone: "outline" },
  paid: { label: "Paid", tone: "success" },
  partial: { label: "Partially paid", tone: "warning" },
  due: { label: "Due", tone: "warning" },
  overdue: { label: "Overdue", tone: "danger" },
};

export const AGING_BUCKETS = [
  { key: "b0", label: "0–30 days", min: 0, max: 30, bar: "bg-chart-2", text: "text-success" },
  { key: "b1", label: "31–60 days", min: 31, max: 60, bar: "bg-chart-3", text: "text-warning" },
  { key: "b2", label: "61–90 days", min: 61, max: 90, bar: "bg-chart-4", text: "text-danger" },
  { key: "b3", label: "90+ days", min: 91, max: Infinity, bar: "bg-danger", text: "text-danger" },
] as const;

export function bucketOf(daysOverdue: number) {
  return AGING_BUCKETS.find((b) => daysOverdue >= b.min && daysOverdue <= b.max)!;
}
