"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, CheckCircle2, FileSignature, Send, ShieldAlert, ThumbsDown, ThumbsUp, Trophy } from "lucide-react";
import { toast } from "sonner";
import { discountedFee, type LeadDetail, type Proposal, suggestCode, winInput } from "@gm/shared";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError, errorMessage } from "./api";
import { inr } from "./packages";
import { useAgency, useCan, useClients, useCreateProposal, usePackages, useProposals, useProposalStep, useWinLead } from "./queries";

export const PROPOSAL_STATUS: Record<Proposal["status"], { label: string; tone: BadgeTone }> = {
  pending_approval: { label: "Waiting for approval", tone: "warning" },
  approved: { label: "Ready to send", tone: "info" },
  rejected: { label: "Discount rejected", tone: "danger" },
  sent: { label: "Sent", tone: "accent" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
};

/** Asks for a short note (rejecting a discount needs a reason). */
function NoteDialog({
  open,
  title,
  description,
  required,
  confirm,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  required?: boolean;
  confirm: string;
  onConfirm: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(note.trim());
            setNote("");
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Note"
              required={required}
              minLength={required ? 2 : undefined}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={required && note.trim().length < 2}>
              {confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProposalRow({ p, canEdit, canApprove }: { p: Proposal; canEdit: boolean; canApprove: boolean }) {
  const step = useProposalStep();
  const [rejecting, setRejecting] = useState(false);
  const run = (s: Parameters<typeof step.mutate>[0]["step"], note?: string, done?: string) =>
    step.mutate({ id: p.id, step: s, note }, { onSuccess: () => done && toast.success(done), onError: (e) => toast.error(errorMessage(e)) });
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-body font-medium">{p.packageName}</div>
          <div className="text-body text-muted-foreground">
            {inr(p.monthlyFee)} a month for {p.months} months
            {p.discountPercent > 0 && ` · ${p.discountPercent}% off ${inr(p.listFee)}`}
          </div>
        </div>
        <Badge tone={PROPOSAL_STATUS[p.status].tone}>{PROPOSAL_STATUS[p.status].label}</Badge>
      </div>
      {p.decisionNote && <p className="mt-1 text-body text-muted-foreground">“{p.decisionNote}”</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {p.status === "pending_approval" && canApprove && (
          <>
            <Button size="xs" onClick={() => run("approve", undefined, "Discount approved")}>
              <ThumbsUp />
              Approve
            </Button>
            <Button size="xs" variant="secondary" onClick={() => setRejecting(true)}>
              <ThumbsDown />
              Reject
            </Button>
          </>
        )}
        {p.status === "approved" && canEdit && (
          <Button size="xs" variant="secondary" onClick={() => run("sent", undefined, "Marked as sent")}>
            <Send />
            Mark as sent
          </Button>
        )}
        {(p.status === "sent" || p.status === "approved") && canEdit && (
          <>
            <Button size="xs" variant="soft" onClick={() => run("accepted", undefined, "Accepted — now mark the deal as won")}>
              <CheckCircle2 />
              Client accepted
            </Button>
            <Button size="xs" variant="ghost" onClick={() => run("declined", undefined, "Marked as declined")}>
              Client declined
            </Button>
          </>
        )}
      </div>
      <NoteDialog
        open={rejecting}
        title="Reject this discount"
        description="Say why, so the salesperson knows what to offer instead."
        required
        confirm="Reject"
        onClose={() => setRejecting(false)}
        onConfirm={(note) => {
          setRejecting(false);
          run("reject", note, "Discount rejected");
        }}
      />
    </li>
  );
}

function NewProposal({ leadId }: { leadId: string }) {
  const can = useCan();
  const agency = useAgency();
  const packages = usePackages();
  const create = useCreateProposal();
  const [packageId, setPackageId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [months, setMonths] = useState("12");
  const pkg = packages.data?.find((p) => p.id === packageId);
  const pct = Math.max(0, Math.min(90, Math.round(Number(discount) || 0)));
  const limit = agency.data?.discountLimit ?? 10;
  const needsApproval = pct > limit && !can("crm", "approve");

  return (
    <form
      className="space-y-3 rounded-xl border border-dashed border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(
          { leadId, input: { packageId, discountPercent: pct, months: Number(months) } },
          {
            onSuccess: (p) => {
              toast.success(p.status === "pending_approval" ? "Proposal made — waiting for discount approval" : "Proposal ready to send");
              setPackageId("");
              setDiscount("0");
            },
          },
        );
      }}
    >
      <div className="text-body font-medium">New proposal</div>
      <div className="grid gap-3 sm:grid-cols-[1fr_100px_100px]">
        <Select
          aria-label="Package"
          value={packageId}
          onValueChange={setPackageId}
          placeholder="Choose a package"
          options={(packages.data ?? []).map((p) => ({ value: p.id, label: `${p.name} · ${inr(p.monthlyFee)}` }))}
        />
        <label className="text-body text-text-secondary">
          <span className="sr-only">Discount %</span>
          <div className="flex items-center gap-1">
            <Input type="number" min={0} max={90} value={discount} onChange={(e) => setDiscount(e.target.value)} aria-label="Discount %" />%
          </div>
        </label>
        <label className="text-body text-text-secondary">
          <span className="sr-only">Months</span>
          <div className="flex items-center gap-1">
            <Input type="number" min={1} max={60} value={months} onChange={(e) => setMonths(e.target.value)} aria-label="Months" />
            mo
          </div>
        </label>
      </div>
      {pkg && (
        <p className="text-body">
          <span className="font-semibold">{inr(discountedFee(pkg.monthlyFee, pct))}</span> a month
          {pct > 0 && <span className="text-muted-foreground"> (list {inr(pkg.monthlyFee)})</span>}
        </p>
      )}
      {needsApproval && (
        <Alert tone="warning" icon={ShieldAlert}>
          Above your agency&apos;s {limit}% limit — it will wait for approval before it can be sent.
        </Alert>
      )}
      {create.error && <p className="text-body text-danger">{errorMessage(create.error)}</p>}
      <Button type="submit" size="sm" disabled={!packageId || create.isPending}>
        <FileSignature />
        {create.isPending ? "Saving…" : "Make proposal"}
      </Button>
    </form>
  );
}

/** Proposals on the lead panel. */
export function ProposalsSection({ lead }: { lead: LeadDetail }) {
  const can = useCan();
  const canEdit = can("crm", "edit");
  return (
    <div>
      <div className="mb-2 text-body font-semibold">Proposals</div>
      {lead.proposals.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {lead.proposals.map((p) => (
            <ProposalRow key={p.id} p={p} canEdit={canEdit && !lead.clientId} canApprove={can("crm", "approve")} />
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-body text-muted-foreground">No proposals yet.</p>
      )}
      {canEdit && !lead.clientId && <NewProposal leadId={lead.id} />}
    </div>
  );
}

// ─── Winning the deal ─────────────────────────────────────────────────

export function WinDialog({ lead, open, onOpenChange }: { lead: LeadDetail | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const clients = useClients();
  const win = useWinLead();
  const usable = (lead?.proposals ?? []).filter((p) => ["accepted", "sent", "approved"].includes(p.status));
  const preferred = usable.find((p) => p.status === "accepted") ?? usable[0];
  const nextMonth = (() => {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)).toISOString().slice(0, 10);
  })();
  const name = lead?.company || lead?.name || "";
  const [f, setF] = useState(() => ({
    name,
    code: suggestCode(name, new Set((clients.data ?? []).map((c) => c.code))),
    city: "",
    contactName: lead?.name ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    proposalId: preferred?.id ?? "",
    startDate: nextMonth,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  if (!lead) return null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const chosen = usable.find((p) => p.id === f.proposalId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      client: {
        name: f.name,
        code: f.code.toUpperCase(),
        city: f.city || undefined,
        contacts: [{ name: f.contactName, phone: f.phone, email: f.email || undefined, approver: true }],
      },
      proposalId: f.proposalId || undefined,
      startDate: f.startDate,
    };
    const parsed = winInput.safeParse(input);
    const path = (p: string) => p.replace("client.contacts.0.", "").replace("client.", "");
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [path(i.path.join(".")), i.message])));
    setErrors({});
    win.mutate(
      { leadId: lead.id, input },
      {
        onSuccess: () => setDone(true),
        onError: (err) => err instanceof ApiError && err.body.issues && setErrors(Object.fromEntries(err.body.issues.map((i) => [path(i.path), i.message]))),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle>{f.name} is now a client</DialogTitle>
              <DialogDescription>
                {chosen
                  ? `The ${chosen.packageName} agreement starts on ${new Date(`${f.startDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}.`
                  : "No agreement was made — add one from the client when it is signed."}{" "}
                Onboarding starts from the client once the onboarding screens arrive.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="flex items-center gap-3">
                <Trophy className="size-8 text-accent-strong" />
                <span className="text-body">Won · the lead is closed and linked to the client.</span>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Back to the pipeline
              </Button>
              <Button asChild>
                <Link href="/app/clients">Open clients</Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Mark as won</DialogTitle>
              <DialogDescription>Sets up the client, its contact and the agreement together, from what you know about the lead.</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
                <Field label="Client name" required error={errors.name}>
                  <Input value={f.name} onChange={set("name")} />
                </Field>
                <Field label="Code" required error={errors.code}>
                  <Input value={f.code} maxLength={4} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contact who approves" required error={errors.name ?? errors.contacts}>
                  <Input value={f.contactName} onChange={set("contactName")} />
                </Field>
                <Field label="Their phone" required error={errors.phone}>
                  <Input value={f.phone} onChange={set("phone")} />
                </Field>
                <Field label="Their email" error={errors.email}>
                  <Input type="email" value={f.email} onChange={set("email")} />
                </Field>
                <Field label="City" error={errors.city}>
                  <Input value={f.city} onChange={set("city")} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Agreement from" hint={usable.length ? undefined : "No proposal ready — the client is set up without an agreement."}>
                  <Select
                    aria-label="Agreement from"
                    value={f.proposalId || "_none"}
                    onValueChange={(v) => setF({ ...f, proposalId: v === "_none" ? "" : v })}
                    options={[
                      ...usable.map((p) => ({
                        value: p.id,
                        label: `${p.packageName} · ${inr(p.monthlyFee)} × ${p.months} mo (${PROPOSAL_STATUS[p.status].label.toLowerCase()})`,
                      })),
                      { value: "_none", label: "No agreement yet" },
                    ]}
                  />
                </Field>
                <Field label="Starts on" required error={errors.startDate}>
                  <Input type="date" value={f.startDate} onChange={set("startDate")} />
                </Field>
              </div>
              {win.error && !(win.error instanceof ApiError && win.error.body.issues) && <Alert tone="danger">{errorMessage(win.error)}</Alert>}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={win.isPending}>
                <BadgeCheck />
                {win.isPending ? "Setting up…" : "Mark as won"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function LostDialog({ open, name, onConfirm, onClose }: { open: boolean; name: string; onConfirm: (reason: string) => void; onClose: () => void }) {
  return (
    <NoteDialog
      open={open}
      title={`Mark ${name} as lost`}
      description="Why was it lost? It helps you see patterns (price, timing, chose someone else)."
      confirm="Mark as lost"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

/** Discounts above the limit waiting for this person (shown to those who may approve sales). */
export function ApprovalsCard({ onOpen }: { onOpen: (leadId: string) => void }) {
  const can = useCan();
  const pending = useProposals("pending_approval", can("crm", "approve"));
  if (!can("crm", "approve") || !pending.data?.length) return null;
  return (
    <SectionCard title="Discounts waiting for your approval" description="Above your agency's sales limit." className="mb-4" contentClassName="space-y-2">
      <ul className="space-y-2">
        {pending.data.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
            <button type="button" className="cursor-pointer text-left" onClick={() => onOpen(p.leadId)}>
              <div className="text-body font-medium">{p.leadName}</div>
              <div className="text-body text-muted-foreground">
                {p.packageName} · {p.discountPercent}% off · {inr(p.monthlyFee)} a month for {p.months} months
              </div>
            </button>
            <ProposalRowActions p={p} />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function ProposalRowActions({ p }: { p: Proposal }) {
  const step = useProposalStep();
  const [rejecting, setRejecting] = useState(false);
  return (
    <div className="flex gap-2">
      <Button
        size="xs"
        onClick={() =>
          step.mutate({ id: p.id, step: "approve" }, { onSuccess: () => toast.success("Discount approved"), onError: (e) => toast.error(errorMessage(e)) })
        }
      >
        <ThumbsUp />
        Approve
      </Button>
      <Button size="xs" variant="secondary" onClick={() => setRejecting(true)}>
        <ThumbsDown />
        Reject
      </Button>
      <NoteDialog
        open={rejecting}
        title="Reject this discount"
        description="Say why, so the salesperson knows what to offer instead."
        required
        confirm="Reject"
        onClose={() => setRejecting(false)}
        onConfirm={(note) => {
          setRejecting(false);
          step.mutate(
            { id: p.id, step: "reject", note },
            { onSuccess: () => toast.success("Discount rejected"), onError: (e) => toast.error(errorMessage(e)) },
          );
        }}
      />
    </div>
  );
}
