"use client";

import { useState } from "react";
import { Building, LifeBuoy, Pencil, Plus, ReceiptText, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  GST_RATES,
  LIMIT_LABEL,
  type PlanDef,
  type PlanLimits,
  type PlatformAgencyRow,
  type PlatformSettings,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUSES,
  type SubscriptionStatus,
  SUITES,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDate } from "@/lib/utils";
import { errorMessage } from "./api";
import { money } from "./plan";
import { useMe, usePlatformAgencies, usePlatformConsoleAction, usePlatformInvoices, usePlatformSettings, useSupportVisit } from "./queries";

const onError = (e: unknown) => toast.error(errorMessage(e));
const STATUS_TONE: Record<string, BadgeTone> = { trialing: "info", active: "success", past_due: "warning", expired: "danger", cancelled: "neutral" };
const size = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : bytes >= 1024 ** 2 ? `${Math.round(bytes / 1024 ** 2)} MB` : `${Math.round(bytes / 1024)} KB`;
const istDay = (at: string) => new Date(new Date(at).getTime() + 330 * 60_000).toISOString().slice(0, 10);

/** The platform console (P6-01, ADR 0011): every agency's plan, usage and health, and the plans. */
export function LivePlatform() {
  const me = useMe().data;
  const [tab, setTab] = useState("agencies");
  if (!me?.platformAdmin) return <Alert tone="danger">The platform console is for the platform&apos;s own team.</Alert>;
  return (
    <>
      <PageHeader
        title="Platform console"
        description="Every agency's plan, usage and health — the numbers, never their records — and the plans agencies choose from."
      />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="agencies">
            <Building /> Agencies
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <ReceiptText /> Invoices
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 /> Plans and settings
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "agencies" ? <Agencies /> : tab === "invoices" ? <Invoices /> : <PlatformSettingsForm />}
    </>
  );
}

function Agencies() {
  const q = usePlatformAgencies();
  const [editing, setEditing] = useState<PlatformAgencyRow | null>(null);
  const visit = useSupportVisit();
  if (q.isPending) return <SkeletonRows rows={5} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  if (!q.data.length) return <EmptyState icon={Building} title="No agencies yet" description="Agencies show here as they sign up." />;
  return (
    <Card>
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Agency</TH>
            <TH>Plan</TH>
            <TH numeric>People</TH>
            <TH numeric>Clients</TH>
            <TH numeric>AI this month</TH>
            <TH numeric>WhatsApp</TH>
            <TH numeric>Storage</TH>
            <TH>Last activity</TH>
            <TH numeric>Failed jobs</TH>
            <TH className="pr-5" />
          </TR>
        </THead>
        <TBody>
          {q.data.map((a) => (
            <TR key={a.id}>
              <TD className="pl-5">
                <div className="font-medium">{a.name}</div>
                <div className="text-body text-muted-foreground">Since {fmtDate(istDay(a.createdAt), { day: "numeric", month: "short", year: "numeric" })}</div>
              </TD>
              <TD>
                {a.plan ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>{a.plan.name}</span>
                    {a.status && (
                      <Badge tone={a.readOnly ? "danger" : (STATUS_TONE[a.status] ?? "neutral")}>
                        {a.readOnly ? "Read-only" : SUBSCRIPTION_STATUS_LABEL[a.status]}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not on a plan (everything)</span>
                )}
                {a.status === "trialing" && a.trialEndsAt && <div className="text-body text-muted-foreground">Trial to {fmtDate(istDay(a.trialEndsAt))}</div>}
              </TD>
              <TD numeric>{a.people}</TD>
              <TD numeric>{a.clients}</TD>
              <TD numeric>{a.aiDraftsThisMonth}</TD>
              <TD numeric>{a.whatsappThisMonth}</TD>
              <TD numeric>{size(a.storageBytes)}</TD>
              <TD className="text-muted-foreground">{a.lastActivityAt ? fmtDate(istDay(a.lastActivityAt), { day: "numeric", month: "short" }) : "—"}</TD>
              <TD numeric className={a.failedJobs ? "font-medium text-danger" : undefined}>
                {a.failedJobs}
              </TD>
              <TD className="pr-5">
                <div className="flex justify-end gap-1">
                  {a.support && (
                    <Button
                      size="xs"
                      variant="outline"
                      title={`They let support in (${a.support.level === "edit" ? "see and fix" : "see only"}) until ${new Date(a.support.until).toLocaleString("en-IN")}`}
                      disabled={visit.isPending}
                      onClick={() => visit.mutate({ step: "enter", agencyId: a.id }, { onError: (e) => toast.error(errorMessage(e)) })}
                    >
                      <LifeBuoy /> Enter
                    </Button>
                  )}
                  <Button size="xs" variant="ghost" aria-label={`Change ${a.name}'s plan`} onClick={() => setEditing(a)}>
                    <Pencil />
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {editing && <SubscriptionDialog a={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function SubscriptionDialog({ a, onClose }: { a: PlatformAgencyRow; onClose: () => void }) {
  const act = usePlatformConsoleAction();
  const settings = usePlatformSettings();
  const [f, setF] = useState({
    plan: a.plan?.key ?? "_none",
    status: (a.status ?? "active") as SubscriptionStatus,
    trialEndsAt: a.trialEndsAt ? istDay(a.trialEndsAt) : "",
    currentPeriodEnd: "",
  });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{a.name}&apos;s plan</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Plan" className="sm:col-span-2">
            <Select
              value={f.plan}
              onValueChange={(v) => set({ plan: v })}
              options={[
                { value: "_none", label: "Not on a plan — every suite, no limits" },
                ...(settings.data?.plans ?? []).map((p) => ({ value: p.key, label: p.name })),
              ]}
            />
          </Field>
          {f.plan !== "_none" && (
            <>
              <Field label="Status">
                <Select
                  value={f.status}
                  onValueChange={(v) => set({ status: v as SubscriptionStatus })}
                  options={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: SUBSCRIPTION_STATUS_LABEL[s] }))}
                />
              </Field>
              {f.status === "trialing" ? (
                <Field label="Trial ends on">
                  <Input type="date" value={f.trialEndsAt} onChange={(e) => set({ trialEndsAt: e.target.value })} />
                </Field>
              ) : (
                <Field label="Paid until">
                  <Input type="date" value={f.currentPeriodEnd} onChange={(e) => set({ currentPeriodEnd: e.target.value })} />
                </Field>
              )}
            </>
          )}
          <p className="text-body text-muted-foreground sm:col-span-2">The agency&apos;s own audit log records the change.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending}
            onClick={() =>
              act.mutate(
                {
                  step: "subscription",
                  agencyId: a.id,
                  body: {
                    plan: f.plan === "_none" ? null : f.plan,
                    status: f.status,
                    trialEndsAt: f.status === "trialing" ? f.trialEndsAt || null : null,
                    currentPeriodEnd: f.status !== "trialing" ? f.currentPeriodEnd || null : null,
                  },
                },
                { onSuccess: () => (toast.success("Saved"), onClose()), onError },
              )
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Invoices() {
  const q = usePlatformInvoices();
  if (q.isPending) return <SkeletonRows rows={5} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  if (!q.data.length)
    return <EmptyState icon={ReceiptText} title="No invoices yet" description="Our invoice is issued each time an agency's payment comes in." />;
  return (
    <Card>
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Number</TH>
            <TH>Date</TH>
            <TH>Agency</TH>
            <TH>Plan</TH>
            <TH>Paid through</TH>
            <TH numeric>Before tax</TH>
            <TH numeric>GST</TH>
            <TH numeric className="pr-5">
              Total
            </TH>
          </TR>
        </THead>
        <TBody>
          {q.data.map((i) => (
            <TR key={i.id}>
              <TD className="pl-5 font-mono">{i.number}</TD>
              <TD>{fmtDate(i.issuedOn, { day: "numeric", month: "short", year: "numeric" })}</TD>
              <TD>{i.agency.name}</TD>
              <TD>{i.plan.name}</TD>
              <TD className="capitalize text-muted-foreground">{i.provider === "outbox" ? "Pretend" : i.provider}</TD>
              <TD numeric>{money(i.amount, i.currency)}</TD>
              <TD numeric>{money(i.cgst + i.sgst + i.igst, i.currency)}</TD>
              <TD numeric className="pr-5 font-medium">
                {money(i.total, i.currency)}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

// ─── Plans and settings ───────────────────────────────────────────────

function PlatformSettingsForm() {
  const q = usePlatformSettings();
  if (q.isPending) return <SkeletonRows rows={6} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  return <SettingsEditor initial={q.data} />;
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));

function SettingsEditor({ initial }: { initial: PlatformSettings }) {
  const act = usePlatformConsoleAction();
  const [s, setS] = useState(initial);
  const [saved] = useState(() => new Set(initial.plans.map((p) => p.key)));
  const set = (patch: Partial<PlatformSettings>) => setS((x) => ({ ...x, ...patch }));
  const setPlan = (i: number, patch: Partial<PlanDef>) => set({ plans: s.plans.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setInvoice = (patch: Partial<PlatformSettings["invoice"]>) => set({ invoice: { ...s.invoice, ...patch } });
  return (
    <div className="space-y-5">
      <SectionCard title="The platform">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Brand name" hint="Shown on the pricing page and invoices">
            <Input value={s.brandName} onChange={(e) => set({ brandName: e.target.value })} />
          </Field>
          <Field label="Domain">
            <Input value={s.domain} onChange={(e) => set({ domain: e.target.value })} placeholder="example.com" />
          </Field>
          <Field label="Trial plan">
            <Select value={s.trialPlan} onValueChange={(v) => set({ trialPlan: v })} options={s.plans.map((p) => ({ value: p.key, label: p.name }))} />
          </Field>
          <Field label="Trial (days)">
            <Input inputMode="numeric" value={String(s.trialDays)} onChange={(e) => set({ trialDays: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Grace for a failed payment (days)">
            <Input inputMode="numeric" value={String(s.graceDays)} onChange={(e) => set({ graceDays: Number(e.target.value) || 0 })} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Our invoice details" description="On the invoices we issue to agencies (GST).">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Legal name">
            <Input value={s.invoice.legalName} onChange={(e) => setInvoice({ legalName: e.target.value })} />
          </Field>
          <Field label="GSTIN">
            <Input value={s.invoice.gstin} onChange={(e) => setInvoice({ gstin: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="State code">
            <Input value={s.invoice.stateCode} onChange={(e) => setInvoice({ stateCode: e.target.value })} placeholder="33" />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Input value={s.invoice.address} onChange={(e) => setInvoice({ address: e.target.value })} />
          </Field>
          <Field label="SAC">
            <Input value={s.invoice.sac} onChange={(e) => setInvoice({ sac: e.target.value })} />
          </Field>
          <Field label="Invoice number prefix">
            <Input value={s.invoice.prefix} onChange={(e) => setInvoice({ prefix: e.target.value })} />
          </Field>
          <Field label="GST on plans">
            <Select
              value={String(s.invoice.gstRate)}
              onValueChange={(v) => setInvoice({ gstRate: Number(v) as PlatformSettings["invoice"]["gstRate"] })}
              options={GST_RATES.map((r) => ({ value: String(r), label: `${r}%` }))}
            />
          </Field>
        </div>
      </SectionCard>

      <AnnouncementsEditor s={s} set={set} />
      <FlagsEditor s={s} set={set} />

      <div className="grid gap-4 lg:grid-cols-2">
        {s.plans.map((p, i) => (
          <Card key={i} className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input value={p.name} onChange={(e) => setPlan(i, { name: e.target.value })} />
              </Field>
              <Field label="Key" hint={saved.has(p.key) ? "Kept: agencies' plans use it" : "Lowercase letters, numbers and _"}>
                <Input value={p.key} disabled={saved.has(p.key)} onChange={(e) => setPlan(i, { key: e.target.value })} />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Input value={p.description} onChange={(e) => setPlan(i, { description: e.target.value })} />
              </Field>
              <Field label="Price a month (₹, before GST)">
                <Input inputMode="numeric" value={p.priceInr ?? ""} onChange={(e) => setPlan(i, { priceInr: num(e.target.value) })} placeholder="Not set" />
              </Field>
              <Field label="Price a month (US$)">
                <Input inputMode="numeric" value={p.priceUsd ?? ""} onChange={(e) => setPlan(i, { priceUsd: num(e.target.value) })} placeholder="Not set" />
              </Field>
            </div>
            <div className="mt-3 text-body font-medium">Suites</div>
            <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
              {SUITES.map((x) => (
                <label key={x.key} className="flex items-center gap-2 text-body">
                  <Checkbox
                    checked={p.suites.includes(x.key)}
                    onCheckedChange={(on) => setPlan(i, { suites: on ? [...p.suites, x.key] : p.suites.filter((k) => k !== x.key) })}
                  />
                  {x.label}
                </label>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(Object.keys(LIMIT_LABEL) as (keyof PlanLimits)[]).map((k) => (
                <Field key={k} label={LIMIT_LABEL[k]} hint="Empty: no limit">
                  <Input
                    inputMode="numeric"
                    value={p.limits[k] ?? ""}
                    onChange={(e) => setPlan(i, { limits: { ...p.limits, [k]: num(e.target.value) } })}
                    placeholder="No limit"
                  />
                </Field>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-body">
                <Switch checked={p.offered} onCheckedChange={(on) => setPlan(i, { offered: on })} aria-label="Offered to agencies" />
                Offered to agencies
              </label>
              <Button
                size="sm"
                variant="ghost"
                disabled={p.key === s.trialPlan || s.plans.length === 1}
                onClick={() => set({ plans: s.plans.filter((_, j) => j !== i) })}
              >
                <Trash2 /> Remove
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            set({
              plans: [
                ...s.plans,
                {
                  key: `plan_${s.plans.length + 1}`,
                  name: "New plan",
                  description: "",
                  suites: [],
                  limits: { users: 5, clients: 10, aiDrafts: 0, storageGb: 25 },
                  priceInr: null,
                  priceUsd: null,
                  offered: false,
                },
              ],
            })
          }
        >
          <Plus /> Add a plan
        </Button>
        <Button
          variant="accent"
          disabled={act.isPending}
          onClick={() => act.mutate({ step: "settings", body: s }, { onSuccess: () => toast.success("Platform settings saved"), onError })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

type SetSettings = (patch: Partial<PlatformSettings>) => void;
const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

function AnnouncementsEditor({ s, set }: { s: PlatformSettings; set: SetSettings }) {
  const change = (i: number, patch: Partial<PlatformSettings["announcements"][number]>) =>
    set({ announcements: s.announcements.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  return (
    <SectionCard title="Announcements" description="Shown above every page to the agencies chosen, between the two days.">
      <div className="space-y-3">
        {s.announcements.map((a, i) => (
          <div key={a.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Title" className="lg:col-span-2">
              <Input value={a.title} onChange={(e) => change(i, { title: e.target.value })} />
            </Field>
            <Field label="From">
              <Input type="date" value={a.from} onChange={(e) => change(i, { from: e.target.value })} />
            </Field>
            <Field label="Until">
              <Input type="date" value={a.until} onChange={(e) => change(i, { until: e.target.value })} />
            </Field>
            <Field label="Message" className="sm:col-span-2 lg:col-span-4">
              <Input value={a.body} onChange={(e) => change(i, { body: e.target.value })} />
            </Field>
            <Field label="Tone">
              <Select
                value={a.tone}
                onValueChange={(v) => change(i, { tone: v as "info" | "warning" })}
                options={[
                  { value: "info", label: "Information" },
                  { value: "warning", label: "Warning" },
                ]}
              />
            </Field>
            <div className="sm:col-span-2 lg:col-span-2">
              <div className="mb-1 text-body font-medium">For</div>
              <div className="flex flex-wrap gap-3">
                {s.plans.map((p) => (
                  <label key={p.key} className="flex items-center gap-1.5 text-body">
                    <Checkbox
                      checked={a.plans.includes(p.key)}
                      onCheckedChange={(on) => change(i, { plans: on ? [...a.plans, p.key] : a.plans.filter((k) => k !== p.key) })}
                    />
                    {p.name}
                  </label>
                ))}
                <span className="text-body text-muted-foreground">{a.plans.length ? "" : "· every agency"}</span>
              </div>
            </div>
            <div className="flex items-end justify-end">
              <Button size="sm" variant="ghost" onClick={() => set({ announcements: s.announcements.filter((_, j) => j !== i) })}>
                <Trash2 /> Remove
              </Button>
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            set({
              announcements: [
                ...s.announcements,
                { id: `a-${Date.now().toString(36)}`, title: "", body: "", tone: "info", from: today(), until: today(), plans: [] },
              ],
            })
          }
        >
          <Plus /> Add an announcement
        </Button>
      </div>
    </SectionCard>
  );
}

function FlagsEditor({ s, set }: { s: PlatformSettings; set: SetSettings }) {
  const agencies = usePlatformAgencies();
  const change = (i: number, patch: Partial<PlatformSettings["flags"][number]>) => set({ flags: s.flags.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  return (
    <SectionCard title="Feature flags" description="Switches for what is being tried out: on for every agency, or only for the agencies chosen.">
      <div className="space-y-3">
        {s.flags.map((f, i) => (
          <div key={i} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[14rem_1fr_auto]">
            <Field label="Key">
              <Input value={f.key} onChange={(e) => change(i, { key: e.target.value })} placeholder="new_editor" />
            </Field>
            <Field label="What it switches">
              <Input value={f.description} onChange={(e) => change(i, { description: e.target.value })} />
            </Field>
            <div className="flex items-end justify-end">
              <Button size="sm" variant="ghost" onClick={() => set({ flags: s.flags.filter((_, j) => j !== i) })}>
                <Trash2 /> Remove
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
              <label className="flex items-center gap-2 text-body">
                <Switch checked={f.everyone} onCheckedChange={(on) => change(i, { everyone: on })} aria-label="On for every agency" />
                On for every agency
              </label>
              {!f.everyone &&
                (agencies.data ?? []).map((a) => (
                  <label key={a.id} className="flex items-center gap-1.5 text-body">
                    <Checkbox
                      checked={f.agencies.includes(a.id)}
                      onCheckedChange={(on) => change(i, { agencies: on ? [...f.agencies, a.id] : f.agencies.filter((x) => x !== a.id) })}
                    />
                    {a.name}
                  </label>
                ))}
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => set({ flags: [...s.flags, { key: "", description: "", everyone: false, agencies: [] }] })}>
          <Plus /> Add a flag
        </Button>
      </div>
    </SectionCard>
  );
}
