"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BellRing, CheckCircle2, FilePlus2, IndianRupee, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CategoryBadge } from "@/components/shared/video-bits";
import { TODAY } from "@/lib/mock/core";
import { billingParties, gstSplit, partyByKey, type PaymentMode } from "@/lib/mock/finance";
import { useDemo } from "@/lib/store";
import type { CustomerCategory } from "@/lib/types";
import { cn, fmtDate, inr } from "@/lib/utils";
import { statusMeta, useBilling, type InvoiceView } from "./store";

const MODES: PaymentMode[] = ["UPI", "NEFT", "Cheque", "Cash"];

// ───────────────────────────── Send reminder ─────────────────────────────

export function useSendReminder() {
  const sendReminder = useBilling((s) => s.sendReminder);
  const log = useDemo((s) => s.log);
  return (inv: InvoiceView) => {
    sendReminder(inv.id);
    const n = inv.reminders + 1;
    toast.success(`Reminder #${n} sent to ${inv.partyName}`, {
      description: `${inv.number} · ${inr(inv.balance)} ${inv.daysOverdue ? `· ${inv.daysOverdue} days overdue` : "due " + fmtDate(inv.dueDate)} — WhatsApp + email`,
    });
    log(`Payment reminder #${n} sent to ${inv.partyName} for ${inv.number} (${inr(inv.balance)})`, inv.daysOverdue > 30 ? "danger" : "warning");
  };
}

// ───────────────────────────── Record payment ─────────────────────────────

export function RecordPaymentDialog({ invoice, open, onOpenChange }: { invoice: InvoiceView | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{invoice && <RecordPaymentForm key={invoice.id + invoice.balance} invoice={invoice} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function RecordPaymentForm({ invoice, onDone }: { invoice: InvoiceView; onDone: () => void }) {
  const recordPayment = useBilling((s) => s.recordPayment);
  const log = useDemo((s) => s.log);
  const [amount, setAmount] = useState(String(invoice.balance));
  const [mode, setMode] = useState<PaymentMode>("NEFT");
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(TODAY);
  const [tdsOn, setTdsOn] = useState(false);
  const [tds, setTds] = useState(String(Math.round(invoice.taxable * 0.02)));

  const amt = Number(amount) || 0;
  const tdsAmt = tdsOn ? Number(tds) || 0 : 0;
  const settled = amt + tdsAmt;
  const remaining = invoice.balance - settled;
  const invalid = amt <= 0 || settled > invoice.balance + 1;

  const onTds = (on: boolean) => {
    setTdsOn(on);
    const t = Math.round(invoice.taxable * 0.02);
    // keep the invoice fully settled when TDS is toggled on a full payment
    if (on && amt === invoice.balance) setAmount(String(invoice.balance - t));
    if (!on && amt === invoice.balance - t) setAmount(String(invoice.balance));
  };

  const submit = () => {
    if (invalid) return;
    recordPayment(invoice.id, {
      date,
      amount: amt,
      tds: tdsAmt,
      mode,
      ref: ref || (mode === "UPI" ? "UPI/6241" + Math.floor(10000000 + Math.random() * 89999999) : mode === "Cash" ? "Cash receipt" : "—"),
    });
    const full = remaining <= 0;
    toast.success(full ? `${invoice.number} marked paid` : `Part payment recorded on ${invoice.number}`, {
      description: full
        ? `${inr(amt)} via ${mode}${tdsAmt ? ` + TDS ${inr(tdsAmt)}` : ""} · receipt emailed to ${invoice.partyName}`
        : `${inr(amt)} via ${mode} · balance ${inr(remaining)} still open`,
    });
    log(`${invoice.partyName} paid ${inr(amt)} against ${invoice.number}${full ? " — fully settled" : ""}`, "success");
    onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>
          {invoice.number} · {invoice.partyName} · balance <span className="font-medium text-foreground tabular">{inr(invoice.balance)}</span>
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount received (₹)" hint="Edit for a part payment">
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular" />
          </Field>
          <Field label="Received on">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)} options={MODES.map((m) => ({ value: m, label: m }))} />
          </Field>
          <Field label="Reference no.">
            <Input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder={mode === "Cheque" ? "Cheque no. · bank" : mode === "NEFT" ? "UTR number" : mode === "UPI" ? "UPI txn id" : "Receipt no."}
            />
          </Field>
        </div>
        <div className="rounded-xl border border-border p-3">
          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox checked={tdsOn} onCheckedChange={(v) => onTds(v === true)} />
            <span className="text-body font-medium">Client deducted TDS</span>
            <span className="text-body text-muted-foreground">(2% u/s 194C on taxable value)</span>
          </label>
          {tdsOn && (
            <div className="mt-3 flex items-center gap-3">
              <Label className="shrink-0 text-body text-muted-foreground">TDS amount (₹)</Label>
              <Input type="number" value={tds} onChange={(e) => setTds(e.target.value)} className="h-8 w-36 tabular" />
              <span className="text-body text-muted-foreground">Claim in Form 26AS</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-3 text-body">
          <div>
            <div className="text-muted-foreground">Settled now</div>
            <div className="font-semibold tabular">{inr(settled)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Balance after</div>
            <div className={cn("font-semibold tabular", remaining > 0 ? "text-warning" : "text-success")}>{inr(Math.max(0, remaining))}</div>
          </div>
          <div>
            <div className="text-muted-foreground">New status</div>
            <div className="mt-0.5">
              {invalid ? (
                <Badge tone="danger">Exceeds balance</Badge>
              ) : remaining <= 0 ? (
                <Badge tone="success" dot>Paid</Badge>
              ) : (
                <Badge tone="warning" dot>Partially paid</Badge>
              )}
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="accent" size="sm" disabled={invalid} onClick={submit}>
          <IndianRupee /> Record {inr(amt)}
        </Button>
      </DialogFooter>
    </>
  );
}

// ───────────────────────────── New invoice ─────────────────────────────

export function NewInvoiceButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
        <FilePlus2 /> New invoice
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">{open && <NewInvoiceForm onDone={() => setOpen(false)} />}</DialogContent>
      </Dialog>
    </>
  );
}

function addDays(iso: string, d: number) {
  const dt = new Date(iso);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}

function NewInvoiceForm({ onDone }: { onDone: () => void }) {
  const addInvoice = useBilling((s) => s.addInvoice);
  const nextNo = useBilling((s) => Math.max(...s.invoices.map((i) => Number(i.number.slice(-3)))) + 1);
  const log = useDemo((s) => s.log);
  const [partyKey, setPartyKey] = useState("KVR");
  const [period, setPeriod] = useState("Oct 2026");
  const [description, setDescription] = useState("Growth Video Pack — monthly retainer (advance)");
  const [taxable, setTaxable] = useState("85000");
  const [terms, setTerms] = useState("15");
  const party = partyByKey(partyKey);
  const t = Number(taxable) || 0;
  const split = gstSplit(t, party.interState);
  const number = `GM/26-27/${String(nextNo).padStart(3, "0")}`;

  const submit = () => {
    if (t <= 0 || !description.trim()) return;
    addInvoice({ partyKey, period, description, taxable: t, dueDate: addDays(TODAY, Number(terms)) });
    toast.success(`${number} saved as draft`, { description: `${party.name} · ${inr(split.total)} incl. GST — review and click Issue to send` });
    log(`Draft invoice ${number} created for ${party.name} (${inr(split.total)})`, "accent");
    onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>New invoice</DialogTitle>
        <DialogDescription>
          Next number <span className="font-mono text-foreground">{number}</span> · GST is calculated from the client&apos;s state
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client" className="col-span-2">
            <Select
              value={partyKey}
              onValueChange={setPartyKey}
              options={billingParties.map((p) => ({ value: p.key, label: `${p.name} · ${p.city}${p.interState ? ` (${p.state})` : ""}` }))}
            />
          </Field>
          <Field label="Cycle / period">
            <Select value={period} onValueChange={setPeriod} options={["Sep 2026", "Oct 2026", "Nov 2026", "One-off project"].map((v) => ({ value: v, label: v }))} />
          </Field>
          <Field label="Payment terms">
            <Select value={terms} onValueChange={setTerms} options={[{ value: "7", label: "Net 7" }, { value: "15", label: "Net 15" }, { value: "30", label: "Net 30" }]} />
          </Field>
          <Field label="Description" className="col-span-2">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Taxable value (₹)" hint="SAC 998386 · Photography & videography services">
            <Input type="number" value={taxable} onChange={(e) => setTaxable(e.target.value)} className="tabular" />
          </Field>
          <Field label="Place of supply">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-input bg-muted/50 px-3 text-body">
              {party.state} <Badge tone={party.interState ? "gold" : "neutral"}>{party.interState ? "Inter-state" : "Intra-state"}</Badge>
            </div>
          </Field>
        </div>
        <div className="rounded-xl border border-border">
          <Row label="Taxable value" value={inr(t)} />
          {party.interState ? (
            <Row label="IGST @ 18%" value={inr(split.igst)} />
          ) : (
            <>
              <Row label="CGST @ 9%" value={inr(split.cgst)} />
              <Row label="SGST @ 9%" value={inr(split.sgst)} />
            </>
          )}
          <Row label="Invoice total" value={inr(split.total)} strong />
        </div>
        <p className="text-body text-muted-foreground">GSTIN {party.gstin} · due {fmtDate(addDays(TODAY, Number(terms)), { day: "numeric", month: "short", year: "numeric" })}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="accent" size="sm" onClick={submit} disabled={t <= 0}>
          Save draft {number}
        </Button>
      </DialogFooter>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between px-3.5 py-2 text-body", strong ? "border-t border-border font-semibold" : "text-muted-foreground")}>
      <span>{label}</span>
      <span className={cn("tabular", !strong && "text-foreground")}>{value}</span>
    </div>
  );
}

// ───────────────────────────── Invoice detail (slide-over) ─────────────────────────────

export function InvoiceSheet({
  invoice,
  onOpenChange,
  onRecordPayment,
}: {
  invoice: InvoiceView | null;
  onOpenChange: (o: boolean) => void;
  onRecordPayment: (inv: InvoiceView) => void;
}) {
  const remind = useSendReminder();
  const issue = useBilling((s) => s.issueInvoice);
  const log = useDemo((s) => s.log);
  const party = invoice ? partyByKey(invoice.partyKey) : null;
  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent side="right">
        {invoice && party && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle className="font-mono">{invoice.number}</DialogTitle>
                <Badge tone={statusMeta[invoice.status].tone} dot>
                  {statusMeta[invoice.status].label}
                </Badge>
              </div>
              <DialogDescription>
                Issued {fmtDate(invoice.issueDate, { day: "numeric", month: "short", year: "numeric" })} · due{" "}
                {fmtDate(invoice.dueDate, { day: "numeric", month: "short", year: "numeric" })}
                {invoice.daysOverdue > 0 && <span className="font-medium text-danger"> · {invoice.daysOverdue} days overdue</span>}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-5">
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-border p-4 text-body">
                <div>
                  <div className="text-body text-muted-foreground">Billed to</div>
                  <div className="mt-0.5 font-medium">{party.name}</div>
                  <div className="text-muted-foreground">
                    {party.city}, {party.state}
                  </div>
                  <div className="mt-1 font-mono text-body text-muted-foreground">GSTIN {party.gstin}</div>
                </div>
                <div>
                  <div className="text-body text-muted-foreground">From</div>
                  <div className="mt-0.5 font-medium">Genie Magnet</div>
                  <div className="text-muted-foreground">Appakudal, Erode, Tamil Nadu</div>
                  <div className="mt-1 font-mono text-body text-muted-foreground">GSTIN 33AAQFG7120K1Z4</div>
                </div>
                {invoice.category && (
                  <div className="col-span-2 flex items-center gap-2 border-t border-border pt-3 text-body text-muted-foreground">
                    Customer category <CategoryBadge category={invoice.category as CustomerCategory} />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border">
                <div className="flex items-start justify-between gap-3 px-3.5 py-3 text-body">
                  <div>
                    <div className="font-medium">{invoice.description}</div>
                    <div className="text-body text-muted-foreground">Cycle {invoice.period} · SAC 998386</div>
                  </div>
                  <div className="tabular font-medium">{inr(invoice.taxable)}</div>
                </div>
                <div className="border-t border-border">
                  {invoice.interState ? (
                    <Row label="IGST @ 18%" value={inr(invoice.igst)} />
                  ) : (
                    <>
                      <Row label="CGST @ 9%" value={inr(invoice.cgst)} />
                      <Row label="SGST @ 9%" value={inr(invoice.sgst)} />
                    </>
                  )}
                  <Row label="Invoice total" value={inr(invoice.total)} strong />
                  {invoice.creditAdj > 0 && <Row label="Less: credit notes" value={`− ${inr(invoice.creditAdj)}`} />}
                  {invoice.received > 0 && <Row label="Less: received (incl. TDS)" value={`− ${inr(invoice.received)}`} />}
                  <Row label="Balance due" value={inr(invoice.balance)} strong />
                </div>
              </div>

              <div>
                <div className="mb-2 text-body font-semibold">Payments</div>
                {invoice.payments.length === 0 ? (
                  <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-body text-muted-foreground">No payments received yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {invoice.payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-body">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-success" />
                          <span>{fmtDate(p.date)}</span>
                          <Badge tone="neutral">{p.mode}</Badge>
                          <span className="truncate font-mono text-body text-muted-foreground">{p.ref}</span>
                        </div>
                        <div className="text-right tabular">
                          {inr(p.amount)}
                          {p.tds > 0 && <div className="text-body text-muted-foreground">+ TDS {inr(p.tds)}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-body text-muted-foreground">
                <BellRing className="size-4" />
                {invoice.reminders ? (
                  <>
                    {invoice.reminders} reminder{invoice.reminders > 1 ? "s" : ""} sent · last on {fmtDate(invoice.lastReminder ?? TODAY)}
                  </>
                ) : (
                  "No reminders sent"
                )}
              </div>
            </DialogBody>
            <DialogFooter>
              {invoice.status === "draft" ? (
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => {
                    issue(invoice.id);
                    toast.success(`${invoice.number} issued`, { description: `Emailed to ${party.name} with e-invoice IRN` });
                    log(`Invoice ${invoice.number} issued to ${party.name}`, "accent");
                  }}
                >
                  <Send /> Issue invoice
                </Button>
              ) : invoice.balance > 0 ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => remind(invoice)}>
                    <BellRing /> Send reminder
                  </Button>
                  <Button variant="accent" size="sm" onClick={() => onRecordPayment(invoice)}>
                    <IndianRupee /> Record payment
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success("Payment receipt re-sent", { description: `${invoice.number} receipt emailed to ${party.name}` })}
                >
                  <Send /> Re-send receipt
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
