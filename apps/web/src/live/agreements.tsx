"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, FileSignature, Pause, Pencil, Play, Plus, ReceiptIndianRupee, RefreshCcw, ShieldCheck, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { type Agreement, agreementEndDate, agreementInput, BILLING_TERMS, dayAfter, type DeliverableKind } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { NoteDialog } from "./deals";
import { fmtDate } from "./format";
import { NewInvoiceDialog } from "./invoices";
import { DeliverablesEditor, inr, type Line, PlatformPicker, PLATFORM_LABEL } from "./packages";
import { type AgreementStep, useAgreements, useAgreementStep, useCan, usePackages, useSaveAgreement } from "./queries";

export const AGREEMENT_STATUS: Record<Agreement["status"], { label: string; tone: BadgeTone }> = {
  draft: { label: "Waiting for sign-off", tone: "warning" },
  active: { label: "Running", tone: "success" },
  paused: { label: "Paused", tone: "neutral" },
  ended: { label: "Ended", tone: "neutral" },
};

const firstOfNextMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)).toISOString().slice(0, 10);
};

export function AgreementBadges({ a }: { a: Agreement }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {a.upcoming ? (
        <Badge tone="info" dot>
          Signed · starts {fmtDate(a.startDate)}
        </Badge>
      ) : (
        <Badge tone={AGREEMENT_STATUS[a.status].tone} dot>
          {AGREEMENT_STATUS[a.status].label}
        </Badge>
      )}
      {a.renewalDue && (
        <Badge tone="warning">
          <CalendarClock />
          {a.daysLeft < 0 ? "Past its end — renew or end" : `Renewal due · ${a.daysLeft} days left`}
        </Badge>
      )}
    </span>
  );
}

// ─── Making and changing an agreement ─────────────────────────────────

type Form = {
  packageId: string;
  title: string;
  startDate: string;
  months: string;
  monthlyFee: string;
  billing: string;
  revisionsPerDeliverable: string;
  shootDays: string;
  deliverables: Line[];
  platforms: string[];
  notes: string;
};

const lines = (d: { name: string; perMonth: number; kind: DeliverableKind }[]): Line[] =>
  d.map((x) => ({ name: x.name, perMonth: String(x.perMonth), kind: x.kind }));

/** A new agreement for a client (from one of the packages, or written out), or a draft's terms. */
export function AgreementDialog({
  clientId,
  clientName,
  editing,
  open,
  onOpenChange,
}: {
  clientId: string;
  clientName: string;
  editing?: Agreement | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const packages = usePackages();
  const save = useSaveAgreement();
  const [f, setF] = useState<Form>(() =>
    editing
      ? {
          packageId: editing.packageId ?? "",
          title: editing.title,
          startDate: editing.startDate,
          months: String(editing.months),
          monthlyFee: String(editing.monthlyFee),
          billing: editing.billing,
          revisionsPerDeliverable: String(editing.revisionsPerDeliverable),
          shootDays: String(editing.shootDays),
          deliverables: lines(editing.deliverables),
          platforms: editing.platforms,
          notes: editing.notes ?? "",
        }
      : {
          packageId: "",
          title: "",
          startDate: firstOfNextMonth(),
          months: "12",
          monthlyFee: "",
          billing: "Monthly advance",
          revisionsPerDeliverable: "2",
          shootDays: "1",
          deliverables: [{ name: "Reels", perMonth: "8", kind: "video" }],
          platforms: ["instagram"],
          notes: "",
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  /** Choosing a package copies its terms into the form; they can still be changed for this client. */
  const choose = (id: string) => {
    const p = packages.data?.find((x) => x.id === id);
    if (!p) return setF({ ...f, packageId: "" });
    setF({
      ...f,
      packageId: p.id,
      title: !f.title || f.title.startsWith(`${clientName} · `) ? `${clientName} · ${p.name}` : f.title,
      monthlyFee: String(p.monthlyFee),
      billing: p.billing ?? f.billing,
      revisionsPerDeliverable: String(p.revisionsPerDeliverable),
      shootDays: String(p.shootDays),
      deliverables: lines(p.deliverables),
      platforms: p.platforms,
    });
  };

  const months = Number(f.months) || 0;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = agreementInput.safeParse({
      packageId: f.packageId || undefined,
      title: f.title,
      startDate: f.startDate,
      months,
      monthlyFee: Number(f.monthlyFee),
      billing: f.billing,
      revisionsPerDeliverable: Number(f.revisionsPerDeliverable),
      shootDays: Number(f.shootDays),
      deliverables: f.deliverables.map((l) => ({ name: l.name, perMonth: Number(l.perMonth), kind: l.kind })),
      platforms: f.platforms,
      notes: f.notes || undefined,
    });
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
    setErrors({});
    save.mutate(
      { id: editing?.id, clientId, input: parsed.data },
      {
        onSuccess: () => {
          toast.success(editing ? "Draft saved" : "Agreement drafted", {
            description: editing ? undefined : "It runs once someone who may approve agreements signs it off.",
          });
          onOpenChange(false);
        },
        onError: (err) => err instanceof ApiError && err.body.issues && setErrors(Object.fromEntries(err.body.issues.map((i) => [i.path, i.message]))),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{editing ? "Change the draft" : `New agreement for ${clientName}`}</DialogTitle>
            <DialogDescription>
              The terms are copied from the package, so later changes to the package never change this agreement. Once signed off, the terms stay as they are;
              change them by renewing.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="From package" hint="Or leave it empty and write the terms out.">
              <Select
                aria-label="From package"
                value={f.packageId || "_none"}
                onValueChange={(v) => choose(v === "_none" ? "" : v)}
                options={[
                  ...(packages.data ?? []).map((p) => ({ value: p.id, label: `${p.name} · ${inr(p.monthlyFee)}` })),
                  { value: "_none", label: "No package — custom terms" },
                ]}
              />
            </Field>
            <Field label="Title" required error={errors.title}>
              <Input value={f.title} onChange={set("title")} placeholder={`${clientName} · Monthly retainer`} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Starts on" required error={errors.startDate}>
                <Input type="date" value={f.startDate} onChange={set("startDate")} />
              </Field>
              <Field
                label="Months"
                required
                error={errors.months}
                hint={f.startDate && months >= 1 && months <= 60 ? `Ends ${fmtDate(agreementEndDate(f.startDate, months))}` : undefined}
              >
                <Input type="number" min={1} max={60} value={f.months} onChange={set("months")} />
              </Field>
              <Field label="Fee a month (₹)" required error={errors.monthlyFee}>
                <Input type="number" min={0} step={500} value={f.monthlyFee} onChange={set("monthlyFee")} />
              </Field>
            </div>
            <DeliverablesEditor lines={f.deliverables} onChange={(deliverables) => setF({ ...f, deliverables })} errors={errors} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Shoot days a month" error={errors.shootDays}>
                <Input type="number" min={0} max={31} value={f.shootDays} onChange={set("shootDays")} />
              </Field>
              <Field label="Revisions per deliverable" error={errors.revisionsPerDeliverable}>
                <Input type="number" min={0} max={10} value={f.revisionsPerDeliverable} onChange={set("revisionsPerDeliverable")} />
              </Field>
              <Field label="Billing" required error={errors.billing}>
                <Input list="agreement-billing" value={f.billing} onChange={set("billing")} />
              </Field>
              <datalist id="agreement-billing">
                {BILLING_TERMS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <PlatformPicker value={f.platforms} onChange={(platforms) => setF({ ...f, platforms })} />
            <Field label="Notes" error={errors.notes}>
              <Textarea rows={2} value={f.notes} onChange={set("notes")} placeholder="Anything agreed that is not in the terms above" />
            </Field>
            {save.error && !(save.error instanceof ApiError && save.error.body.issues) && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              <FileSignature />
              {save.isPending ? "Saving…" : editing ? "Save draft" : "Make the draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenewDialog({ a, open, onOpenChange }: { a: Agreement; open: boolean; onOpenChange: (o: boolean) => void }) {
  const step = useAgreementStep();
  const [startDate, setStartDate] = useState(() => dayAfter(a.endDate));
  const [months, setMonths] = useState(String(a.months));
  const [fee, setFee] = useState(String(a.monthlyFee));
  const m = Number(months) || 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            step.mutate(
              { id: a.id, step: "renew", input: { startDate, months: m, monthlyFee: Number(fee) } },
              {
                onSuccess: () => {
                  toast.success("Renewal drafted", { description: "It runs once it is signed off." });
                  onOpenChange(false);
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Renew {a.title}</DialogTitle>
            <DialogDescription>A new agreement on the same terms follows this one. Change the fee or length here, or the rest in the draft.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Starts on">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Months" hint={startDate && m >= 1 && m <= 60 ? `Ends ${fmtDate(agreementEndDate(startDate, m))}` : undefined}>
              <Input type="number" min={1} max={60} value={months} onChange={(e) => setMonths(e.target.value)} />
            </Field>
            <Field label="Fee a month (₹)" hint={Number(fee) !== a.monthlyFee ? `Was ${inr(a.monthlyFee)}` : undefined}>
              <Input type="number" min={0} step={500} value={fee} onChange={(e) => setFee(e.target.value)} />
            </Field>
            {step.error && (
              <Alert tone="danger" className="sm:col-span-3">
                {errorMessage(step.error)}
              </Alert>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={step.isPending || m < 1}>
              <RefreshCcw />
              Draft the renewal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EndDialog({ a, open, onOpenChange }: { a: Agreement; open: boolean; onOpenChange: (o: boolean) => void }) {
  const step = useAgreementStep();
  const [note, setNote] = useState("");
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            step.mutate(
              { id: a.id, step: "end", input: { note: note.trim(), endDate } },
              {
                onSuccess: () => {
                  toast.success("Agreement ended");
                  onOpenChange(false);
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>End {a.title}</DialogTitle>
            <DialogDescription>It stops running from the date below (or on its own end date, if that comes first). This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Last day">
              <Input type="date" min={a.startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
            <Field label="Why does it end?" required>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Budget cut, moved in-house, completed" />
            </Field>
            {step.error && <Alert tone="danger">{errorMessage(step.error)}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={step.isPending || note.trim().length < 2}>
              End agreement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One agreement on the client page, with what the person may do next. */
export function AgreementCard({ a, clientName }: { a: Agreement; clientName: string }) {
  const can = useCan();
  const step = useAgreementStep();
  const [dialog, setDialog] = useState<"edit" | "renew" | "end" | "pause" | "invoice" | null>(null);
  const canEdit = can("agreements", "edit");
  const canApprove = can("agreements", "approve");
  const run = (v: AgreementStep, done: string) =>
    step.mutate({ id: a.id, ...v }, { onSuccess: () => toast.success(done), onError: (e) => toast.error(errorMessage(e)) });

  return (
    <li className={cn("rounded-xl border border-border p-4", a.status === "ended" && "bg-surface-secondary")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-body font-semibold">{a.title}</div>
          <div className="text-body text-muted-foreground">
            {fmtDate(a.startDate)} – {fmtDate(a.endDate)} · {a.months} months · {a.billing}
          </div>
        </div>
        <div className="shrink-0 whitespace-nowrap">
          <span className="text-subheading font-semibold">{inr(a.monthlyFee)}</span>
          <span className="text-body text-muted-foreground"> a month</span>
        </div>
      </div>
      <div className="mt-2">
        <AgreementBadges a={a} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {a.deliverables.map((d) => (
          <Badge key={d.name} tone="outline">
            {d.perMonth} {d.name}
          </Badge>
        ))}
        {a.shootDays > 0 && <Badge tone="outline">{a.shootDays === 1 ? "1 shoot day" : `${a.shootDays} shoot days`}</Badge>}
        <Badge tone="outline">{a.revisionsPerDeliverable === 1 ? "1 revision each" : `${a.revisionsPerDeliverable} revisions each`}</Badge>
        {a.platforms.map((p) => (
          <Badge key={p} tone="neutral">
            {PLATFORM_LABEL[p] ?? p}
          </Badge>
        ))}
      </div>
      {(a.notes || a.statusNote || a.signedBy || a.renewsId || a.renewedById) && (
        <div className="mt-3 space-y-1 text-body text-muted-foreground">
          {a.statusNote && (
            <p>
              {a.status === "ended" ? "Ended" : "Paused"}: “{a.statusNote}”
            </p>
          )}
          {a.notes && <p>{a.notes}</p>}
          {a.signedBy && a.signedAt && (
            <p>
              Signed off by {a.signedBy.name ?? "a former team member"} on {fmtDate(a.signedAt)}
            </p>
          )}
          {a.renewsId && <p>Renews an earlier agreement.</p>}
          {a.renewedById && <p>Renewed — the next agreement is listed here too.</p>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {a.status === "draft" && canApprove && (
          <Button size="xs" onClick={() => run({ step: "sign-off" }, "Signed off — the agreement is running")}>
            <ShieldCheck />
            Sign off
          </Button>
        )}
        {a.status === "draft" && canEdit && (
          <>
            <Button size="xs" variant="secondary" onClick={() => setDialog("edit")}>
              <Pencil />
              Change
            </Button>
            <Button size="xs" variant="ghost" onClick={() => run({ step: "delete" }, "Draft deleted")}>
              <Trash2 />
              Delete draft
            </Button>
          </>
        )}
        {a.status === "active" && canEdit && (
          <Button size="xs" variant="ghost" onClick={() => setDialog("pause")}>
            <Pause />
            Pause
          </Button>
        )}
        {a.status === "paused" && canEdit && (
          <Button size="xs" variant="secondary" onClick={() => run({ step: "resume" }, "Running again")}>
            <Play />
            Resume
          </Button>
        )}
        {a.status !== "draft" && !a.renewedById && canEdit && (
          <Button size="xs" variant={a.renewalDue ? "default" : "secondary"} onClick={() => setDialog("renew")}>
            <RefreshCcw />
            Renew
          </Button>
        )}
        {(a.status === "active" || a.status === "paused") && can("invoices", "edit") && (
          <Button size="xs" variant="soft" onClick={() => setDialog("invoice")}>
            <ReceiptIndianRupee />
            Invoice a month
          </Button>
        )}
        {(a.status === "active" || a.status === "paused") && canApprove && (
          <Button size="xs" variant="ghost" onClick={() => setDialog("end")}>
            <Square />
            End
          </Button>
        )}
      </div>
      {dialog === "edit" && <AgreementDialog clientId={a.clientId} clientName={clientName} editing={a} open onOpenChange={(o) => !o && setDialog(null)} />}
      {dialog === "renew" && <RenewDialog a={a} open onOpenChange={(o) => !o && setDialog(null)} />}
      {dialog === "end" && <EndDialog a={a} open onOpenChange={(o) => !o && setDialog(null)} />}
      {dialog === "invoice" && <NewInvoiceDialog clientId={a.clientId} agreement={a} open onOpenChange={(o) => !o && setDialog(null)} />}
      <NoteDialog
        open={dialog === "pause"}
        title={`Pause ${a.title}`}
        description="Work and billing stop until it is resumed. Why is it paused? (optional)"
        confirm="Pause"
        onClose={() => setDialog(null)}
        onConfirm={(note) => {
          setDialog(null);
          run({ step: "pause", note: note || undefined }, "Paused");
        }}
      />
    </li>
  );
}

// ─── All agreements ───────────────────────────────────────────────────

const VIEWS = [
  { key: "running", label: "Running", query: "status=active" },
  { key: "renewal", label: "Due for renewal", query: "renewal=1" },
  { key: "drafts", label: "Waiting for sign-off", query: "status=draft" },
  { key: "paused", label: "Paused", query: "status=paused" },
  { key: "ended", label: "Ended", query: "status=ended" },
] as const;

export function LiveAgreements({ view: initial }: { view?: string }) {
  const router = useRouter();
  const [view, setView] = useState<(typeof VIEWS)[number]["key"]>(() => VIEWS.find((v) => v.key === initial)?.key ?? "running");
  const current = VIEWS.find((v) => v.key === view)!;
  const list = useAgreements(current.query);
  const total = (list.data ?? []).filter((a) => a.status === "active" && !a.upcoming).reduce((n, a) => n + a.monthlyFee, 0);

  return (
    <>
      <PageHeader
        title="Agreements"
        description="What each client has signed up for: terms, monthly deliverables, and when each one ends. New agreements are made from the client's page."
      />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Show">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={v.key === view}
            onClick={() => {
              setView(v.key);
              router.replace(`/app/agreements?view=${v.key}`, { scroll: false });
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
            icon={FileSignature}
            title={view === "running" ? "No running agreements" : `Nothing ${current.label.toLowerCase()}`}
            description={view === "running" ? "Agreements come from winning a deal, or from a client's page." : undefined}
            action={
              view === "running" && (
                <Button variant="secondary" asChild>
                  <Link href="/app/clients">
                    <Plus />
                    Open clients
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Client</TH>
                <TH>Agreement</TH>
                <TH>Runs</TH>
                <TH>Status</TH>
                <TH numeric>Fee a month</TH>
              </TR>
            </THead>
            <TBody>
              {list.data.map((a) => (
                <TR key={a.id} className="cursor-pointer" onClick={() => router.push(`/app/clients/${a.clientId}`)}>
                  <TD>
                    <Link href={`/app/clients/${a.clientId}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                      {a.client.name}
                    </Link>
                    <div className="tabular-nums text-muted-foreground">{a.client.code}</div>
                  </TD>
                  <TD>
                    <div>{a.title}</div>
                    <div className="text-muted-foreground">{a.deliverables.map((d) => `${d.perMonth} ${d.name}`).join(" · ")}</div>
                  </TD>
                  <TD className="whitespace-nowrap">
                    {fmtDate(a.startDate)} – {fmtDate(a.endDate)}
                  </TD>
                  <TD>
                    <AgreementBadges a={a} />
                  </TD>
                  <TD numeric>{inr(a.monthlyFee)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      {view === "running" && total > 0 && (
        <p className="mt-3 text-right text-body text-muted-foreground">
          Running agreements bring in <span className="font-semibold text-text-primary">{inr(total)}</span> a month.
        </p>
      )}
    </>
  );
}
