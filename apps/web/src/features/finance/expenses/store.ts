"use client";

import { create } from "zustand";
import { TODAY } from "@/lib/mock/core";
import { expensesSeed, vendorsSeed, type Expense, type ExpenseEvent, type Vendor } from "@/lib/mock/finance";

const nowIso = () => new Date().toISOString();

interface ExpenseState {
  expenses: Expense[];
  vendors: Vendor[];
  approve: (id: string, by: string) => void;
  reject: (id: string, by: string, reason: string) => void;
  settle: (id: string) => void;
  addExpense: (e: Omit<Expense, "id" | "code" | "date" | "approval" | "paymentStatus" | "timeline">) => string;
  addVendor: (v: Omit<Vendor, "id" | "ytdSpend" | "lastPayment" | "rating">) => void;
  payVendor: (vendorName: string) => number;
}

const push = (e: Expense, ev: ExpenseEvent): Expense => ({ ...e, timeline: [...e.timeline, ev] });

export const useExpenses = create<ExpenseState>()((set, get) => ({
  expenses: expensesSeed,
  vendors: vendorsSeed,

  approve: (id, by) =>
    set((s) => ({
      expenses: s.expenses.map((e) => (e.id === id ? push({ ...e, approval: "approved" }, { at: nowIso(), text: `Approved by ${by}`, tone: "success" }) : e)),
    })),

  reject: (id, by, reason) =>
    set((s) => ({
      expenses: s.expenses.map((e) =>
        e.id === id ? push({ ...e, approval: "rejected", rejectReason: reason }, { at: nowIso(), text: `Rejected by ${by} — ${reason}`, tone: "danger" }) : e,
      ),
    })),

  settle: (id) =>
    set((s) => ({
      expenses: s.expenses.map((e) => {
        if (e.id !== id) return e;
        const reimb = e.paidBy === "employee";
        return push(
          { ...e, paymentStatus: reimb ? "reimbursed" : "paid-to-vendor" },
          { at: nowIso(), text: reimb ? "Reimbursed via UPI (payroll batch)" : "Paid to vendor · NEFT", tone: "accent" },
        );
      }),
    })),

  addExpense: (e) => {
    const max = Math.max(...get().expenses.map((x) => Number(x.code.slice(-3))));
    const code = `EXP-0926-${String(max + 1).padStart(3, "0")}`;
    const exp: Expense = {
      ...e,
      id: `e-${Math.random().toString(36).slice(2, 8)}`,
      code,
      date: TODAY,
      approval: "pending",
      paymentStatus: e.mode === "Card" || e.mode === "Auto-debit" ? "paid-to-vendor" : "unpaid",
      timeline: [{ at: nowIso(), text: "Submitted just now" }],
    };
    set((s) => ({ expenses: [exp, ...s.expenses] }));
    return code;
  },

  addVendor: (v) =>
    set((s) => ({
      vendors: [{ ...v, id: `vd-${Math.random().toString(36).slice(2, 8)}`, ytdSpend: 0, lastPayment: { date: "", amount: 0 }, rating: 0 }, ...s.vendors],
    })),

  payVendor: (vendorName) => {
    const due = get().expenses.filter((e) => e.vendor === vendorName && e.approval === "approved" && e.paymentStatus === "unpaid" && e.paidBy === "company");
    const amount = due.reduce((s, e) => s + e.amount, 0);
    if (!amount) return 0;
    set((s) => ({
      expenses: s.expenses.map((e) => (due.some((d) => d.id === e.id) ? push({ ...e, paymentStatus: "paid-to-vendor" }, { at: nowIso(), text: "Paid to vendor · NEFT", tone: "accent" }) : e)),
      vendors: s.vendors.map((v) => (v.name === vendorName ? { ...v, ytdSpend: v.ytdSpend + amount, lastPayment: { date: TODAY, amount } } : v)),
    }));
    return amount;
  },
}));

export const CATEGORY_STYLE: Record<string, { strip: string; soft: string; text: string }> = {
  Travel: { strip: "bg-chart-1", soft: "bg-primary-soft", text: "text-primary" },
  "Food & refreshments": { strip: "bg-chart-3", soft: "bg-accent-soft", text: "text-accent-strong" },
  "Equipment rental": { strip: "bg-chart-2", soft: "bg-secondary-soft", text: "text-secondary" },
  "Props & consumables": { strip: "bg-chart-4", soft: "bg-secondary-soft", text: "text-secondary" },
  Software: { strip: "bg-info", soft: "bg-info-soft", text: "text-info" },
  Freelancer: { strip: "bg-accent", soft: "bg-accent-soft", text: "text-accent-strong" },
  Utilities: { strip: "bg-chart-5", soft: "bg-muted", text: "text-muted-foreground" },
  "Marketing/Ads": { strip: "bg-primary", soft: "bg-primary-soft", text: "text-primary" },
  Rent: { strip: "bg-chart-5", soft: "bg-muted", text: "text-muted-foreground" },
};

export interface PolicyCheck {
  label: string;
  state: "pass" | "fail" | "info" | "waiting";
  detail?: string;
}

export function policyChecks(e: Expense, approverName: string): PolicyCheck[] {
  const checks: PolicyCheck[] = [];
  checks.push(e.receipt ? { label: "Receipt attached", state: "pass" } : { label: "Receipt attached", state: "fail", detail: "Upload a bill photo within 48 hours" });
  checks.push(
    e.clientId
      ? { label: "Allocated to project", state: "pass", detail: e.videoCode }
      : { label: "Allocated to overhead pool", state: "pass", detail: e.overheadPool ?? "Overhead" },
  );
  if (e.category === "Travel")
    checks.push(
      e.amount > 5000
        ? { label: "Travel > ₹5,000 needs manager approval", state: e.approval === "pending" ? "waiting" : "pass", detail: `Routed to ${approverName}` }
        : { label: "Travel within ₹5,000 self-approval limit", state: "pass" },
    );
  if (e.amount > 10000)
    checks.push({ label: "Above ₹10,000 needs founder approval", state: e.approval === "pending" ? "waiting" : "pass", detail: `Routed to ${approverName}` });
  if (e.gst > 0)
    checks.push(
      e.itc
        ? { label: "GST invoice with valid GSTIN — ITC claimable", state: "pass", detail: `Input credit ₹${e.gst.toLocaleString("en-IN")}` }
        : { label: "GST paid but ITC blocked (Sec 17(5) — food / travel)", state: "info" },
    );
  checks.push(
    e.rejectReason?.toLowerCase().includes("duplicate")
      ? { label: "Duplicate check", state: "fail", detail: "Matches an earlier claim" }
      : { label: "Duplicate check — no matching claim", state: "pass" },
  );
  return checks;
}
