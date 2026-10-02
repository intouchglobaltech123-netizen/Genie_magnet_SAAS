"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, FileSignature, MessageCircle, Pencil, Plus, Trash2, Trophy, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  BUSINESS_STAGES,
  type ClientDetail,
  clientUpdate,
  type Contact,
  contactInput,
  FITMENT_QUADRANTS,
  gstinState,
  INDIAN_STATES,
  scopeOf,
  stateName,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, FormSection, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AgreementCard, AgreementDialog } from "./agreements";
import { ApiError, errorMessage } from "./api";
import { FITMENT, FITMENT_TONE } from "./clients";
import { FilesCard } from "./files";
import { ClientVideos } from "./production";
import { ClientPlatforms } from "./publishing";
import { InvoiceTable, NewInvoiceDialog } from "./invoices";
import { onboardingStatus } from "./onboarding";
import { inr } from "./packages";
import {
  useArchiveClient,
  useCan,
  useClient,
  useDeleteClient,
  useInvoices,
  useMe,
  useOnboardingList,
  useRemoveContact,
  useSaveContact,
  useStartOnboarding,
  useTeam,
  useUpdateClient,
} from "./queries";

function ClientOnboarding({ clientId, archived }: { clientId: string; archived: boolean }) {
  const can = useCan();
  const router = useRouter();
  const list = useOnboardingList();
  const start = useStartOnboarding();
  const o = list.data?.find((x) => x.client?.id === clientId);
  if (list.isPending) return null;
  const s = o && onboardingStatus(o);
  return (
    <SectionCard
      title="Onboarding"
      actions={
        o ? (
          <Button size="sm" variant="secondary" asChild>
            <Link href={`/app/onboarding/${o.id}`}>Open</Link>
          </Button>
        ) : (
          can("onboarding", "edit") &&
          !archived && (
            <Button
              size="sm"
              variant="secondary"
              disabled={start.isPending}
              onClick={() =>
                start.mutate({ clientId }, { onSuccess: (r) => router.push(`/app/onboarding/${r.id}`), onError: (e) => toast.error(errorMessage(e)) })
              }
            >
              Start onboarding
            </Button>
          )
        )
      }
    >
      {o && s ? (
        <div className="space-y-1 text-body">
          <Badge tone={s.tone} dot>
            {s.label}
          </Badge>
          <p className="text-muted-foreground">
            Required {o.progress.required.answered}/{o.progress.required.total} · within the window {o.progress.window.answered}/{o.progress.window.total}
          </p>
        </div>
      ) : (
        <p className="text-body text-muted-foreground">Not started. It starts by itself when a deal is won.</p>
      )}
    </SectionCard>
  );
}

function ClientInvoices({ clientId }: { clientId: string }) {
  const can = useCan();
  const invoices = useInvoices(`clientId=${clientId}`);
  const [adding, setAdding] = useState(false);
  const unpaid = (invoices.data ?? []).filter((i) => i.status === "sent").reduce((n, i) => n + i.total, 0);
  return (
    <SectionCard
      title="Invoices"
      description={unpaid ? `${inr(unpaid)} waiting to be paid.` : undefined}
      contentClassName="p-0"
      actions={
        can("invoices", "edit") && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus />
            New invoice
          </Button>
        )
      }
    >
      {invoices.isPending ? (
        <div className="p-4">
          <SkeletonRows rows={2} />
        </div>
      ) : invoices.error ? (
        <div className="p-4">
          <Alert tone="danger">{errorMessage(invoices.error)}</Alert>
        </div>
      ) : invoices.data.length ? (
        <InvoiceTable invoices={invoices.data} showClient={false} />
      ) : (
        <p className="px-5 pb-5 text-body text-muted-foreground">No invoices yet.</p>
      )}
      {adding && <NewInvoiceDialog clientId={clientId} open onOpenChange={setAdding} />}
    </SectionCard>
  );
}

const STAGE_LABEL = (s: string | null) => BUSINESS_STAGES.find((l) => l.toLowerCase() === s) ?? "";
const FITMENT_LABEL = (f: string | null) => (f ? (FITMENT[f] ?? "") : "");
const issues = (e: unknown) => (e instanceof ApiError && e.body.issues ? Object.fromEntries(e.body.issues.map((i) => [i.path, i.message])) : null);

// ─── Editing the client ───────────────────────────────────────────────

function EditClientDialog({ client, open, onOpenChange }: { client: ClientDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const can = useCan();
  const me = useMe().data;
  const update = useUpdateClient(client.id);
  // Choosing someone else to look after the client needs the team list, and a role that sees all clients.
  const allClients = !!me?.permissions && scopeOf(me.permissions, "clients") === "all";
  const team = useTeam(can("team", "view") && allClients);
  const [f, setF] = useState(() => ({
    name: client.name,
    code: client.code,
    industry: client.industry ?? "",
    city: client.city ?? "",
    stage: STAGE_LABEL(client.stage),
    fitment: FITMENT_LABEL(client.fitment),
    accountOwnerId: client.accountOwnerId ?? "",
    whatsappGroupUrl: client.whatsappGroupUrl ?? "",
    notes: client.notes ?? "",
    legalName: client.legalName ?? "",
    gstin: client.gstin ?? "",
    state: client.state ?? "",
    billingAddress: client.billingAddress ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = clientUpdate.safeParse({
      name: f.name,
      code: f.code.toUpperCase(),
      industry: f.industry,
      city: f.city,
      stage: f.stage || null,
      fitment: f.fitment || null,
      ...(team.data && { accountOwnerId: f.accountOwnerId || null }),
      whatsappGroupUrl: f.whatsappGroupUrl,
      notes: f.notes,
      legalName: f.legalName,
      gstin: f.gstin,
      state: f.state || null,
      billingAddress: f.billingAddress,
    });
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
    setErrors({});
    update.mutate(parsed.data, {
      onSuccess: () => {
        toast.success("Saved");
        onOpenChange(false);
      },
      onError: (err) => {
        const byField = issues(err);
        if (byField) setErrors(byField);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Edit {client.name}</DialogTitle>
            <DialogDescription>Every change is kept in the audit log.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <FormSection title="About the client">
              <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                <Field label="Client name" required error={errors.name}>
                  <Input value={f.name} onChange={set("name")} />
                </Field>
                <Field label="Code" hint="Used in video codes" required error={errors.code}>
                  <Input value={f.code} maxLength={4} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Industry" error={errors.industry}>
                  <Input value={f.industry} onChange={set("industry")} />
                </Field>
                <Field label="City" error={errors.city}>
                  <Input value={f.city} onChange={set("city")} />
                </Field>
                <Field label="Business stage" hint="Growth OS: where the client's business is today.">
                  <Select
                    aria-label="Business stage"
                    value={f.stage || "_none"}
                    onValueChange={(v) => setF({ ...f, stage: v === "_none" ? "" : v })}
                    options={[{ value: "_none", label: "Not set" }, ...BUSINESS_STAGES.map((s) => ({ value: s, label: s }))]}
                  />
                </Field>
                <Field label="Fitment" hint="Growth OS: effort to serve against what they bring.">
                  <Select
                    aria-label="Fitment"
                    value={f.fitment || "_none"}
                    onValueChange={(v) => setF({ ...f, fitment: v === "_none" ? "" : v })}
                    options={[{ value: "_none", label: "Not set" }, ...FITMENT_QUADRANTS.map((q) => ({ value: q, label: q }))]}
                  />
                </Field>
                {team.data && (
                  <Field label="Looked after by" error={errors.accountOwnerId}>
                    <Select
                      aria-label="Looked after by"
                      value={f.accountOwnerId || "_none"}
                      onValueChange={(v) => setF({ ...f, accountOwnerId: v === "_none" ? "" : v })}
                      options={[{ value: "_none", label: "Nobody yet" }, ...team.data.members.map((m) => ({ value: m.user.id, label: m.user.name }))]}
                    />
                  </Field>
                )}
                <Field label="WhatsApp group link" error={errors.whatsappGroupUrl}>
                  <Input value={f.whatsappGroupUrl} onChange={set("whatsappGroupUrl")} placeholder="https://chat.whatsapp.com/…" />
                </Field>
              </div>
              <Field label="Notes" error={errors.notes}>
                <Textarea rows={2} value={f.notes} onChange={set("notes")} />
              </Field>
            </FormSection>
            <FormSection title="Billing" description="For invoices. The state decides whether GST is split into CGST and SGST, or charged as IGST.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name on invoices" hint="When it differs from the client's name" error={errors.legalName}>
                  <Input value={f.legalName} onChange={set("legalName")} />
                </Field>
                <Field label="GSTIN" hint="Leave empty if the client is not registered" error={errors.gstin}>
                  <Input
                    value={f.gstin}
                    maxLength={15}
                    onChange={(e) => {
                      const gstin = e.target.value.toUpperCase();
                      // A complete GSTIN tells us the state.
                      const state = gstin.length === 15 && INDIAN_STATES.some((s) => s.code === gstinState(gstin)) ? gstinState(gstin) : f.state;
                      setF({ ...f, gstin, state });
                    }}
                  />
                </Field>
                <Field label="State" error={errors.state}>
                  <Select
                    aria-label="State"
                    value={f.state || "_none"}
                    onValueChange={(v) => setF({ ...f, state: v === "_none" ? "" : v })}
                    options={[{ value: "_none", label: "Not set" }, ...INDIAN_STATES.map((s) => ({ value: s.code, label: s.name }))]}
                  />
                </Field>
              </div>
              <Field label="Billing address" error={errors.billingAddress}>
                <Textarea rows={2} value={f.billingAddress} onChange={set("billingAddress")} />
              </Field>
            </FormSection>
            {update.error && !issues(update.error) && <Alert tone="danger">{errorMessage(update.error)}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contacts ─────────────────────────────────────────────────────────

function ContactDialog({
  clientId,
  editing,
  open,
  onOpenChange,
}: {
  clientId: string;
  editing: Contact | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const save = useSaveContact(clientId);
  const [f, setF] = useState(() => ({
    name: editing?.name ?? "",
    title: editing?.title ?? "",
    phone: editing?.phone ?? "",
    email: editing?.email ?? "",
    approver: editing?.approver ?? false,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: "name" | "title" | "phone" | "email") => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { name: f.name, title: f.title || undefined, phone: f.phone, email: f.email || undefined, approver: f.approver };
    const parsed = contactInput.safeParse(input);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
    setErrors({});
    save.mutate(
      // Editing sends empty text so a cleared title or email is removed.
      { id: editing?.id, input: editing ? { ...parsed.data, title: f.title, email: f.email } : parsed.data },
      {
        onSuccess: () => {
          toast.success(editing ? "Contact saved" : `${f.name} added`);
          onOpenChange(false);
        },
        onError: (err) => {
          const byField = issues(err);
          if (byField) setErrors(byField);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a contact"}</DialogTitle>
            <DialogDescription>Approvers are the people who approve scripts and videos for the client.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={errors.name}>
              <Input value={f.name} onChange={set("name")} />
            </Field>
            <Field label="Role at the client" error={errors.title}>
              <Input value={f.title} onChange={set("title")} placeholder="e.g. Marketing head" />
            </Field>
            <Field label="Phone" required error={errors.phone}>
              <Input value={f.phone} onChange={set("phone")} placeholder="+91 98400 11001" />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={f.email} onChange={set("email")} />
            </Field>
            <label className="flex items-center gap-2 text-body sm:col-span-2">
              <Checkbox checked={f.approver} onCheckedChange={(v) => setF({ ...f, approver: v === true })} />
              Approves the work
            </label>
            {save.error && !issues(save.error) && (
              <Alert tone="danger" className="sm:col-span-2">
                {errorMessage(save.error)}
              </Alert>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save" : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Contacts({ client, canEdit }: { client: ClientDetail; canEdit: boolean }) {
  const remove = useRemoveContact(client.id);
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  return (
    <SectionCard
      title="Contacts"
      actions={
        canEdit && (
          <Button size="xs" variant="secondary" onClick={() => setEditing("new")}>
            <Plus />
            Add
          </Button>
        )
      }
    >
      {!client.contacts.some((c) => c.approver) && (
        <Alert tone="warning" className="mb-3">
          Nobody is marked as approving the work yet.
        </Alert>
      )}
      <ul className="divide-y divide-border-subtle">
        {client.contacts.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-body font-medium">
                {c.name}
                {c.approver && <Badge tone="success">Approver</Badge>}
              </div>
              {c.title && <div className="text-body text-muted-foreground">{c.title}</div>}
              <div className="text-body text-muted-foreground">
                <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:underline">
                  {c.phone}
                </a>
                {c.email && (
                  <>
                    {" · "}
                    <a href={`mailto:${c.email}`} className="hover:underline">
                      {c.email}
                    </a>
                  </>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="flex shrink-0 gap-1">
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${c.name}`}
                  disabled={client.contacts.length === 1}
                  onClick={() => remove.mutate(c.id, { onSuccess: () => toast.success(`${c.name} removed`), onError: (e) => toast.error(errorMessage(e)) })}
                >
                  <Trash2 />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing && <ContactDialog clientId={client.id} editing={editing === "new" ? null : editing} open onOpenChange={(o) => !o && setEditing(null)} />}
    </SectionCard>
  );
}

// ─── The page ─────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 py-1.5 text-body">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export function LiveClient({ id }: { id: string }) {
  const router = useRouter();
  const can = useCan();
  const client = useClient(id);
  const archive = useArchiveClient(id);
  const remove = useDeleteClient();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const canEdit = can("clients", "edit");

  if (client.isPending) return <SkeletonRows rows={8} />;
  if (client.error)
    return (
      <>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/app/clients">
            <ArrowLeft />
            Clients
          </Link>
        </Button>
        <Alert tone="danger">{errorMessage(client.error)}</Alert>
      </>
    );
  const c = client.data;
  const agreements = c.agreements ?? [];
  const running = agreements.filter((a) => a.status !== "ended");
  const past = agreements.filter((a) => a.status === "ended");

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href="/app/clients">
          <ArrowLeft />
          Clients
        </Link>
      </Button>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="outline" className="font-mono">
              {c.code}
            </Badge>
            {c.archivedAt && <Badge tone="neutral">Archived</Badge>}
            {c.fitment && <Badge tone={FITMENT_TONE[c.fitment]}>{FITMENT[c.fitment]}</Badge>}
          </>
        }
        title={c.name}
        description={[c.industry, c.city].filter(Boolean).join(" · ") || undefined}
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil />
                Edit
              </Button>
              <Button
                variant="ghost"
                disabled={archive.isPending}
                onClick={() =>
                  archive.mutate(!c.archivedAt, {
                    onSuccess: () => toast.success(c.archivedAt ? "Restored" : "Archived — it no longer shows in the client list"),
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              >
                {c.archivedAt ? <ArchiveRestore /> : <Archive />}
                {c.archivedAt ? "Restore" : "Archive"}
              </Button>
              {c.canDelete && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    remove.mutate(c.id, {
                      onSuccess: () => {
                        toast.success(`${c.name} deleted`);
                        router.push("/app/clients");
                      },
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                  }
                >
                  <Trash2 />
                  Delete
                </Button>
              )}
            </>
          )
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {c.agreements !== null ? (
            <SectionCard
              title="Agreements"
              description={c.monthlyFee ? `${inr(c.monthlyFee)} a month from the agreements running now.` : undefined}
              actions={
                can("agreements", "edit") &&
                !c.archivedAt && (
                  <Button size="sm" onClick={() => setAdding(true)}>
                    <Plus />
                    New agreement
                  </Button>
                )
              }
            >
              {!agreements.length ? (
                <EmptyState
                  icon={FileSignature}
                  title="No agreement yet"
                  description="Make one from a package when the client signs up. It runs once someone who may approve agreements signs it off."
                />
              ) : (
                <>
                  <ul className="space-y-3">
                    {running.map((a) => (
                      <AgreementCard key={a.id} a={a} clientName={c.name} />
                    ))}
                  </ul>
                  {past.length > 0 && (
                    <details className="mt-4" open={!running.length}>
                      <summary className="cursor-pointer text-body font-medium text-text-secondary">Ended ({past.length})</summary>
                      <ul className="mt-3 space-y-3">
                        {past.map((a) => (
                          <AgreementCard key={a.id} a={a} clientName={c.name} />
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </SectionCard>
          ) : (
            <Alert tone="info">Your role does not show agreements.</Alert>
          )}
          {can("onboarding", "view") && <ClientOnboarding clientId={c.id} archived={!!c.archivedAt} />}
          {can("production", "view") && <ClientVideos clientId={c.id} />}
          {can("invoices", "view") && <ClientInvoices clientId={c.id} />}
        </div>

        <div className="grid content-start gap-4 md:grid-cols-2 xl:grid-cols-1">
          <SectionCard title="Details">
            <dl>
              <Row label="Looked after by">
                {c.accountOwner && (
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound className="size-3.5 text-muted-foreground" />
                    {c.accountOwner.name ?? "A former team member"}
                  </span>
                )}
              </Row>
              <Row label="Business stage">{STAGE_LABEL(c.stage)}</Row>
              <Row label="WhatsApp group">
                {c.whatsappGroupUrl && (
                  <a href={c.whatsappGroupUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <MessageCircle className="size-3.5" />
                    Open group
                  </a>
                )}
              </Row>
              {c.lead && (
                <Row label="Won from">
                  <Link href="/app/sales" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Trophy className="size-3.5" />
                    {c.lead.company ?? c.lead.name}
                  </Link>
                </Row>
              )}
              <Row label="Client since">{new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Row>
            </dl>
            {c.notes && <p className="mt-2 whitespace-pre-line border-t border-border-subtle pt-2 text-body text-text-secondary">{c.notes}</p>}
          </SectionCard>
          <Contacts client={c} canEdit={canEdit} />
          <FilesCard entity="client" entityId={c.id} title="Brand files" description="Logos, brand guide, fonts, photos." canEdit={canEdit && !c.archivedAt} />
          {can("publishing", "view") && <ClientPlatforms clientId={c.id} canEdit={can("publishing", "edit")} />}
          <SectionCard title="Billing" description="Used on invoices.">
            <dl>
              <Row label="Name on invoices">{c.legalName ?? c.name}</Row>
              <Row label="GSTIN">{c.gstin && <span className="font-mono">{c.gstin}</span>}</Row>
              <Row label="State">{stateName(c.state)}</Row>
              <Row label="Address">{c.billingAddress && <span className="whitespace-pre-line">{c.billingAddress}</span>}</Row>
            </dl>
          </SectionCard>
        </div>
      </div>

      {editing && <EditClientDialog client={c} open onOpenChange={setEditing} />}
      {adding && <AgreementDialog clientId={c.id} clientName={c.name} open onOpenChange={setAdding} />}
    </>
  );
}
