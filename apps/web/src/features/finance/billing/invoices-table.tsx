"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BellRing, FileSearch, IndianRupee, Search, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { useDemo } from "@/lib/store";
import { cn, fmtDate, inr } from "@/lib/utils";
import { useSendReminder } from "./dialogs";
import { statusMeta, useBilling, type InvoiceStatus, type InvoiceView } from "./store";

const FILTERS: { key: "all" | InvoiceStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "due", label: "Due" },
  { key: "partial", label: "Partially paid" },
  { key: "paid", label: "Paid" },
  { key: "draft", label: "Draft" },
];

export function InvoicesTable({
  invoices,
  onOpen,
  onRecordPayment,
}: {
  invoices: InvoiceView[];
  onOpen: (inv: InvoiceView) => void;
  onRecordPayment: (inv: InvoiceView) => void;
}) {
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const remind = useSendReminder();
  const issue = useBilling((s) => s.issueInvoice);
  const log = useDemo((s) => s.log);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: invoices.length };
    for (const i of invoices) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [invoices]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return invoices
      .filter((i) => filter === "all" || i.status === filter)
      .filter((i) => !needle || `${i.number} ${i.partyName} ${i.description} ${i.period} ${i.city}`.toLowerCase().includes(needle))
      .sort((a, b) => b.number.localeCompare(a.number));
  }, [invoices, filter, q]);

  const visible = showAll || filter !== "all" || q ? rows : rows.slice(0, 16);
  const totals = rows.reduce((s, i) => ({ taxable: s.taxable + i.taxable, total: s.total + i.total, balance: s.balance + i.balance }), { taxable: 0, total: 0, balance: 0 });

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-body font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {f.label}
              <span className={cn("tabular", filter === f.key ? "opacity-70" : "text-muted-foreground")}>{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice #, client, period…" className="pl-9" />
        </div>
      </div>
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Invoice</TH>
            <TH>Client · cycle</TH>
            <TH numeric>Taxable</TH>
            <TH numeric>GST 18%</TH>
            <TH numeric>Total</TH>
            <TH>Due</TH>
            <TH>Status</TH>
            <TH numeric>Balance</TH>
            <TH numeric className="pr-5">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {visible.map((i) => {
            const critical = i.daysOverdue > 30 && i.partyKey === "UNR";
            return (
              <TR
                key={i.id}
                onClick={() => onOpen(i)}
                className={cn("cursor-pointer", critical && "bg-danger-soft/70 hover:bg-danger-soft", i.status === "draft" && "bg-primary-soft/40")}
              >
                <TD className={cn("pl-5", critical && "border-l-2 border-l-danger")}>
                  <div className="font-mono text-body font-medium">{i.number}</div>
                  <div className="text-body text-muted-foreground">{fmtDate(i.issueDate)}</div>
                </TD>
                <TD className="max-w-[260px]">
                  <div className="truncate font-medium">{i.partyName}</div>
                  <div className="truncate text-body text-muted-foreground">
                    {i.period} · {i.description}
                  </div>
                </TD>
                <TD numeric className="whitespace-nowrap">{inr(i.taxable)}</TD>
                <TD numeric className="whitespace-nowrap">
                  <div>{inr(i.gst)}</div>
                  <div className="text-body text-muted-foreground">
                    {i.interState ? "IGST 18%" : "CGST 9% + SGST 9%"}
                  </div>
                </TD>
                <TD numeric className="whitespace-nowrap font-medium">{inr(i.total)}</TD>
                <TD className="whitespace-nowrap">
                  <div className="tabular">{fmtDate(i.dueDate)}</div>
                  {i.daysOverdue > 0 && <div className="text-body font-medium text-danger">{i.daysOverdue}d overdue</div>}
                </TD>
                <TD>
                  <div className="flex flex-col items-start gap-1">
                    <Badge tone={statusMeta[i.status].tone} dot>
                      {statusMeta[i.status].label}
                    </Badge>
                    {i.status === "overdue" && i.received > 0 && <span className="text-body text-muted-foreground">part-paid</span>}
                  </div>
                </TD>
                <TD numeric className={cn("whitespace-nowrap font-medium", i.balance > 0 ? (i.daysOverdue > 0 ? "text-danger" : "text-foreground") : "text-muted-foreground")}>
                  {i.balance > 0 ? inr(i.balance) : "—"}
                  {i.reminders > 0 && i.balance > 0 && (
                    <div className="text-body font-normal text-muted-foreground">
                      {i.reminders} reminder{i.reminders > 1 ? "s" : ""}
                    </div>
                  )}
                </TD>
                <TD className="pr-5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5">
                    {i.status === "draft" ? (
                      <Button
                        size="xs"
                        variant="soft"
                        onClick={() => {
                          issue(i.id);
                          toast.success(`${i.number} issued`, { description: `Emailed to ${i.partyName} · e-invoice IRN generated` });
                          log(`Invoice ${i.number} issued to ${i.partyName}`, "accent");
                        }}
                      >
                        <Send /> Issue
                      </Button>
                    ) : i.balance > 0 ? (
                      <>
                        <Tooltip content={`Send WhatsApp + email reminder${i.reminders ? ` (#${i.reminders + 1})` : ""}`}>
                          <Button size="xs" variant={i.daysOverdue > 0 ? "outline" : "ghost"} onClick={() => remind(i)}>
                            <BellRing /> Remind
                          </Button>
                        </Tooltip>
                        <Button size="xs" variant="outline" onClick={() => onRecordPayment(i)}>
                          <IndianRupee /> Payment
                        </Button>
                      </>
                    ) : (
                      <Button size="xs" variant="ghost" onClick={() => onOpen(i)}>
                        View
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
          {visible.length === 0 && (
            <TR>
              <TD colSpan={9} className="p-5">
                <EmptyState
                  compact
                  icon={FileSearch}
                  title="No invoices match these filters"
                  description="Try another status or clear the search to see all invoices."
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setFilter("all");
                        setQ("");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              </TD>
            </TR>
          )}
        </TBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-strong bg-surface-secondary px-5 py-3 text-body text-muted-foreground">
        <span>
          Showing {visible.length} of {rows.length} · taxable <span className="font-semibold text-foreground tabular">{inr(totals.taxable)}</span> · billed{" "}
          <span className="font-semibold text-foreground tabular">{inr(totals.total)}</span> · open{" "}
          <span className="font-semibold text-foreground tabular">{inr(totals.balance)}</span>
        </span>
        {filter === "all" && !q && rows.length > 16 && (
          <Button variant="ghost" size="xs" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show recent only" : `Show all ${rows.length} invoices`}
          </Button>
        )}
      </div>
    </Card>
  );
}
