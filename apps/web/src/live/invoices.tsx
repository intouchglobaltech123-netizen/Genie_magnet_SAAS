"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, CheckCircle2, Copy, FileText, Pencil, Plus, Printer, ReceiptIndianRupee, Send, Settings, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { type Agreement, type Invoice, invoiceLine, type InvoiceSettings, stateName } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtDate } from "./format";
import { ApiError, errorMessage } from "./api";
import { NoteDialog } from "./deals";
import { inr } from "./packages";
import {
  useAgreements,
  useCan,
  useClients,
  useInvoice,
  useInvoiceAgreementMonth,
  useInvoices,
  useInvoiceSettings,
  useInvoiceStep,
  useRequestPayLink,
  useSaveInvoice,
} from "./queries";

export const INVOICE_STATUS: Record<Invoice["status"], { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent · unpaid", tone: "info" },
  paid: { label: "Paid", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function InvoiceBadge({ inv }: { inv: Pick<Invoice, "status" | "overdue"> }) {
  return inv.overdue ? (
    <Badge tone="danger" dot>
      Overdue
    </Badge>
  ) : (
    <Badge tone={INVOICE_STATUS[inv.status].tone} dot>
      {INVOICE_STATUS[inv.status].label}
    </Badge>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const periodLabel = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
const thisMonth = () => new Date().toISOString().slice(0, 7);

// ─── Lines ────────────────────────────────────────────────────────────

type Line = { description: string; sac: string; quantity: string; rate: string; taxRate: string };
const toLines = (inv: Invoice): Line[] =>
  inv.lines.map((l) => ({ description: l.description, sac: l.sac, quantity: String(l.quantity), rate: String(l.rate), taxRate: String(l.taxRate) }));
const fromLines = (lines: Line[]) =>
  lines.map((l) => ({ description: l.description, sac: l.sac, quantity: Number(l.quantity), rate: Number(l.rate), taxRate: Number(l.taxRate) }));

/** Invoice lines; choosing one of the agency's services fills in its SAC code and GST rate. */
function LinesEditor({
  lines,
  onChange,
  services,
  errors,
}: {
  lines: Line[];
  onChange: (l: Line[]) => void;
  services: InvoiceSettings["services"];
  errors: Record<string, string>;
}) {
  const setLine = (i: number, patch: Partial<Line>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const blank = (): Line => ({ description: "", sac: services[0]?.sac ?? "", quantity: "1", rate: "", taxRate: String(services[0]?.rate ?? 18) });
  return (
    <div className="space-y-3">
      {lines.map((l, i) => {
        const err = ["description", "sac", "quantity", "rate", "taxRate"].map((k) => errors[`lines.${i}.${k}`]).find(Boolean);
        return (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="flex items-start gap-2">
              <Textarea
                rows={1}
                aria-label="Description"
                placeholder="What is billed, e.g. Reels for November"
                value={l.description}
                onChange={(e) => setLine(i, { description: e.target.value })}
                className="min-h-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove this line"
                disabled={lines.length === 1}
                onClick={() => onChange(lines.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_80px_120px]">
              <Select
                aria-label="Service"
                value={services.find((s) => s.sac === l.sac && String(s.rate) === l.taxRate)?.sac ?? "_other"}
                onValueChange={(sac) => {
                  const s = services.find((x) => x.sac === sac);
                  if (s) setLine(i, { sac: s.sac, taxRate: String(s.rate) });
                }}
                options={[
                  ...services.map((s) => ({ value: s.sac, label: `${s.name} · SAC ${s.sac} · ${s.rate}%` })),
                  ...(services.some((s) => s.sac === l.sac) ? [] : [{ value: "_other", label: `SAC ${l.sac || "—"} · ${l.taxRate}%` }]),
                ]}
              />
              <Input aria-label="Quantity" type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
              <Input
                aria-label="Price of one (₹)"
                type="number"
                min={0}
                placeholder="₹ each"
                value={l.rate}
                onChange={(e) => setLine(i, { rate: e.target.value })}
              />
            </div>
            {err && <p className="mt-1 text-body text-danger">{err}</p>}
          </div>
        );
      })}
      {errors.lines && <p className="text-body text-danger">{errors.lines}</p>}
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...lines, blank()])}>
        <Plus />
        Add a line
      </Button>
    </div>
  );
}

const lineErrors = (issues: { path: string; message: string }[]) => Object.fromEntries(issues.map((i) => [i.path, i.message]));

// ─── New invoice ──────────────────────────────────────────────────────

/** A draft: one month of an agreement's fee, or lines written out. */
export function NewInvoiceDialog({
  open,
  onOpenChange,
  clientId: fixedClient,
  agreement: fixedAgreement,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId?: string;
  agreement?: Agreement;
}) {
  const router = useRouter();
  const settings = useInvoiceSettings();
  const clients = useClients(!fixedClient);
  const [clientId, setClientId] = useState(fixedClient ?? "");
  const agreements = useAgreements(clientId ? `clientId=${clientId}` : "", !!clientId && !fixedAgreement);
  const fromAgreement = useInvoiceAgreementMonth();
  const save = useSaveInvoice();
  const [mode, setMode] = useState<"agreement" | "lines">(fixedAgreement ? "agreement" : "agreement");
  const [agreementId, setAgreementId] = useState(fixedAgreement?.id ?? "");
  const [period, setPeriod] = useState(thisMonth());
  const services = settings.data?.services ?? [{ name: "Services", sac: "998361", rate: 18 as const }];
  const [lines, setLines] = useState<Line[]>([{ description: "", sac: services[0]!.sac, quantity: "1", rate: "", taxRate: String(services[0]!.rate) }]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const running = fixedAgreement ? [fixedAgreement] : (agreements.data ?? []).filter((a) => a.status === "active" || a.status === "paused");
  const busy = fromAgreement.isPending || save.isPending;
  const done = (inv: Invoice) => {
    toast.success("Draft invoice made", { description: "Check it, then issue it to give it its number." });
    onOpenChange(false);
    router.push(`/app/invoices/${inv.id}`);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return setErrors({ clientId: "Choose the client" });
    if (mode === "agreement") {
      if (!agreementId) return setErrors({ agreementId: "Choose the agreement" });
      return fromAgreement.mutate(
        { agreementId, period },
        { onSuccess: done, onError: (err) => err instanceof ApiError && err.body.issues && setErrors(lineErrors(err.body.issues)) },
      );
    }
    const parsed = invoiceLine.array().min(1).safeParse(fromLines(lines));
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [`lines.${i.path.join(".")}`, i.message])));
    setErrors({});
    save.mutate(
      { input: { clientId, lines: parsed.data, notes: notes || undefined } },
      { onSuccess: done, onError: (err) => err instanceof ApiError && err.body.issues && setErrors(lineErrors(err.body.issues)) },
    );
  };
  const error = fromAgreement.error ?? save.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New invoice</DialogTitle>
            <DialogDescription>Made as a draft. It gets its number when someone who may approve invoices issues it.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {settings.data === null && (
              <Alert tone="warning" icon={Settings}>
                Your invoice details are not set up yet. You can draft invoices, but they cannot be issued until{" "}
                <Link href="/app/settings/invoices" className="underline">
                  Invoice settings
                </Link>{" "}
                are filled in.
              </Alert>
            )}
            {!fixedClient && (
              <Field label="Client" required error={errors.clientId}>
                <Select
                  aria-label="Client"
                  value={clientId || undefined}
                  placeholder="Choose the client"
                  onValueChange={(v) => {
                    setClientId(v);
                    setAgreementId("");
                  }}
                  options={(clients.data ?? []).filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                />
              </Field>
            )}
            {!fixedAgreement && (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What to bill">
                {(
                  [
                    ["agreement", "A month of an agreement"],
                    ["lines", "Write the lines"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={mode === k}
                    onClick={() => setMode(k)}
                    className={cn(
                      "cursor-pointer rounded-full border px-3 py-1 text-body transition-colors",
                      mode === k ? "border-primary bg-primary-soft text-primary" : "border-border text-text-secondary hover:border-secondary/40",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {mode === "agreement" ? (
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                <Field
                  label="Agreement"
                  required
                  error={errors.agreementId}
                  hint={clientId && !running.length && !agreements.isPending ? "This client has no running agreement — write the lines instead." : undefined}
                >
                  <Select
                    aria-label="Agreement"
                    value={agreementId || undefined}
                    placeholder={clientId ? "Choose the agreement" : "Choose the client first"}
                    disabled={!clientId || !!fixedAgreement}
                    onValueChange={setAgreementId}
                    options={running.map((a) => ({ value: a.id, label: `${a.title} · ${inr(a.monthlyFee)} a month` }))}
                  />
                </Field>
                <Field label="Month" required error={errors.period}>
                  <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
                </Field>
              </div>
            ) : (
              <>
                <LinesEditor lines={lines} onChange={setLines} services={services} errors={errors} />
                <Field label="Note on the invoice">
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </>
            )}
            {error && !(error instanceof ApiError && error.body.issues) && <Alert tone="danger">{errorMessage(error)}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              <FileText />
              {busy ? "Making…" : "Make the draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDraftDialog({ inv, open, onOpenChange }: { inv: Invoice; open: boolean; onOpenChange: (o: boolean) => void }) {
  const settings = useInvoiceSettings();
  const save = useSaveInvoice();
  const [lines, setLines] = useState<Line[]>(() => toLines(inv));
  const [notes, setNotes] = useState(inv.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = invoiceLine.array().min(1).safeParse(fromLines(lines));
            if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [`lines.${i.path.join(".")}`, i.message])));
            setErrors({});
            save.mutate(
              { id: inv.id, input: { lines: parsed.data, notes } },
              {
                onSuccess: () => {
                  toast.success("Draft saved");
                  onOpenChange(false);
                },
                onError: (err) => err instanceof ApiError && err.body.issues && setErrors(lineErrors(err.body.issues)),
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Change the draft</DialogTitle>
            <DialogDescription>GST is worked out again from the lines and the client&apos;s state.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <LinesEditor lines={lines} onChange={setLines} services={settings.data?.services ?? []} errors={errors} />
            <Field label="Note on the invoice">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            {save.error && !(save.error instanceof ApiError && save.error.body.issues) && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* eslint-disable no-restricted-syntax -- a printed A4 document keeps its own type sizes (see eslint.config.mjs) */
// ─── The invoice document ─────────────────────────────────────────────

/** Rates shown next to a tax when every line has the same rate. */
const oneRate = (inv: Invoice) => (new Set(inv.lines.map((l) => l.taxRate)).size === 1 ? inv.lines[0]!.taxRate : null);

/**
 * The invoice as printed: always dark text on white paper (also in dark mode), so "Download PDF" (the browser's print
 * to PDF) looks the same as the screen.
 */
export function InvoiceDocument({ inv }: { inv: Invoice }) {
  const s = inv.seller;
  const rate = oneRate(inv);
  const brand = s?.brandColor ?? "#1E3A8A";
  const title = !inv.registered ? "Invoice" : "Tax invoice";
  return (
    <article className="relative mx-auto max-w-[820px] rounded-xl bg-white p-8 text-[13px] leading-relaxed text-neutral-900 shadow-card print:max-w-none print:rounded-none print:p-0 print:shadow-none sm:p-10">
      {inv.status === "draft" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
          <span className="-rotate-12 select-none text-[96px] font-bold tracking-widest text-neutral-200/70">DRAFT</span>
        </div>
      )}
      {inv.status === "cancelled" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
          <span className="-rotate-12 select-none text-[80px] font-bold tracking-widest text-red-200/70">CANCELLED</span>
        </div>
      )}
      <div className="relative">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 pb-5" style={{ borderColor: brand }}>
          <div className="flex items-start gap-3">
            {s?.logo && (
              // eslint-disable-next-line @next/next/no-img-element -- the agency's logo, a small data URL
              <img src={s.logo} alt="" className="size-14 rounded object-contain" />
            )}
            <div>
              <div className="text-[17px] font-bold">{s?.legalName ?? "Your business name"}</div>
              <div className="whitespace-pre-line text-neutral-600">{s?.address ?? "Set up your invoice details to show your address here."}</div>
              {s?.gstin && <div className="text-neutral-600">GSTIN: {s.gstin}</div>}
              {s?.state && (
                <div className="text-neutral-600">
                  State: {stateName(s.state)} ({s.state})
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[20px] font-bold uppercase tracking-wide" style={{ color: brand }}>
              {title}
            </div>
            <dl className="mt-1 grid grid-cols-[auto_auto] justify-end gap-x-3 text-neutral-700">
              <dt>Number</dt>
              <dd className="font-semibold text-neutral-900">{inv.number ?? "Given when issued"}</dd>
              <dt>Date</dt>
              <dd>{inv.issueDate ? fmtDate(inv.issueDate) : "—"}</dd>
              <dt>Due</dt>
              <dd>{inv.dueDate ? fmtDate(inv.dueDate) : "—"}</dd>
              {inv.period && (
                <>
                  <dt>For</dt>
                  <dd>{periodLabel(inv.period)}</dd>
                </>
              )}
            </dl>
          </div>
        </header>

        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Billed to</div>
            <div className="font-semibold">{inv.billedTo.name}</div>
            {inv.billedTo.address && <div className="whitespace-pre-line text-neutral-600">{inv.billedTo.address}</div>}
            {inv.billedTo.gstin && <div className="text-neutral-600">GSTIN: {inv.billedTo.gstin}</div>}
          </div>
          <div className="sm:text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Place of supply</div>
            <div>{inv.placeOfSupply ? `${stateName(inv.placeOfSupply)} (${inv.placeOfSupply})` : "—"}</div>
          </div>
        </section>

        <table className="mt-6 w-full border-collapse">
          <thead>
            <tr className="border-y border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-2 font-semibold">#</th>
              <th className="py-2 pr-2 font-semibold">Description</th>
              <th className="py-2 pr-2 font-semibold">SAC</th>
              <th className="py-2 pr-2 text-right font-semibold">Qty</th>
              <th className="py-2 pr-2 text-right font-semibold">Rate</th>
              {inv.registered && rate === null && <th className="py-2 pr-2 text-right font-semibold">GST</th>}
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i} className="border-b border-neutral-200 align-top">
                <td className="py-2 pr-2 text-neutral-500">{i + 1}</td>
                <td className="py-2 pr-2">{l.description}</td>
                <td className="py-2 pr-2 tabular-nums text-[12px]">{l.sac}</td>
                <td className="py-2 pr-2 text-right">{l.quantity}</td>
                <td className="py-2 pr-2 text-right">{inr(l.rate)}</td>
                {inv.registered && rate === null && <td className="py-2 pr-2 text-right">{l.taxRate}%</td>}
                <td className="py-2 text-right">{inr(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 flex justify-end">
          <dl className="grid min-w-[260px] grid-cols-[1fr_auto] gap-x-6 gap-y-1">
            <dt className="text-neutral-600">Taxable value</dt>
            <dd className="text-right">{inr(inv.taxable)}</dd>
            {inv.registered && inv.intraState && (
              <>
                <dt className="text-neutral-600">CGST{rate !== null && ` @ ${rate / 2}%`}</dt>
                <dd className="text-right">{inr(inv.cgst)}</dd>
                <dt className="text-neutral-600">SGST{rate !== null && ` @ ${rate / 2}%`}</dt>
                <dd className="text-right">{inr(inv.sgst)}</dd>
              </>
            )}
            {inv.registered && !inv.intraState && (
              <>
                <dt className="text-neutral-600">IGST{rate !== null && ` @ ${rate}%`}</dt>
                <dd className="text-right">{inr(inv.igst)}</dd>
              </>
            )}
            <dt className="border-t border-neutral-300 pt-1 font-bold">Total</dt>
            <dd className="border-t border-neutral-300 pt-1 text-right text-[15px] font-bold">{inr(inv.total)}</dd>
          </dl>
        </section>
        <p className="mt-2 text-right italic text-neutral-600">{inv.totalInWords}</p>

        {inv.notes && <p className="mt-4 whitespace-pre-line">{inv.notes}</p>}

        {s && (s.bankName || s.accountNumber || s.upiId) && (
          <section className="mt-6 rounded-lg border border-neutral-200 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">How to pay</div>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4">
              {s.accountName && (
                <>
                  <dt className="text-neutral-600">Account name</dt>
                  <dd>{s.accountName}</dd>
                </>
              )}
              {s.bankName && (
                <>
                  <dt className="text-neutral-600">Bank</dt>
                  <dd>{s.bankName}</dd>
                </>
              )}
              {s.accountNumber && (
                <>
                  <dt className="text-neutral-600">Account number</dt>
                  <dd className="tabular-nums">{s.accountNumber}</dd>
                </>
              )}
              {s.ifsc && (
                <>
                  <dt className="text-neutral-600">IFSC</dt>
                  <dd className="tabular-nums">{s.ifsc}</dd>
                </>
              )}
              {s.upiId && (
                <>
                  <dt className="text-neutral-600">UPI</dt>
                  <dd className="tabular-nums">{s.upiId}</dd>
                </>
              )}
            </dl>
          </section>
        )}
        {!inv.registered && <p className="mt-4 text-neutral-500">Not registered under GST — no GST is charged.</p>}
        {s?.footer && <p className="mt-6 border-t border-neutral-200 pt-3 text-center text-neutral-500">{s.footer}</p>}
      </div>
    </article>
  );
}
/* eslint-enable no-restricted-syntax */

// ─── One invoice ──────────────────────────────────────────────────────

function IssueDialog({ inv, open, onOpenChange, onIssued }: { inv: Invoice; open: boolean; onOpenChange: (o: boolean) => void; onIssued: () => void }) {
  const step = useInvoiceStep();
  const settings = useInvoiceSettings();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            step.mutate(
              { id: inv.id, step: "issue", issueDate: date },
              {
                onSuccess: (r) => {
                  toast.success(`Issued as ${r!.number}`, { description: "Download the PDF to send it to the client." });
                  onIssued();
                  onOpenChange(false);
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Issue this invoice</DialogTitle>
            <DialogDescription>
              It gets {settings.data ? <strong>{settings.data.nextNumberPreview}</strong> : "the next number"}, and its details are fixed: an issued invoice is
              never changed, only cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Invoice date" hint={settings.data ? `Due ${settings.data.paymentTermsDays} days later.` : undefined}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {!inv.billedTo.state && (
              <Alert tone="warning">
                The client has no state set, so it is taken as within your state (CGST + SGST). Set it on the client first if that is wrong.
              </Alert>
            )}
            {step.error && <Alert tone="danger">{errorMessage(step.error)}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={step.isPending}>
              <Send />
              Issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaidDialog({ inv, open, onOpenChange }: { inv: Invoice; open: boolean; onOpenChange: (o: boolean) => void }) {
  const step = useInvoiceStep();
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            step.mutate(
              { id: inv.id, step: "paid", input: { paidOn, note } },
              {
                onSuccess: () => {
                  toast.success(`${inv.number} marked as paid`);
                  onOpenChange(false);
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Record the payment</DialogTitle>
            <DialogDescription>
              {inr(inv.total)} from {inv.billedTo.name}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Paid on">
              <Input type="date" min={inv.issueDate ?? undefined} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </Field>
            <Field label="Reference" hint="e.g. UPI or bank reference">
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            {step.error && (
              <Alert tone="danger" className="sm:col-span-2">
                {errorMessage(step.error)}
              </Alert>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={step.isPending}>
              <CheckCircle2 />
              Mark as paid
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The online payment link (P3-10) and payments received, when the agency takes payments through its Razorpay. */
function InvoicePayment({ inv, canEdit, waiting, onRequested }: { inv: Invoice; canEdit: boolean; waiting: boolean; onRequested: () => void }) {
  const request = useRequestPayLink();
  const link = inv.payLink;
  if (!link && !inv.payments.length && inv.status !== "sent") return null;
  const status: Record<string, string> = {
    created: "Waiting for payment",
    paid: "Paid",
    cancelled: "Switched off",
    expired: "Expired",
    failed: "Razorpay refused it",
  };
  return (
    <Card className="mb-4">
      <CardContent className="space-y-2 p-4 text-body">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">Online payment</span>
          {link?.status && (
            <Badge tone={link.status === "paid" ? "success" : link.status === "failed" ? "danger" : "neutral"}>{status[link.status] ?? link.status}</Badge>
          )}
        </div>
        {link?.url && link.status === "created" && (
          <div className="flex flex-wrap items-center gap-2">
            <a href={link.url} target="_blank" rel="noreferrer" className="tabular-nums text-primary hover:underline">
              {link.url}
            </a>
            <Button size="xs" variant="ghost" onClick={() => navigator.clipboard.writeText(link.url!).then(() => toast.success("Copied"))}>
              <Copy />
              Copy
            </Button>
          </div>
        )}
        {link?.error && <p className="text-danger">{link.error}</p>}
        {!link && inv.status === "sent" && (
          <p className="text-muted-foreground">
            {waiting
              ? "Making the payment link — it shows here in a moment."
              : "No payment link. When your Razorpay account is connected in Settings → Payments, every issued invoice gets one."}
          </p>
        )}
        {inv.payments.map((p) => (
          <p key={p.reference} className="text-muted-foreground">
            Received {inr(p.amount)} by {p.method ?? "Razorpay"} on {fmtDate(p.paidAt)} ({p.reference})
          </p>
        ))}
        {canEdit && inv.status === "sent" && !waiting && (!link || link.status === "failed" || link.status === "expired") && (
          <Button
            size="sm"
            variant="secondary"
            disabled={request.isPending}
            onClick={() =>
              request.mutate(inv.id, {
                onSuccess: () => {
                  toast.success("Making the link — it shows here in a moment");
                  onRequested();
                },
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            Make a payment link
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function LiveInvoice({ id }: { id: string }) {
  const router = useRouter();
  const can = useCan();
  // After issuing or asking for a link: look for the payment link for a while, as it is made in the background.
  const [waitForLinkUntil, setWaitForLinkUntil] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const inv = useInvoice(id, waitForLinkUntil);
  const step = useInvoiceStep();
  const [dialog, setDialog] = useState<"edit" | "issue" | "paid" | "cancel" | null>(null);
  const waitForLink = () => {
    setWaitForLinkUntil(Date.now() + 20_000);
    setWaiting(true);
  };
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setWaiting(false), 20_000);
    return () => clearTimeout(t);
  }, [waiting]);

  if (inv.isPending) return <SkeletonRows rows={8} />;
  if (inv.error) return <Alert tone="danger">{errorMessage(inv.error)}</Alert>;
  const i = inv.data;
  const canEdit = can("invoices", "edit");
  const canApprove = can("invoices", "approve");

  return (
    <>
      <div className="print:hidden">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/app/invoices">
            <ArrowLeft />
            Invoices
          </Link>
        </Button>
        <PageHeader
          eyebrow={<InvoiceBadge inv={i} />}
          title={i.number ?? `Draft for ${i.client.name}`}
          description={
            <>
              <Link href={`/app/clients/${i.client.id}`} className="hover:underline">
                {i.client.name}
              </Link>
              {i.agreement && ` · ${i.agreement.title}`}
              {i.status === "paid" && i.paidOn && ` · paid on ${fmtDate(i.paidOn)}${i.paymentNote ? ` (${i.paymentNote})` : ""}`}
              {i.status === "cancelled" && i.cancelReason && ` · cancelled: ${i.cancelReason}`}
            </>
          }
          actions={
            <>
              {i.status === "draft" && canEdit && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      step.mutate({ id, step: "delete" }, { onSuccess: () => router.push("/app/invoices"), onError: (e) => toast.error(errorMessage(e)) })
                    }
                  >
                    <Trash2 />
                    Delete
                  </Button>
                  <Button variant="secondary" onClick={() => setDialog("edit")}>
                    <Pencil />
                    Change
                  </Button>
                </>
              )}
              {i.status === "draft" && canApprove && (
                <Button onClick={() => setDialog("issue")}>
                  <Send />
                  Issue
                </Button>
              )}
              {i.status === "sent" && canApprove && (
                <Button variant="ghost" onClick={() => setDialog("cancel")}>
                  <Ban />
                  Cancel invoice
                </Button>
              )}
              {i.status === "sent" && canEdit && (
                <Button variant="success" onClick={() => setDialog("paid")}>
                  <CheckCircle2 />
                  Mark as paid
                </Button>
              )}
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer />
                {i.status === "draft" ? "Print draft" : "Download PDF"}
              </Button>
            </>
          }
        />
        {i.status === "draft" && !i.seller && (
          <Alert tone="warning" icon={Settings} className="mb-4">
            Set up your{" "}
            <Link href="/app/settings/invoices" className="underline">
              invoice details
            </Link>{" "}
            before issuing: your GSTIN, address and numbering are printed on every invoice.
          </Alert>
        )}
        {i.status === "draft" && !canApprove && (
          <Alert tone="info" className="mb-4">
            Someone who may approve invoices (finance or the owner) issues it.
          </Alert>
        )}
        {i.status !== "draft" && (
          <InvoicePayment inv={i} canEdit={canEdit} waiting={waiting && !i.payLink} onRequested={waitForLink} />
        )}
        <p className="mb-3 text-body text-muted-foreground">To save it as a PDF, choose “Save as PDF” in the print window.</p>
      </div>
      <InvoiceDocument inv={i} />
      {dialog === "edit" && <EditDraftDialog inv={i} open onOpenChange={(o) => !o && setDialog(null)} />}
      {dialog === "issue" && <IssueDialog inv={i} open onOpenChange={(o) => !o && setDialog(null)} onIssued={waitForLink} />}
      {dialog === "paid" && <PaidDialog inv={i} open onOpenChange={(o) => !o && setDialog(null)} />}
      <NoteDialog
        open={dialog === "cancel"}
        title={`Cancel ${i.number}`}
        description="It keeps its number (so numbering has no gaps) and stays in the list as cancelled. Say why."
        required
        confirm="Cancel invoice"
        onClose={() => setDialog(null)}
        onConfirm={(reason) => {
          setDialog(null);
          step.mutate({ id, step: "cancel", reason }, { onSuccess: () => toast.success("Invoice cancelled"), onError: (e) => toast.error(errorMessage(e)) });
        }}
      />
    </>
  );
}

// ─── All invoices ─────────────────────────────────────────────────────

const VIEWS = [
  { key: "all", label: "All", query: "" },
  { key: "drafts", label: "Drafts", query: "status=draft" },
  { key: "unpaid", label: "Unpaid", query: "status=sent" },
  { key: "overdue", label: "Overdue", query: "overdue=1" },
  { key: "paid", label: "Paid", query: "status=paid" },
  { key: "cancelled", label: "Cancelled", query: "status=cancelled" },
] as const;

/** A table of invoices (the Invoices page and the client page). */
export function InvoiceTable({ invoices, showClient = true }: { invoices: Invoice[]; showClient?: boolean }) {
  const router = useRouter();
  return (
    <Table>
      <THead>
        <TR>
          <TH>Number</TH>
          {showClient && <TH>Client</TH>}
          <TH>For</TH>
          <TH>Date</TH>
          <TH>Status</TH>
          <TH numeric>Total</TH>
        </TR>
      </THead>
      <TBody>
        {invoices.map((i) => (
          <TR key={i.id} className="cursor-pointer" onClick={() => router.push(`/app/invoices/${i.id}`)}>
            <TD className="whitespace-nowrap">
              <Link href={`/app/invoices/${i.id}`} className="tabular-nums font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                {i.number ?? "Draft"}
              </Link>
            </TD>
            {showClient && <TD>{i.client.name}</TD>}
            <TD>{i.period ? periodLabel(i.period) : (i.lines[0]?.description ?? "—")}</TD>
            <TD className="whitespace-nowrap">
              {i.issueDate ? fmtDate(i.issueDate) : "—"}
              {i.status === "sent" && i.dueDate && <div className={cn("text-muted-foreground", i.overdue && "text-danger")}>due {fmtDate(i.dueDate)}</div>}
            </TD>
            <TD>
              <InvoiceBadge inv={i} />
            </TD>
            <TD numeric>{inr(i.total)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export function LiveInvoices({ view: initial }: { view?: string }) {
  const router = useRouter();
  const can = useCan();
  const [view, setView] = useState<(typeof VIEWS)[number]["key"]>(() => VIEWS.find((v) => v.key === initial)?.key ?? "all");
  const current = VIEWS.find((v) => v.key === view)!;
  const list = useInvoices(current.query);
  const unpaid = useInvoices("status=sent");
  const [adding, setAdding] = useState(false);
  const outstanding = (unpaid.data ?? []).reduce((n, i) => n + i.total, 0);
  const overdue = (unpaid.data ?? []).filter((i) => i.overdue).reduce((n, i) => n + i.total, 0);

  return (
    <>
      <PageHeader
        title="Invoices"
        description="GST invoices for your clients. Draft them from an agreement's monthly fee or write the lines, then issue, send and record payment."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/app/settings/invoices">
                <Settings />
                Invoice settings
              </Link>
            </Button>
            {can("invoices", "edit") && (
              <Button onClick={() => setAdding(true)}>
                <Plus />
                New invoice
              </Button>
            )}
          </>
        }
      />
      {outstanding > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <div className="text-body text-muted-foreground">Waiting to be paid</div>
            <div className="text-subheading font-semibold">{inr(outstanding)}</div>
          </Card>
          <Card className={cn("p-4", overdue > 0 && "border-danger/40")}>
            <div className="text-body text-muted-foreground">Overdue</div>
            <div className={cn("text-subheading font-semibold", overdue > 0 && "text-danger")}>{inr(overdue)}</div>
          </Card>
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Show">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={v.key === view}
            onClick={() => {
              setView(v.key);
              router.replace(`/app/invoices?view=${v.key}`, { scroll: false });
            }}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 text-body transition-colors",
              v.key === view ? "border-primary bg-primary-soft text-primary" : "border-border text-text-secondary hover:border-secondary/40",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        {list.isPending ? (
          <div className="p-4">
            <SkeletonRows rows={5} />
          </div>
        ) : list.error ? (
          <div className="p-4">
            <Alert tone="danger">{errorMessage(list.error)}</Alert>
          </div>
        ) : !list.data.length ? (
          <EmptyState
            icon={ReceiptIndianRupee}
            title={view === "all" ? "No invoices yet" : `No ${current.label.toLowerCase()} invoices`}
            description={view === "all" ? "Draft your first one from an agreement's monthly fee." : undefined}
            action={
              view === "all" &&
              can("invoices", "edit") && (
                <Button onClick={() => setAdding(true)}>
                  <Plus />
                  New invoice
                </Button>
              )
            }
          />
        ) : (
          <InvoiceTable invoices={list.data} />
        )}
      </Card>
      {adding && <NewInvoiceDialog open onOpenChange={setAdding} />}
    </>
  );
}
