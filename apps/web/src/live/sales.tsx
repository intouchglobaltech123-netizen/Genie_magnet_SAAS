"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, CalendarClock, LayoutGrid, List, Mail, MessageCircle, NotebookPen, Phone, Plus, Search, Trash2, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ACTIVITY_KINDS, type ActivityKind, type Lead, leadInput, LEAD_SOURCES, type LeadUpdate, type PipelineStage } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { ApprovalsCard, LostDialog, ProposalsSection, WinDialog } from "./deals";
import { inr } from "./packages";
import { useAddActivity, useCan, useClients, useDeleteLead, useLead, useLeads, useMe, useMoveLead, useSaveLead, useStages, useTeam } from "./queries";

const today = () => new Date().toISOString().slice(0, 10);
const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const ACTIVITY_LABEL: Record<ActivityKind, string> = { call: "Call", meeting: "Meeting", whatsapp: "WhatsApp", email: "Email", note: "Note" };
const ACTIVITY_ICON: Record<ActivityKind, typeof Phone> = { call: Phone, meeting: Users, whatsapp: MessageCircle, email: Mail, note: NotebookPen };

function FollowUp({ date }: { date: string | null }) {
  if (!date) return <span className="text-text-muted">No follow-up</span>;
  const overdue = date < today();
  const due = date === today();
  return (
    <span className={cn("inline-flex items-center gap-1", overdue ? "font-medium text-danger" : due ? "font-medium text-warning" : "text-muted-foreground")}>
      <CalendarClock className="size-3.5" />
      {overdue ? `Overdue · ${shortDate(date)}` : due ? "Today" : shortDate(date)}
    </span>
  );
}

/** People a lead can be given to: the team when the person can see it, otherwise only themselves. */
function useOwnerOptions() {
  const me = useMe().data;
  const can = useCan();
  const team = useTeam(can("team", "view"));
  const people = team.data?.members.map((m) => ({ value: m.user.id, label: m.user.name })) ?? (me ? [{ value: me.user.id, label: me.user.name }] : []);
  return people;
}

// ─── Lead form (new lead and the lead panel) ──────────────────────────

type Form = {
  name: string;
  company: string;
  phone: string;
  email: string;
  source: string;
  stage: string;
  value: string;
  ownerId: string;
  nextFollowUp: string;
  notes: string;
};

const formOf = (l?: Lead): Form => ({
  name: l?.name ?? "",
  company: l?.company ?? "",
  phone: l?.phone ?? "",
  email: l?.email ?? "",
  source: l?.source ?? "",
  stage: l?.stage ?? "",
  value: l ? String(l.value) : "",
  ownerId: l?.owner?.id ?? "",
  nextFollowUp: l?.nextFollowUp ?? "",
  notes: l?.notes ?? "",
});

function LeadFields({
  f,
  setF,
  errors,
  stages,
  editable,
}: {
  f: Form;
  setF: (f: Form) => void;
  errors: Record<string, string>;
  stages: PipelineStage[];
  editable: boolean;
}) {
  const owners = useOwnerOptions();
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <fieldset disabled={!editable} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={errors.name}>
          <Input value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Company" error={errors.company}>
          <Input value={f.company} onChange={set("company")} />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input value={f.phone} onChange={set("phone")} placeholder="+91 98400 11001" />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={f.email} onChange={set("email")} />
        </Field>
        <Field label="Source" required error={errors.source}>
          <Input list="lead-sources" value={f.source} onChange={set("source")} placeholder="e.g. Referral" />
        </Field>
        <Field label="Value a month (₹)" error={errors.value}>
          <Input type="number" min={0} step={1000} value={f.value} onChange={set("value")} />
        </Field>
        <Field label="Stage" error={errors.stage}>
          <Select
            value={f.stage}
            onValueChange={(stage) => setF({ ...f, stage })}
            options={stages.map((s) => ({ value: s.key, label: s.name }))}
            aria-label="Stage"
          />
        </Field>
        <Field label="Follows it up" error={errors.ownerId}>
          <Select value={f.ownerId} onValueChange={(ownerId) => setF({ ...f, ownerId })} options={owners} placeholder="Me" aria-label="Follows it up" />
        </Field>
        <Field label="Next follow-up" error={errors.nextFollowUp}>
          <Input type="date" value={f.nextFollowUp} onChange={set("nextFollowUp")} />
        </Field>
      </div>
      <datalist id="lead-sources">
        {LEAD_SOURCES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Field label="Notes" error={errors.notes}>
        <Textarea rows={3} value={f.notes} onChange={set("notes")} />
      </Field>
    </fieldset>
  );
}

function toInput(f: Form) {
  return {
    name: f.name,
    company: f.company,
    phone: f.phone,
    email: f.email,
    source: f.source,
    stage: f.stage || undefined,
    value: f.value ? Number(f.value) : 0,
    ownerId: f.ownerId || undefined,
    nextFollowUp: f.nextFollowUp || undefined,
    notes: f.notes,
  };
}

const issuesOf = (e: unknown) => (e instanceof ApiError && e.body.issues ? Object.fromEntries(e.body.issues.map((i) => [i.path, i.message])) : {});

function NewLeadDialog({
  open,
  onOpenChange,
  stages,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stages: PipelineStage[];
  onCreated: (id: string) => void;
}) {
  const save = useSaveLead();
  const [f, setF] = useState<Form>(() => ({ ...formOf(), stage: stages.find((s) => s.kind === "open")?.key ?? "" }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = leadInput.safeParse(toInput(f));
            if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
            setErrors({});
            save.mutate(
              { input: toInput(f) },
              {
                onSuccess: (l) => {
                  toast.success(`${l.name} added`);
                  onOpenChange(false);
                  onCreated(l.id);
                },
                onError: (err) => setErrors(issuesOf(err)),
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>New lead</DialogTitle>
            <DialogDescription>Someone who might become a client. Set when to follow up so it is not forgotten.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <LeadFields f={f} setF={setF} errors={errors} stages={stages} editable />
            {save.error && !Object.keys(issuesOf(save.error)).length && (
              <Alert tone="danger" className="mt-4">
                {errorMessage(save.error)}
              </Alert>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Adding…" : "Add lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lead panel: details, activity log, history ──────────────────────

function ActivityForm({ leadId }: { leadId: string }) {
  const add = useAddActivity();
  const [kind, setKind] = useState<ActivityKind>("call");
  const [summary, setSummary] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  return (
    <form
      className="space-y-3 rounded-xl border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate(
          { leadId, input: { kind, summary, nextFollowUp: nextFollowUp || undefined } },
          {
            onSuccess: () => {
              setSummary("");
              setNextFollowUp("");
              toast.success(`${ACTIVITY_LABEL[kind]} logged`);
            },
          },
        );
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {ACTIVITY_KINDS.map((k) => {
          const Icon = ACTIVITY_ICON[k];
          return (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-body transition-colors",
                kind === k ? "border-primary bg-primary-soft text-primary" : "border-border text-text-secondary hover:border-secondary/40",
              )}
            >
              <Icon className="size-3.5" />
              {ACTIVITY_LABEL[k]}
            </button>
          );
        })}
      </div>
      <Textarea
        rows={2}
        required
        minLength={2}
        placeholder="What happened? What did they say?"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        aria-label="What happened"
      />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-body text-text-secondary">
          Next follow-up
          <Input type="date" className="mt-1 w-44" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} />
        </label>
        {add.error && <span className="text-body text-danger">{errorMessage(add.error)}</span>}
        <Button type="submit" size="sm" className="ml-auto" disabled={add.isPending || summary.trim().length < 2}>
          {add.isPending ? "Saving…" : "Log it"}
        </Button>
      </div>
    </form>
  );
}

function LeadPanel({
  id,
  stages,
  onClose,
  onWin,
  onLost,
}: {
  id: string | null;
  stages: PipelineStage[];
  onClose: () => void;
  onWin: (id: string) => void;
  onLost: (id: string) => void;
}) {
  const can = useCan();
  const lead = useLead(id);
  const save = useSaveLead();
  const remove = useDeleteLead();
  const editable = can("crm", "edit");
  const [draft, setDraft] = useState<{ id: string; f: Form } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const f = draft && draft.id === id ? draft.f : formOf(lead.data);
  const dirty = !!lead.data && JSON.stringify(f) !== JSON.stringify(formOf(lead.data));
  const stage = stages.find((s) => s.key === lead.data?.stage);

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right">
        {lead.isPending || !lead.data ? (
          <div className="p-6">
            <SkeletonRows rows={8} />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{lead.data.name}</DialogTitle>
              <DialogDescription>
                {[lead.data.company, stage?.name, lead.data.value ? `${inr(lead.data.value)} a month` : null].filter(Boolean).join(" · ")}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-6">
              {lead.data.clientId ? (
                <Alert tone="success" icon={BadgeCheck}>
                  Won — {lead.data.company ?? lead.data.name} is a client now.
                </Alert>
              ) : (
                editable &&
                stage?.kind !== "lost" && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onWin(lead.data!.id)}>
                      <BadgeCheck />
                      Mark as won
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => onLost(lead.data!.id)}>
                      <XCircle />
                      Mark as lost
                    </Button>
                  </div>
                )
              )}
              {stage?.kind === "lost" && lead.data.lostReason && <Alert tone="info">Lost: {lead.data.lostReason}</Alert>}
              {editable && !lead.data.clientId && <ActivityForm leadId={lead.data.id} />}

              <ProposalsSection lead={lead.data} />

              <div>
                <div className="mb-2 text-body font-semibold">History</div>
                {lead.data.history.length ? (
                  <ol className="space-y-3">
                    {lead.data.history.map((h) => {
                      const Icon = ACTIVITY_ICON[h.kind as ActivityKind] ?? NotebookPen;
                      return (
                        <li key={h.id} className="flex gap-3">
                          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                            <Icon className="size-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="whitespace-pre-line text-body">{h.summary}</p>
                            <p className="text-body text-muted-foreground">
                              {ACTIVITY_LABEL[h.kind as ActivityKind] ?? h.kind} · {h.by?.name ?? "Someone"} ·{" "}
                              {new Date(h.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="text-body text-muted-foreground">Nothing logged yet.</p>
                )}
              </div>

              <div>
                <div className="mb-3 text-body font-semibold">Details</div>
                <LeadFields f={f} setF={(next) => setDraft({ id: lead.data!.id, f: next })} errors={errors} stages={stages} editable={editable} />
              </div>
            </DialogBody>
            {editable && (
              <DialogFooter>
                <Button
                  variant="ghost"
                  className="mr-auto text-danger"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(lead.data!.id, {
                      onSuccess: () => {
                        toast.success(`${lead.data!.name} deleted`);
                        onClose();
                      },
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                  }
                >
                  <Trash2 />
                  Delete
                </Button>
                <Button variant="secondary" disabled={!dirty} onClick={() => setDraft(null)}>
                  Undo changes
                </Button>
                <Button
                  disabled={!dirty || save.isPending}
                  onClick={() => {
                    const input: LeadUpdate = { ...toInput(f), nextFollowUp: f.nextFollowUp || null };
                    save.mutate(
                      { id: lead.data!.id, input },
                      {
                        onSuccess: () => {
                          setDraft(null);
                          setErrors({});
                          toast.success("Lead saved");
                        },
                        onError: (e) => {
                          setErrors(issuesOf(e));
                          if (!Object.keys(issuesOf(e)).length) toast.error(errorMessage(e));
                        },
                      },
                    );
                  }}
                >
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Board and list ──────────────────────────────────────────────────

function LeadCard({ lead, onOpen, draggable }: { lead: Lead; onOpen: () => void; draggable: boolean }) {
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/lead", lead.id)}
      onClick={onOpen}
      className="w-full cursor-pointer rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition-colors hover:border-secondary/40"
    >
      <div className="truncate text-body font-medium">{lead.name}</div>
      {lead.company && <div className="truncate text-body text-muted-foreground">{lead.company}</div>}
      <div className="mt-2 flex items-center justify-between gap-2 text-body">
        <span className="font-medium tabular-nums">{lead.value ? inr(lead.value) : "—"}</span>
        {lead.owner?.name && <Avatar name={lead.owner.name} size="xs" />}
      </div>
      <div className="mt-1 text-body">
        <FollowUp date={lead.nextFollowUp} />
      </div>
    </button>
  );
}

function Board({
  leads,
  stages,
  onOpen,
  onWin,
  onLost,
}: {
  leads: Lead[];
  stages: PipelineStage[];
  onOpen: (id: string) => void;
  onWin: (id: string) => void;
  onLost: (id: string) => void;
}) {
  const can = useCan();
  const move = useMoveLead();
  const [over, setOver] = useState<string | null>(null);
  const editable = can("crm", "edit");
  return (
    <div className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {stages.map((s) => {
        const items = leads.filter((l) => l.stage === s.key);
        const total = items.reduce((n, l) => n + l.value, 0);
        return (
          <section
            key={s.key}
            aria-label={s.name}
            onDragOver={(e) => editable && (e.preventDefault(), setOver(s.key))}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/lead");
              const lead = leads.find((l) => l.id === id);
              if (!lead || lead.stage === s.key) return;
              // Winning sets up the client and agreement; losing asks why.
              if (s.kind === "won") return lead.clientId ? undefined : onWin(lead.id);
              if (s.kind === "lost") return onLost(lead.id);
              if (lead)
                move.mutate(
                  { id, stage: s.key },
                  { onSuccess: () => toast.success(`${lead.name} → ${s.name}`), onError: (err) => toast.error(errorMessage(err)) },
                );
            }}
            className={cn(
              "flex w-64 shrink-0 flex-col rounded-xl border bg-surface-secondary p-2 transition-colors",
              over === s.key ? "border-primary bg-primary-soft" : "border-border-subtle",
            )}
          >
            <header className="mb-2 px-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-body font-semibold">{s.name}</span>
                <Badge tone={s.kind === "won" ? "success" : s.kind === "lost" ? "neutral" : "outline"}>{items.length}</Badge>
              </div>
              <div className="text-body text-muted-foreground">
                {inr(total)}
                {s.kind === "open" && ` · ${s.probability}%`}
              </div>
            </header>
            <div className="space-y-2">
              {items.map((l) => (
                <LeadCard key={l.id} lead={l} onOpen={() => onOpen(l.id)} draggable={editable} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LeadList({ leads, stages, onOpen }: { leads: Lead[]; stages: PipelineStage[]; onOpen: (id: string) => void }) {
  const name = new Map(stages.map((s) => [s.key, s]));
  return (
    <Card className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>Lead</TH>
            <TH>Stage</TH>
            <TH numeric>Value a month</TH>
            <TH>Follows it up</TH>
            <TH>Next follow-up</TH>
            <TH>Source</TH>
          </TR>
        </THead>
        <TBody>
          {leads.map((l) => (
            <TR key={l.id} className="cursor-pointer" onClick={() => onOpen(l.id)}>
              <TD>
                <div className="font-medium">{l.name}</div>
                {l.company && <div className="text-muted-foreground">{l.company}</div>}
              </TD>
              <TD>
                <Badge tone={name.get(l.stage)?.kind === "won" ? "success" : name.get(l.stage)?.kind === "lost" ? "neutral" : "info"}>
                  {name.get(l.stage)?.name ?? l.stage}
                </Badge>
              </TD>
              <TD numeric>{l.value ? inr(l.value) : "—"}</TD>
              <TD>{l.owner?.name ?? "—"}</TD>
              <TD className="whitespace-nowrap">
                <FollowUp date={l.nextFollowUp} />
              </TD>
              <TD>{l.source}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

/** "Mark as won" for a lead from the board or the panel: waits for the lead's proposals and the client codes in use. */
function WinFlow({ id, onClose }: { id: string; onClose: () => void }) {
  const lead = useLead(id);
  const clients = useClients();
  const [open, setOpen] = useState(true);
  if (!lead.data || !clients.data) return null;
  return (
    <WinDialog
      key={id}
      lead={lead.data}
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose();
      }}
    />
  );
}

export function LiveSales() {
  const me = useMe().data!;
  const can = useCan();
  const leads = useLeads();
  const stages = useStages();
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [dueOnly, setDueOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [winning, setWinning] = useState<string | null>(null);
  const [losing, setLosing] = useState<string | null>(null);
  const save = useSaveLead();
  const lostStage = stages.data?.find((s) => s.kind === "lost");
  const losingLead = leads.data?.find((l) => l.id === losing);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (leads.data ?? []).filter(
      (l) =>
        (!s || [l.name, l.company, l.phone, l.email].some((v) => v?.toLowerCase().includes(s))) &&
        (!mine || l.owner?.id === me.user.id) &&
        (!dueOnly || (l.nextFollowUp && l.nextFollowUp <= today())),
    );
  }, [leads.data, q, mine, dueOnly, me.user.id]);

  const probability = new Map((stages.data ?? []).map((s) => [s.key, s.probability]));
  const openStages = new Set((stages.data ?? []).filter((s) => s.kind === "open").map((s) => s.key));
  const pipeline = shown.filter((l) => openStages.has(l.stage));
  const weighted = pipeline.reduce((n, l) => n + (l.value * (probability.get(l.stage) ?? 0)) / 100, 0);
  const due = (leads.data ?? []).filter((l) => l.nextFollowUp && l.nextFollowUp <= today() && openStages.has(l.stage)).length;

  return (
    <>
      <PageHeader
        title="Sales pipeline"
        description={
          stages.data && leads.data
            ? `${pipeline.length} open leads · ${inr(pipeline.reduce((n, l) => n + l.value, 0))} a month in play · ${inr(Math.round(weighted))} weighted${due ? ` · ${due} follow-ups due` : ""}`
            : "Every lead, its stage and when to follow up."
        }
        actions={
          can("crm", "edit") &&
          stages.data && (
            <Button onClick={() => setAdding(true)}>
              <Plus />
              New lead
            </Button>
          )
        }
      />
      <ApprovalsCard onOpen={setOpen} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input className="pl-9" placeholder="Search name, company, phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search leads" />
        </div>
        <label className="flex items-center gap-2 text-body text-text-secondary">
          <Switch checked={mine} onCheckedChange={setMine} />
          Mine
        </label>
        <label className="flex items-center gap-2 text-body text-text-secondary">
          <Switch checked={dueOnly} onCheckedChange={setDueOnly} />
          Follow-ups due
        </label>
        <div className="ml-auto flex rounded-lg border border-border p-0.5">
          <Button variant={view === "board" ? "soft" : "ghost"} size="sm" onClick={() => setView("board")} aria-pressed={view === "board"}>
            <LayoutGrid />
            Board
          </Button>
          <Button variant={view === "list" ? "soft" : "ghost"} size="sm" onClick={() => setView("list")} aria-pressed={view === "list"}>
            <List />
            List
          </Button>
        </div>
      </div>

      {leads.isPending || stages.isPending ? (
        <SkeletonRows rows={8} />
      ) : leads.error || stages.error ? (
        <Alert tone="danger">{errorMessage(leads.error ?? stages.error)}</Alert>
      ) : !leads.data.length ? (
        <Card>
          <EmptyState
            title="No leads yet"
            description={can("crm", "edit") ? "Add your first lead, or bring in your list from Excel." : "Leads you can see will appear here."}
          />
        </Card>
      ) : view === "board" ? (
        <Board leads={shown} stages={stages.data} onOpen={setOpen} onWin={setWinning} onLost={setLosing} />
      ) : (
        <LeadList leads={shown} stages={stages.data} onOpen={setOpen} />
      )}

      {stages.data && adding && <NewLeadDialog open={adding} onOpenChange={setAdding} stages={stages.data} onCreated={setOpen} />}
      {stages.data && <LeadPanel id={open} stages={stages.data} onClose={() => setOpen(null)} onWin={setWinning} onLost={setLosing} />}
      {winning && <WinFlow id={winning} onClose={() => setWinning(null)} />}
      <LostDialog
        open={!!losingLead}
        name={losingLead?.name ?? ""}
        onClose={() => setLosing(null)}
        onConfirm={(reason) => {
          const id = losing!;
          setLosing(null);
          if (lostStage)
            save.mutate(
              { id, input: { stage: lostStage.key, lostReason: reason || undefined, nextFollowUp: null } },
              { onSuccess: () => toast.success("Marked as lost"), onError: (e) => toast.error(errorMessage(e)) },
            );
        }}
      />
    </>
  );
}
