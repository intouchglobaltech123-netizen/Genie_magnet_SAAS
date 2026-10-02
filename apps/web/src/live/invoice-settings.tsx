"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  type AgencyProfile,
  DEFAULT_INVOICE_SERVICES,
  formatInvoiceNumber,
  GST_RATES,
  gstinState,
  INDIAN_STATES,
  type InvoiceSettings,
  invoiceSettingsInput,
  NUMBER_TOKENS,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ApiError, errorMessage } from "./api";
import { useAgency, useCan, useInvoiceSettings, useSaveInvoiceSettings } from "./queries";

type Service = { name: string; sac: string; rate: string };
type Form = {
  legalName: string;
  gstin: string;
  state: string;
  address: string;
  services: Service[];
  numberFormat: string;
  nextNumber: string;
  paymentTermsDays: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
  footer: string;
  autoDraft: boolean;
};

/** "Genie Magnet" → "GM/{FY}/{0000}" */
const suggestedFormat = (name: string) => {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
  return `${initials || "INV"}/{FY}/{0000}`;
};

const toForm = (s: InvoiceSettings | null, agency: AgencyProfile): Form => ({
  legalName: s?.legalName ?? agency.name,
  gstin: s?.gstin ?? "",
  state: s?.state ?? "",
  address: s?.address ?? (agency.city ? agency.city : ""),
  services: (s?.services ?? DEFAULT_INVOICE_SERVICES).map((x) => ({ name: x.name, sac: x.sac, rate: String(x.rate) })),
  numberFormat: s?.numberFormat ?? suggestedFormat(agency.name),
  nextNumber: String(s?.nextNumber ?? 1),
  paymentTermsDays: String(s?.paymentTermsDays ?? 7),
  bankName: s?.bankName ?? "",
  accountName: s?.accountName ?? "",
  accountNumber: s?.accountNumber ?? "",
  ifsc: s?.ifsc ?? "",
  upiId: s?.upiId ?? "",
  footer: s?.footer ?? "",
  autoDraft: s?.autoDraft ?? true,
});

function SettingsForm({ settings, agency, canEdit }: { settings: InvoiceSettings | null; agency: AgencyProfile; canEdit: boolean }) {
  const save = useSaveInvoiceSettings();
  const [f, setF] = useState<Form>(() => toForm(settings, agency));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const setService = (i: number, patch: Partial<Service>) => setF({ ...f, services: f.services.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const dirty = !settings || JSON.stringify(f) !== JSON.stringify(toForm(settings, agency));
  const today = new Date().toISOString().slice(0, 10);
  const next = Math.max(1, Number(f.nextNumber) || 1);
  const preview = /\{0+\}/.test(f.numberFormat) ? formatInvoiceNumber(f.numberFormat, next, today) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = invoiceSettingsInput.safeParse({
      legalName: f.legalName,
      gstin: f.gstin,
      state: f.state,
      address: f.address,
      services: f.services.map((s) => ({ name: s.name, sac: s.sac, rate: Number(s.rate) })),
      numberFormat: f.numberFormat,
      ...(next !== settings?.nextNumber && { nextNumber: next }),
      paymentTermsDays: Number(f.paymentTermsDays),
      bankName: f.bankName,
      accountName: f.accountName,
      accountNumber: f.accountNumber,
      ifsc: f.ifsc,
      upiId: f.upiId,
      footer: f.footer,
      autoDraft: f.autoDraft,
    });
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
    setErrors({});
    save.mutate(parsed.data, {
      onSuccess: (s) => {
        setF(toForm(s, agency));
        toast.success("Invoice settings saved", { description: `The next invoice will be ${s.nextNumberPreview}.` });
      },
      onError: (err) => err instanceof ApiError && err.body.issues && setErrors(Object.fromEntries(err.body.issues.map((i) => [i.path, i.message]))),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {!settings && (
        <Alert tone="info" title="Set these up once, before your first invoice">
          They are printed on every invoice. Check the GSTIN, SAC codes and rates with your accountant.
        </Alert>
      )}
      <fieldset disabled={!canEdit} className="space-y-4">
        <SectionCard title="Your business" description="As registered for GST.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Registered business name" required error={errors.legalName}>
              <Input value={f.legalName} onChange={set("legalName")} />
            </Field>
            <Field label="GSTIN" hint="Leave empty if you are not registered — then no GST is charged." error={errors.gstin}>
              <Input
                value={f.gstin}
                maxLength={15}
                onChange={(e) => {
                  const gstin = e.target.value.toUpperCase();
                  const state = gstin.length === 15 && INDIAN_STATES.some((s) => s.code === gstinState(gstin)) ? gstinState(gstin) : f.state;
                  setF({ ...f, gstin, state });
                }}
              />
            </Field>
            <Field label="Registered state" required hint="Clients in this state are charged CGST + SGST; others IGST." error={errors.state}>
              <Select
                aria-label="Registered state"
                value={f.state || undefined}
                onValueChange={(state) => setF({ ...f, state })}
                placeholder="Choose the state"
                options={INDIAN_STATES.filter((s) => s.code !== "96").map((s) => ({ value: s.code, label: s.name }))}
              />
            </Field>
          </div>
          <Field label="Address on invoices" required error={errors.address} className="mt-4">
            <Textarea rows={2} value={f.address} onChange={set("address")} />
          </Field>
        </SectionCard>

        <SectionCard title="Services and GST" description="What you invoice for. Each line on an invoice uses one of these codes and rates.">
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_120px_110px_32px] gap-2 text-body font-medium text-text-secondary sm:grid">
              <span>Service</span>
              <span>SAC code</span>
              <span>GST rate</span>
            </div>
            {f.services.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_110px_32px] items-start gap-2">
                <Input aria-label="Service" value={s.name} onChange={(e) => setService(i, { name: e.target.value })} placeholder="e.g. Video production" />
                <Input aria-label="SAC code" inputMode="numeric" value={s.sac} onChange={(e) => setService(i, { sac: e.target.value })} />
                <Select
                  aria-label="GST rate"
                  value={s.rate}
                  onValueChange={(rate) => setService(i, { rate })}
                  options={GST_RATES.map((r) => ({ value: String(r), label: `${r}%` }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove this service"
                  disabled={f.services.length === 1}
                  onClick={() => setF({ ...f, services: f.services.filter((_, j) => j !== i) })}
                >
                  <X />
                </Button>
                {(errors[`services.${i}.name`] || errors[`services.${i}.sac`]) && (
                  <p className="col-span-4 text-body text-danger">{errors[`services.${i}.name`] ?? errors[`services.${i}.sac`]}</p>
                )}
              </div>
            ))}
            {errors.services && <p className="text-body text-danger">{errors.services}</p>}
            <Button type="button" variant="ghost" size="sm" onClick={() => setF({ ...f, services: [...f.services, { name: "", sac: "", rate: "18" }] })}>
              <Plus />
              Add a service
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Numbering and payment">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Invoice number format"
              required
              error={errors.numberFormat}
              hint={`Use ${NUMBER_TOKENS.join(" ")} — {FY} restarts numbering each April.`}
            >
              <Input value={f.numberFormat} onChange={set("numberFormat")} className="font-mono" />
            </Field>
            <Field label="Next invoice number" error={errors.nextNumber} hint={preview ? `The next invoice will be ${preview}` : undefined}>
              <Input type="number" min={1} value={f.nextNumber} onChange={set("nextNumber")} />
            </Field>
            <Field label="Days to pay" error={errors.paymentTermsDays} hint="The due date is the invoice date plus these days.">
              <Input type="number" min={0} max={120} value={f.paymentTermsDays} onChange={set("paymentTermsDays")} />
            </Field>
          </div>
          <label className="mt-4 flex items-start gap-3 text-body">
            <Switch checked={f.autoDraft} onCheckedChange={(autoDraft) => setF({ ...f, autoDraft })} aria-label="Draft invoices by themselves" />
            <span>
              <span className="font-medium">Draft each agreement&rsquo;s invoice by itself</span>
              <span className="block text-muted-foreground">
                On its billing day — monthly or quarterly in advance, monthly in arrears. Drafts wait for you to check and issue them; other terms are invoiced
                by hand.
              </span>
            </span>
          </label>
        </SectionCard>

        <SectionCard title="Bank details" description="Printed on invoices so clients know where to pay. All optional.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank" error={errors.bankName}>
              <Input value={f.bankName} onChange={set("bankName")} />
            </Field>
            <Field label="Account name" error={errors.accountName}>
              <Input value={f.accountName} onChange={set("accountName")} />
            </Field>
            <Field label="Account number" error={errors.accountNumber}>
              <Input inputMode="numeric" value={f.accountNumber} onChange={set("accountNumber")} />
            </Field>
            <Field label="IFSC" error={errors.ifsc}>
              <Input value={f.ifsc} maxLength={11} onChange={(e) => setF({ ...f, ifsc: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="UPI ID" error={errors.upiId}>
              <Input value={f.upiId} onChange={set("upiId")} placeholder="agency@okbank" />
            </Field>
          </div>
          <Field label="Note at the bottom of invoices" error={errors.footer} className="mt-4">
            <Textarea rows={2} value={f.footer} onChange={set("footer")} placeholder="e.g. Thank you for your business." />
          </Field>
        </SectionCard>
      </fieldset>

      {canEdit ? (
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          {save.error && !(save.error instanceof ApiError && save.error.body.issues) && (
            <span className="mr-auto text-body text-danger">{errorMessage(save.error)}</span>
          )}
          {settings && (
            <Button type="button" variant="secondary" disabled={!dirty} onClick={() => setF(toForm(settings, agency))}>
              Undo changes
            </Button>
          )}
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : (
        <Alert tone="info">You can see the invoice settings; the owner, a manager or finance can change them.</Alert>
      )}
    </form>
  );
}

export function LiveInvoiceSettings() {
  const can = useCan();
  const settings = useInvoiceSettings();
  const agency = useAgency();
  return (
    <>
      <PageHeader title="Invoice settings" description="Your GST details, how invoices are numbered, when they are due, and where clients pay." />
      {settings.isPending || agency.isPending ? (
        <SkeletonRows rows={8} />
      ) : settings.error || agency.error ? (
        <Alert tone="danger">{errorMessage(settings.error ?? agency.error)}</Alert>
      ) : (
        <SettingsForm
          settings={settings.data}
          agency={agency.data!}
          canEdit={can("invoices", "approve") || (can("invoices", "edit") && can("settings", "edit"))}
        />
      )}
    </>
  );
}
