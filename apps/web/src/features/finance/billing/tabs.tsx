"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, BellRing, CheckCircle2, FileMinus2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { CategoryBadge } from "@/components/shared/video-bits";
import { gstSplit, partyByKey } from "@/lib/mock/finance";
import { useDemo } from "@/lib/store";
import type { CustomerCategory } from "@/lib/types";
import { cn, fmtDate, inr, inrCompact } from "@/lib/utils";
import { useSendReminder } from "./dialogs";
import { AGING_BUCKETS, bucketOf, useBilling, type InvoiceView } from "./store";

// ───────────────────────────── Aging ─────────────────────────────

export function AgingBar({ invoices, barOnly }: { invoices: InvoiceView[]; barOnly?: boolean }) {
  const open = invoices.filter((i) => i.balance > 0 && i.status !== "draft");
  const sums = AGING_BUCKETS.map((b) => ({ ...b, amount: open.filter((i) => bucketOf(i.daysOverdue).key === b.key).reduce((s, i) => s + i.balance, 0) }));
  const total = sums.reduce((s, b) => s + b.amount, 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {sums.map((b) =>
          b.amount > 0 ? (
            <Tooltip key={b.key} content={`${b.label}: ${inr(b.amount)} (${Math.round((b.amount / total) * 100)}%)`}>
              <div className={cn("h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full", b.bar)} style={{ width: `${(b.amount / total) * 100}%` }} />
            </Tooltip>
          ) : null,
        )}
      </div>
      {!barOnly && (
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {sums.map((b) => (
          <div key={b.key} className="min-w-0">
            <div className="flex items-center gap-1.5 text-body text-muted-foreground">
              <span className={cn("size-2 rounded-full", b.bar)} />
              {b.label}
            </div>
            <div className="mt-0.5 text-subheading font-semibold tabular">{inrCompact(b.amount)}</div>
            <div className="text-body text-muted-foreground tabular">{Math.round((b.amount / total) * 100)}% of open</div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

export function AgingTab({ invoices }: { invoices: InvoiceView[] }) {
  const remind = useSendReminder();
  const rows = useMemo(() => {
    const open = invoices.filter((i) => i.balance > 0 && i.status !== "draft");
    const map = new Map<string, { key: string; name: string; category?: string; buckets: number[]; total: number; oldest: InvoiceView; reminders: number }>();
    for (const i of open) {
      const r = map.get(i.partyKey) ?? { key: i.partyKey, name: i.partyName, category: i.category, buckets: [0, 0, 0, 0], total: 0, oldest: i, reminders: 0 };
      const idx = AGING_BUCKETS.findIndex((b) => b.key === bucketOf(i.daysOverdue).key);
      r.buckets[idx]! += i.balance;
      r.total += i.balance;
      r.reminders += i.reminders;
      if (i.daysOverdue > r.oldest.daysOverdue) r.oldest = i;
      map.set(i.partyKey, r);
    }
    return [...map.values()].sort((a, b) => b.oldest.daysOverdue - a.oldest.daysOverdue || b.total - a.total);
  }, [invoices]);
  const colTotals = AGING_BUCKETS.map((_, idx) => rows.reduce((s, r) => s + r.buckets[idx]!, 0));
  const grand = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Receivables aging</CardTitle>
            <CardDescription>Open balances by days past due date · not-yet-due invoices sit in 0–30</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-body text-muted-foreground">Total open</div>
            <div className="text-subheading font-semibold tabular">{inr(grand)}</div>
          </div>
        </CardHeader>
        <CardContent>
          <AgingBar invoices={invoices} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Aging by client</CardTitle>
            <CardDescription>{rows.length} clients with open balances</CardDescription>
          </div>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Client</TH>
              {AGING_BUCKETS.map((b) => (
                <TH key={b.key} numeric>
                  {b.label}
                </TH>
              ))}
              <TH numeric>Total</TH>
              <TH>Oldest</TH>
              <TH numeric className="pr-5">Follow-up</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <TR className="hover:bg-transparent">
                <TD colSpan={AGING_BUCKETS.length + 4} className="p-5">
                  <EmptyState compact icon={CheckCircle2} title="Nothing outstanding" description="Every issued invoice is fully collected — no open balances to age." />
                </TD>
              </TR>
            )}
            {rows.map((r) => (
              <TR key={r.key} className={cn(r.key === "UNR" && "bg-danger-soft/60 hover:bg-danger-soft")}>
                <TD className="pl-5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    {r.category && <CategoryBadge category={r.category as CustomerCategory} />}
                  </div>
                </TD>
                {r.buckets.map((v, idx) => (
                  <TD key={idx} numeric className={cn(v ? AGING_BUCKETS[idx]!.text : "text-muted-foreground/50", idx === 0 && v && "text-foreground")}>
                    {v ? inr(v) : "—"}
                  </TD>
                ))}
                <TD numeric className="font-semibold">{inr(r.total)}</TD>
                <TD className="text-body text-muted-foreground">
                  <span className="font-mono">{r.oldest.number.slice(-3)}</span> · {r.oldest.daysOverdue ? `${r.oldest.daysOverdue}d late` : `due ${fmtDate(r.oldest.dueDate)}`}
                </TD>
                <TD numeric className="pr-5">
                  <Button size="xs" variant="outline" onClick={() => remind(r.oldest)}>
                    <BellRing /> Remind {r.reminders ? `(${r.reminders})` : ""}
                  </Button>
                </TD>
              </TR>
            ))}
            <TR className="bg-surface-secondary font-semibold hover:bg-surface-secondary [&>td]:border-t [&>td]:border-border-strong">
              <TD className="pl-5">Total</TD>
              {colTotals.map((v, idx) => (
                <TD key={idx} numeric>
                  {inr(v)}
                </TD>
              ))}
              <TD numeric>{inr(grand)}</TD>
              <TD colSpan={2} />
            </TR>
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

// ───────────────────────────── Advances ─────────────────────────────

export function AdvancesTab() {
  const advances = useBilling((s) => s.advances);
  const adjust = useBilling((s) => s.adjustAdvance);
  const log = useDemo((s) => s.log);
  const rows = advances.map((a) => {
    const adjusted = a.adjustments.reduce((s, x) => s + x.amount, 0);
    return { ...a, adjusted, balance: a.amount - adjusted, party: partyByKey(a.partyKey) };
  });
  const unadjusted = rows.reduce((s, r) => s + r.balance, 0);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Client advances</CardTitle>
          <CardDescription>Money received before invoicing · adjusted against the client&apos;s next open invoice</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-body text-muted-foreground">Unadjusted (liability)</div>
          <div className="text-subheading font-semibold tabular">{inr(unadjusted)}</div>
        </div>
      </CardHeader>
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Receipt</TH>
            <TH>Client · purpose</TH>
            <TH>Received</TH>
            <TH numeric>Amount</TH>
            <TH>Adjusted against</TH>
            <TH numeric>Balance</TH>
            <TH numeric className="pr-5" />
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="pl-5 font-mono text-body">{r.number}</TD>
              <TD>
                <div className="font-medium">{r.party.name}</div>
                <div className="text-body text-muted-foreground">{r.purpose}</div>
              </TD>
              <TD>
                <div className="tabular">{fmtDate(r.receivedOn)}</div>
                <div className="text-body text-muted-foreground">
                  {r.mode} · <span className="font-mono">{r.ref}</span>
                </div>
              </TD>
              <TD numeric>{inr(r.amount)}</TD>
              <TD>
                {r.adjustments.length ? (
                  <div className="space-y-0.5">
                    {r.adjustments.map((a) => (
                      <div key={a.invoiceNo + a.date} className="text-body">
                        <span className="font-mono">{a.invoiceNo}</span> <span className="text-muted-foreground tabular">· {inr(a.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-body text-muted-foreground">Not yet adjusted</span>
                )}
              </TD>
              <TD numeric className={cn("font-medium", r.balance ? "text-foreground" : "text-muted-foreground")}>{r.balance ? inr(r.balance) : "—"}</TD>
              <TD numeric className="pr-5">
                {r.balance > 0 ? (
                  <Button
                    size="xs"
                    variant="soft"
                    onClick={() => {
                      const res = adjust(r.id);
                      if (res) {
                        toast.success(`${inr(res.amount)} adjusted against ${res.invoiceNo}`, { description: `${r.party.name} · advance ${r.number}` });
                        log(`Advance ${r.number} (${r.party.name}) adjusted ${inr(res.amount)} against ${res.invoiceNo}`, "accent");
                      } else {
                        toast("No open invoice for this client", { description: "The advance will auto-adjust on the next invoice raised" });
                      }
                    }}
                  >
                    <ArrowRightLeft /> Adjust
                  </Button>
                ) : (
                  <Badge tone="success">
                    <CheckCircle2 /> Fully adjusted
                  </Badge>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

// ───────────────────────────── Credit notes ─────────────────────────────

export function CreditNotesTab() {
  const notes = useBilling((s) => s.creditNotes);
  const approve = useBilling((s) => s.approveCreditNote);
  const log = useDemo((s) => s.log);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Credit notes</CardTitle>
          <CardDescription>Issued under Sec. 34 CGST Act · reduce the original invoice&apos;s balance and GST liability</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => toast("Credit note request sent to Finance Desk", { description: "Credit notes need founder approval before they reduce an invoice balance" })}>
          <FileMinus2 /> New credit note
        </Button>
      </CardHeader>
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Credit note</TH>
            <TH>Client · against</TH>
            <TH>Reason</TH>
            <TH numeric>Taxable</TH>
            <TH numeric>Incl. GST</TH>
            <TH>Status</TH>
            <TH numeric className="pr-5" />
          </TR>
        </THead>
        <TBody>
          {notes.map((n) => {
            const party = partyByKey(n.partyKey);
            const gross = gstSplit(n.taxable, party.interState).total;
            return (
              <TR key={n.id} className={cn(n.status === "draft" && "bg-warning-soft/40")}>
                <TD className="pl-5">
                  <div className="font-mono text-body">{n.number}</div>
                  <div className="text-body text-muted-foreground">{fmtDate(n.date)}</div>
                </TD>
                <TD>
                  <div className="font-medium">{party.name}</div>
                  <div className="font-mono text-body text-muted-foreground">{n.invoiceNo}</div>
                </TD>
                <TD className="max-w-[340px]">
                  <div className="text-body">{n.reason}</div>
                  <div className="text-body text-muted-foreground">Raised by {n.raisedBy}</div>
                </TD>
                <TD numeric>{inr(n.taxable)}</TD>
                <TD numeric className="font-medium">{inr(gross)}</TD>
                <TD>
                  <Badge tone={n.status === "applied" ? "success" : "warning"} dot>
                    {n.status === "applied" ? "Applied" : "Awaiting approval"}
                  </Badge>
                </TD>
                <TD numeric className="pr-5">
                  {n.status === "draft" && (
                    <Button
                      size="xs"
                      variant="accent"
                      onClick={() => {
                        approve(n.id);
                        toast.success(`${n.number} approved & applied`, { description: `${inr(gross)} reduced from ${n.invoiceNo} · ${party.name}` });
                        log(`Credit note ${n.number} (${inr(gross)}) applied to ${n.invoiceNo} — ${party.name}`, "warning");
                      }}
                    >
                      Approve & apply
                    </Button>
                  )}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </Card>
  );
}
