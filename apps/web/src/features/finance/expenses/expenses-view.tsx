"use client";

import { useMemo, useState } from "react";
import { Check, CircleDollarSign, Hourglass, PieChart, Receipt, Search, Wallet, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { StatCard } from "@/components/shared/stat-card";
import { clientById, personById } from "@/lib/mock/core";
import { EXPENSE_CATEGORIES, type Expense } from "@/lib/mock/finance";
import { cn, fmtDate, inr, inrCompact } from "@/lib/utils";
import { ExpenseSheet, RejectDialog, approvalMeta, paymentMeta, useExpenseActions } from "./expense-sheet";
import { ReceiptTile } from "./receipt";
import { CATEGORY_STYLE, useExpenses } from "./store";
import { VendorsTab } from "./vendors";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

export function ExpensesView() {
  const expenses = useExpenses((s) => s.expenses);
  const actions = useExpenseActions();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const openExp = expenses.find((e) => e.id === openId) ?? null;
  const rejectExp = expenses.find((e) => e.id === rejectId) ?? null;

  const stats = useMemo(() => {
    const pending = expenses.filter((e) => e.approval === "pending");
    const approved = expenses.filter((e) => e.approval === "approved");
    const reimb = approved.filter((e) => e.paidBy === "employee" && e.paymentStatus === "unpaid");
    const byCat = new Map<string, number>();
    for (const e of expenses) if (e.approval !== "rejected") byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];
    const itc = approved.filter((e) => e.itc).reduce((s, e) => s + e.gst, 0);
    return {
      pendingCount: pending.length,
      pendingAmt: pending.reduce((s, e) => s + e.amount, 0),
      approvedAmt: approved.reduce((s, e) => s + e.amount, 0),
      approvedCount: approved.length,
      reimbAmt: reimb.reduce((s, e) => s + e.amount, 0),
      reimbPeople: new Set(reimb.map((e) => e.requesterId)).size,
      top,
      total: [...byCat.values()].reduce((s, v) => s + v, 0),
      itc,
    };
  }, [expenses]);

  const counts: Record<string, number> = {
    all: expenses.length,
    pending: stats.pendingCount,
    approved: stats.approvedCount,
    rejected: expenses.filter((e) => e.approval === "rejected").length,
  };

  const rows = expenses
    .filter((e) => filter === "all" || e.approval === filter)
    .filter((e) => cat === "all" || e.category === cat)
    .filter((e) => !q || `${e.code} ${e.vendor} ${e.description} ${e.videoCode ?? ""} ${personById(e.requesterId).name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.approval === "pending" ? 0 : 1) - (b.approval === "pending" ? 0 : 1) || b.date.localeCompare(a.date) || b.code.localeCompare(a.code));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending approval" value={inr(stats.pendingAmt)} icon={Hourglass} tone="warning" hint={`${stats.pendingCount} requests waiting`} />
        <StatCard label="Approved this month" value={inr(stats.approvedAmt)} icon={Check} tone="success" hint={`${stats.approvedCount} expenses · ITC ${inrCompact(stats.itc)}`} />
        <StatCard label="Reimbursements due" value={inr(stats.reimbAmt)} icon={Wallet} tone="info" hint={`${stats.reimbPeople} employee${stats.reimbPeople === 1 ? "" : "s"} · Friday payroll batch`} />
        <StatCard label="Top category" value={stats.top[0]} icon={PieChart} tone="accent" hint={`${inr(stats.top[1])} · ${Math.round((stats.top[1] / (stats.total || 1)) * 100)}% of Sep spend`} />
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">
            <Receipt /> Expense requests
            {stats.pendingCount > 0 && <Badge tone="warning" className="px-1.5 py-0 text-[10.5px]">{stats.pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="vendors">
            <CircleDollarSign /> Vendors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card>
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition",
                      filter === f.key ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label}
                    <span className="tabular text-[11px] opacity-70">{counts[f.key]}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={cat}
                  onValueChange={setCat}
                  className="sm:w-52"
                  options={[{ value: "all", label: "All categories" }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]}
                />
                <div className="relative sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendor, code, video…" className="pl-9" />
                </div>
              </div>
            </div>
            <Table>
              <THead>
                <TR>
                  <TH className="pl-5">Expense</TH>
                  <TH>Category</TH>
                  <TH>Requester → approver</TH>
                  <TH>Allocation</TH>
                  <TH className="text-right">Amount</TH>
                  <TH>Payment</TH>
                  <TH>Approval</TH>
                  <TH className="pr-5 text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((e) => (
                  <ExpenseRow key={e.id} e={e} onOpen={() => setOpenId(e.id)} onApprove={() => actions.approve(e)} onReject={() => setRejectId(e.id)} onSettle={() => actions.settle(e)} />
                ))}
                {rows.length === 0 && (
                  <TR>
                    <TD colSpan={8} className="py-10 text-center text-muted-foreground">
                      No expenses match these filters.
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="vendors">
          <VendorsTab />
        </TabsContent>
      </Tabs>

      <ExpenseSheet expense={openExp} onOpenChange={(o) => !o && setOpenId(null)} onReject={(e) => setRejectId(e.id)} />
      <RejectDialog expense={rejectExp} onOpenChange={(o) => !o && setRejectId(null)} />
    </div>
  );
}

function ExpenseRow({ e, onOpen, onApprove, onReject, onSettle }: { e: Expense; onOpen: () => void; onApprove: () => void; onReject: () => void; onSettle: () => void }) {
  const style = CATEGORY_STYLE[e.category] ?? CATEGORY_STYLE.Utilities!;
  const requester = personById(e.requesterId);
  const approver = personById(e.approverId);
  return (
    <TR onClick={onOpen} className={cn("cursor-pointer", e.approval === "pending" && "bg-warning-soft/30")}>
      <TD className="pl-5">
        <div className="flex items-center gap-3">
          <ReceiptTile expense={e} />
          <div className="min-w-0 max-w-[280px]">
            <div className="truncate font-medium">{e.vendor}</div>
            <div className="truncate text-[11.5px] text-muted-foreground">{e.description}</div>
            <div className="text-[11px] text-muted-foreground">
              <span className="font-mono">{e.code}</span> · {fmtDate(e.date)}
            </div>
          </div>
        </div>
      </TD>
      <TD>
        <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-medium", style.soft, style.text)}>
          <span className={cn("size-1.5 rounded-full", style.strip)} />
          {e.category}
        </span>
      </TD>
      <TD>
        <div className="flex items-center gap-1.5 text-[12.5px]">
          <Avatar name={requester.name} size="xs" />
          <span className="max-w-[90px] truncate">{requester.name.split(" ")[0]}</span>
          <span className="text-muted-foreground">→</span>
          <Avatar name={approver.name} size="xs" />
          <span className="text-muted-foreground">{approver.name.split(" ")[0]}</span>
        </div>
      </TD>
      <TD>
        {e.clientId ? (
          <div>
            <div className="text-[12.5px]">{clientById(e.clientId).name}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{e.videoCode}</div>
          </div>
        ) : (
          <div>
            <Badge tone="outline">Overhead</Badge>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{e.overheadPool}</div>
          </div>
        )}
      </TD>
      <TD className="text-right">
        <div className="font-medium tabular">{inr(e.amount)}</div>
        {e.gst > 0 ? (
          <Tooltip content={e.itc ? "GST input tax credit claimable" : "GST paid — credit blocked under Sec 17(5)"}>
            <span className={cn("text-[10.5px]", e.itc ? "text-success" : "text-muted-foreground")}>
              {e.itc ? "ITC" : "GST"} {inr(e.gst)}
            </span>
          </Tooltip>
        ) : (
          <span className="text-[10.5px] text-muted-foreground">No GST</span>
        )}
      </TD>
      <TD>
        <Badge tone={paymentMeta[e.paymentStatus].tone}>{paymentMeta[e.paymentStatus].label}</Badge>
        <div className="mt-0.5 text-[10.5px] text-muted-foreground">{e.paidBy === "employee" ? "Employee paid" : e.mode}</div>
      </TD>
      <TD>
        <Badge tone={approvalMeta[e.approval].tone} dot>
          {approvalMeta[e.approval].label.replace(" approval", "")}
        </Badge>
        {e.rejectReason && <div className="mt-0.5 max-w-[140px] truncate text-[10.5px] text-danger">{e.rejectReason}</div>}
      </TD>
      <TD className="pr-5" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex justify-end gap-1.5">
          {e.approval === "pending" ? (
            <>
              <Button size="xs" variant="outline" onClick={onReject}>
                <X /> Reject
              </Button>
              <Button size="xs" variant="success" onClick={onApprove}>
                <Check /> Approve
              </Button>
            </>
          ) : e.approval === "approved" && e.paymentStatus === "unpaid" ? (
            <Button size="xs" variant="soft" onClick={onSettle}>
              {e.paidBy === "employee" ? "Reimburse" : "Mark paid"}
            </Button>
          ) : (
            <Button size="xs" variant="ghost" onClick={onOpen}>
              View
            </Button>
          )}
        </div>
      </TD>
    </TR>
  );
}
