"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Check, CheckCircle2, Clock, Info, X, XCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { clientById, personById } from "@/lib/mock/core";
import type { Expense } from "@/lib/mock/finance";
import { useDemo } from "@/lib/store";
import { cn, fmtDate, inr } from "@/lib/utils";
import { ReceiptPreview } from "./receipt";
import { policyChecks, useExpenses } from "./store";

export const approvalMeta = {
  pending: { label: "Pending approval", tone: "warning" as const },
  approved: { label: "Approved", tone: "success" as const },
  rejected: { label: "Rejected", tone: "danger" as const },
};

export const paymentMeta = {
  unpaid: { label: "Unpaid", tone: "neutral" as const },
  reimbursed: { label: "Reimbursed", tone: "info" as const },
  "paid-to-vendor": { label: "Paid to vendor", tone: "info" as const },
};

export function useExpenseActions() {
  const approve = useExpenses((s) => s.approve);
  const settle = useExpenses((s) => s.settle);
  const log = useDemo((s) => s.log);
  return {
    approve: (e: Expense) => {
      const by = personById(e.approverId).name;
      approve(e.id, by);
      toast.success(`${e.code} approved`, { description: `${inr(e.amount)} · ${e.vendor} · ${e.paidBy === "employee" ? "added to Friday reimbursement batch" : "queued for vendor payment"}` });
      log(`${by} approved expense ${e.code} — ${e.vendor} (${inr(e.amount)})`, "success");
    },
    settle: (e: Expense) => {
      settle(e.id);
      const who = personById(e.requesterId).name;
      toast.success(e.paidBy === "employee" ? `${inr(e.amount)} reimbursed to ${who}` : `${inr(e.amount)} paid to ${e.vendor}`, { description: e.code });
      log(e.paidBy === "employee" ? `Reimbursed ${inr(e.amount)} to ${who} (${e.code})` : `Paid ${e.vendor} ${inr(e.amount)} (${e.code})`, "accent");
    },
  };
}

const QUICK_REASONS = ["Receipt missing or unreadable", "Not billable to this project — re-allocate", "Exceeds policy limit without pre-approval", "Duplicate claim"];

export function RejectDialog({ expense, onOpenChange }: { expense: Expense | null; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState("");
  const reject = useExpenses((s) => s.reject);
  const log = useDemo((s) => s.log);
  const submit = () => {
    if (!expense || !reason.trim()) return;
    const by = personById(expense.approverId).name;
    reject(expense.id, by, reason.trim());
    toast(`${expense.code} rejected`, { description: `${personById(expense.requesterId).name} notified · “${reason.trim()}”` });
    log(`${by} rejected expense ${expense.code} — ${reason.trim()}`, "danger");
    setReason("");
    onOpenChange(false);
  };
  return (
    <Dialog
      open={!!expense}
      onOpenChange={(o) => {
        if (!o) setReason("");
        onOpenChange(o);
      }}
    >
      <DialogContent>
        {expense && (
          <>
            <DialogHeader>
              <DialogTitle>Reject {expense.code}?</DialogTitle>
              <DialogDescription>
                {expense.vendor} · {inr(expense.amount)} · requested by {personById(expense.requesterId).name}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={cn(
                      "cursor-pointer rounded-full border px-2.5 py-1 text-xs transition",
                      reason === r ? "border-danger bg-danger-soft text-danger" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shared with the requester)" />
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" disabled={!reason.trim()} onClick={submit}>
                <X /> Reject expense
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ExpenseSheet({ expense, onOpenChange, onReject }: { expense: Expense | null; onOpenChange: (o: boolean) => void; onReject: (e: Expense) => void }) {
  const actions = useExpenseActions();
  return (
    <Dialog open={!!expense} onOpenChange={onOpenChange}>
      <DialogContent side="right">
        {expense && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>{expense.vendor}</DialogTitle>
                <Badge tone={approvalMeta[expense.approval].tone} dot>
                  {approvalMeta[expense.approval].label}
                </Badge>
              </div>
              <DialogDescription>
                <span className="font-mono">{expense.code}</span> · {expense.category} · {fmtDate(expense.date, { day: "numeric", month: "short", year: "numeric" })}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-5">
              <ReceiptPreview expense={expense} />

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border p-4 text-[13px]">
                <Info2 label="Description" className="col-span-2">
                  {expense.description}
                </Info2>
                <Info2 label="Amount (incl. GST)">
                  <span className="font-semibold tabular">{inr(expense.amount)}</span>
                  {expense.gst > 0 && <span className="text-muted-foreground tabular"> · GST {inr(expense.gst)}</span>}
                </Info2>
                <Info2 label="GST input credit">
                  {expense.itc ? <Badge tone="success">ITC {inr(expense.gst)}</Badge> : <Badge tone="neutral">Not claimable</Badge>}
                </Info2>
                <Info2 label="Requested by">
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar name={personById(expense.requesterId).name} size="xs" /> {personById(expense.requesterId).name}
                  </span>
                </Info2>
                <Info2 label="Approver">
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar name={personById(expense.approverId).name} size="xs" /> {personById(expense.approverId).name}
                  </span>
                </Info2>
                <Info2 label="Allocation">
                  {expense.clientId ? (
                    <>
                      {clientById(expense.clientId).name} · <span className="font-mono">{expense.videoCode}</span>
                    </>
                  ) : (
                    <>Overhead · {expense.overheadPool}</>
                  )}
                </Info2>
                <Info2 label="Payment">
                  {expense.paidBy === "employee" ? "Paid by employee" : "Company"} · {expense.mode} ·{" "}
                  <Badge tone={paymentMeta[expense.paymentStatus].tone}>{paymentMeta[expense.paymentStatus].label}</Badge>
                </Info2>
                {expense.rejectReason && (
                  <Info2 label="Rejection reason" className="col-span-2">
                    <span className="text-danger">{expense.rejectReason}</span>
                  </Info2>
                )}
              </div>

              <div>
                <div className="mb-2 text-[13px] font-semibold">Policy checks</div>
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {policyChecks(expense, personById(expense.approverId).name).map((c) => (
                    <li key={c.label} className="flex items-start gap-2.5 px-3.5 py-2.5 text-[13px]">
                      {c.state === "pass" && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />}
                      {c.state === "fail" && <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
                      {c.state === "waiting" && <Clock className="mt-0.5 size-4 shrink-0 text-warning" />}
                      {c.state === "info" && <Info className="mt-0.5 size-4 shrink-0 text-info" />}
                      <div className="min-w-0 flex-1">
                        <div>{c.label}</div>
                        {c.detail && <div className="text-xs text-muted-foreground">{c.detail}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="mb-2 text-[13px] font-semibold">Timeline</div>
                <ol className="relative space-y-3 border-l border-border pl-5">
                  {expense.timeline.map((t, idx) => (
                    <li key={idx} className="relative text-[13px]">
                      <span
                        className={cn(
                          "absolute -left-[25px] top-1 size-2.5 rounded-full ring-4 ring-popover",
                          t.tone === "success" ? "bg-success" : t.tone === "danger" ? "bg-danger" : t.tone === "warning" ? "bg-warning" : t.tone === "accent" ? "bg-accent" : "bg-chart-5",
                        )}
                      />
                      <div>{t.text}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </DialogBody>
            <DialogFooter>
              {expense.approval === "pending" && (
                <>
                  <Button variant="outline" size="sm" onClick={() => onReject(expense)}>
                    <X /> Reject
                  </Button>
                  <Button variant="success" size="sm" onClick={() => actions.approve(expense)}>
                    <Check /> Approve
                  </Button>
                </>
              )}
              {expense.approval === "approved" && expense.paymentStatus === "unpaid" && (
                <Button variant="accent" size="sm" onClick={() => actions.settle(expense)}>
                  {expense.paidBy === "employee" ? "Mark reimbursed" : "Mark paid to vendor"}
                </Button>
              )}
              {(expense.approval === "rejected" || expense.paymentStatus !== "unpaid") && expense.approval !== "pending" && (
                <span className="mr-auto inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <AlertCircle className="size-4" /> {expense.approval === "rejected" ? "Closed — requester can resubmit" : "Settled — no action needed"}
                </span>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info2({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
