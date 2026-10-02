"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Plus, Receipt, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  type AgeingReport,
  type ClientCostRow,
  type CostRateRow,
  EXPENSE_CATEGORIES,
  type ExpenseInput,
  type ExpenseRow,
  type VideoCostRow,
  VIDEO_STAGE_LABEL,
  type VideoStageKey,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, inr } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { FilesCard } from "./files";
import { MonthSwitcher, thisMonth } from "./production-bits";
import {
  useAgeing,
  useCan,
  useClientCosts,
  useClients,
  useCostingSummary,
  useCostRates,
  useCostSettings,
  useExpenseAction,
  useExpenses,
  useFinanceMonthAction,
  useFinanceMonths,
  useMe,
  useSaveCostRate,
  useSaveCostSettings,
  useVendors,
  useVideoCosts,
  useVideos,
} from "./queries";

const STATUS: Record<ExpenseRow["status"], { label: string; tone: "warning" | "success" | "danger" }> = {
  submitted: { label: "Waiting", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const onIssues = (setErrors: (e: Record<string, string>) => void) => (e: unknown) =>
  e instanceof ApiError && e.body.issues ? setErrors(Object.fromEntries(e.body.issues.map((i) => [i.path, i.message]))) : toast.error(errorMessage(e));

// ─── Expenses ─────────────────────────────────────────────────────────

/** Adding or changing an expense: what, how much, and what it is for. */
function ExpenseDialog({ e, onClose }: { e?: ExpenseRow; onClose: () => void }) {
  const can = useCan();
  const act = useExpenseAction();
  const clients = useClients();
  const videos = useVideos("", can("production", "view"));
  const vendors = useVendors();
  const [f, setF] = useState({
    date: e?.date ?? today(),
    category: e?.category ?? "",
    vendor: e?.vendor?.name ?? "",
    description: e?.description ?? "",
    amount: e ? String(e.amount) : "",
    gst: e ? String(e.gst) : "0",
    forWhat: e?.video ? "video" : e?.client ? "client" : "overhead",
    videoId: e?.video?.id ?? "",
    clientId: e?.client?.id ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const body: ExpenseInput = {
      date: f.date,
      category: f.category as ExpenseInput["category"],
      vendor: f.vendor.trim() || undefined,
      description: f.description,
      amount: Number(f.amount),
      gst: Number(f.gst || 0),
      videoId: f.forWhat === "video" ? f.videoId || undefined : undefined,
      clientId: f.forWhat === "client" ? f.clientId || undefined : undefined,
    };
    act.mutate(e ? { step: "update", id: e.id, body } : { step: "create", body }, {
      onSuccess: () => (toast.success(e ? "Saved" : "Submitted — finance will approve it"), onClose()),
      onError: onIssues(setErrors),
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{e ? "Change the expense" : "Add an expense"}</DialogTitle>
          <DialogDescription>Add the receipt after saving. Finance approves it, and it counts towards what the video or client costs.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Date" error={errors.date}>
            <Input type="date" value={f.date} onChange={(x) => setF({ ...f, date: x.target.value })} />
          </Field>
          <Field label="Category" error={errors.category}>
            <Select
              value={f.category || undefined}
              placeholder="Choose"
              onValueChange={(v) => setF({ ...f, category: v })}
              options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="What it was for" error={errors.description} className="sm:col-span-2">
            <Textarea rows={2} value={f.description} onChange={(x) => setF({ ...f, description: x.target.value })} />
          </Field>
          <Field label="Amount before GST (₹)" error={errors.amount}>
            <Input type="number" min={1} value={f.amount} onChange={(x) => setF({ ...f, amount: x.target.value })} />
          </Field>
          <Field label="GST (₹)" error={errors.gst}>
            <Input type="number" min={0} value={f.gst} onChange={(x) => setF({ ...f, gst: x.target.value })} />
          </Field>
          <Field label="Paid to" hint="A vendor; new ones are added" className="sm:col-span-2">
            <Input list="vendors" value={f.vendor} onChange={(x) => setF({ ...f, vendor: x.target.value })} />
            <datalist id="vendors">
              {vendors.data?.map((v) => (
                <option key={v.id} value={v.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Counts towards" className="sm:col-span-2">
            <Select
              value={f.forWhat}
              onValueChange={(v) => setF({ ...f, forWhat: v })}
              options={[
                ...(videos.data ? [{ value: "video", label: "A video" }] : []),
                { value: "client", label: "A client (shared across its videos)" },
                { value: "overhead", label: "Overheads (no client)" },
              ]}
            />
          </Field>
          {f.forWhat === "video" && (
            <Field label="Video" error={errors.videoId} className="sm:col-span-2">
              <Select
                value={f.videoId || undefined}
                placeholder="Choose the video"
                onValueChange={(v) => setF({ ...f, videoId: v })}
                options={(videos.data ?? []).map((v) => ({ value: v.id, label: `${v.code} · ${v.title}` }))}
              />
            </Field>
          )}
          {f.forWhat === "client" && (
            <Field label="Client" error={errors.clientId} className="sm:col-span-2">
              <Select
                value={f.clientId || undefined}
                placeholder="Choose the client"
                onValueChange={(v) => setF({ ...f, clientId: v })}
                options={(clients.data ?? []).filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={act.isPending} onClick={save}>
            {e ? "Save" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDetail({ e, onClose }: { e: ExpenseRow; onClose: () => void }) {
  const can = useCan();
  const me = useMe().data!;
  const act = useExpenseAction();
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const mine = e.submittedBy?.id === me.user.id;
  const changeable = e.status !== "approved" && (can("finance", "edit") || (mine && e.status === "submitted"));
  const decide = (approved: boolean) =>
    act.mutate(
      { step: "decide", id: e.id, approved, note: note.trim() || undefined },
      { onSuccess: () => (toast.success(approved ? "Approved" : "Rejected"), onClose()), onError: (x) => toast.error(errorMessage(x)) },
    );
  if (editing) return <ExpenseDialog e={e} onClose={onClose} />;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {inr(e.amount + e.gst)} · {e.category}
          </DialogTitle>
          <DialogDescription>
            {fmt(e.date)}
            {e.vendor && ` · ${e.vendor.name}`} · submitted by {e.submittedBy?.name ?? "—"}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <p>{e.description}</p>
          <p className="text-body text-muted-foreground">
            {inr(e.amount)} + GST {inr(e.gst)} · counts towards {e.video ? `${e.video.code} · ${e.video.title}` : e.client ? e.client.name : "overheads"}
          </p>
          <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge>
          {e.decisionNote && <Alert tone={e.status === "rejected" ? "danger" : "info"}>{e.decisionNote}</Alert>}
          <FilesCard entity="expense" entityId={e.id} title="Receipts" canEdit={changeable} />
          {e.status === "submitted" && can("finance", "approve") && (
            <Field label="Note" hint="Needed when rejecting">
              <Input value={note} onChange={(x) => setNote(x.target.value)} />
            </Field>
          )}
        </DialogBody>
        <DialogFooter>
          {changeable && (
            <>
              <Button
                variant="ghost"
                disabled={act.isPending}
                onClick={() =>
                  act.mutate(
                    { step: "remove", id: e.id },
                    { onSuccess: () => (toast.success("Removed"), onClose()), onError: (x) => toast.error(errorMessage(x)) },
                  )
                }
              >
                <Trash2 />
                Remove
              </Button>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Change
              </Button>
            </>
          )}
          {e.status === "submitted" && can("finance", "approve") && (
            <>
              <Button variant="ghost" disabled={act.isPending || !note.trim()} onClick={() => decide(false)}>
                <X />
                Reject
              </Button>
              <Button variant="success" disabled={act.isPending} onClick={() => decide(true)}>
                <Check />
                Approve
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** /app/expenses (P5-02): everyone's own expenses; finance sees and approves all. */
export function LiveExpenses() {
  const can = useCan();
  const all = can("finance", "view");
  const [month, setMonth] = useState(thisMonth());
  const [status, setStatus] = useState<"" | ExpenseRow["status"]>("");
  const list = useExpenses({ month, status });
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<ExpenseRow | null>(null);
  const rows = list.data ?? [];
  const total = rows.filter((e) => e.status !== "rejected").reduce((n, e) => n + e.amount + e.gst, 0);
  return (
    <>
      <PageHeader
        title="Expenses"
        description={
          all
            ? "What the team spent, with receipts. Approve each one and say what it counts towards — a video, a client or overheads — so costing is true."
            : "What you spent for the agency, with the receipt. Finance approves it."
        }
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus />
            Add an expense
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <MonthSwitcher month={month} onChange={setMonth} />
        <Tabs value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : (v as ExpenseRow["status"]))}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="submitted">Waiting</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="ml-auto text-body text-muted-foreground">{inr(total)} with GST</span>
      </div>
      {list.isPending ? (
        <SkeletonRows rows={5} />
      ) : list.error ? (
        <Alert tone="danger">{errorMessage(list.error)}</Alert>
      ) : !rows.length ? (
        <EmptyState icon={Receipt} title="No expenses this month" description="Add what you spent, with the receipt." />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>What</TH>
                <TH>Counts towards</TH>
                {all && <TH>By</TH>}
                <TH numeric>Amount</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {rows.map((e) => (
                <TR key={e.id} className="cursor-pointer" onClick={() => setOpen(e)}>
                  <TD className="whitespace-nowrap">{fmt(e.date)}</TD>
                  <TD>
                    <div className="font-medium">{e.description}</div>
                    <div className="text-muted-foreground">
                      {e.category}
                      {e.vendor && ` · ${e.vendor.name}`}
                      {!e.receipts && " · no receipt yet"}
                    </div>
                  </TD>
                  <TD>{e.video ? e.video.code : e.client ? e.client.name : <span className="text-muted-foreground">Overheads</span>}</TD>
                  {all && <TD>{e.submittedBy?.name ?? "—"}</TD>}
                  <TD numeric>{inr(e.amount + e.gst)}</TD>
                  <TD>
                    <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
      {adding && <ExpenseDialog onClose={() => setAdding(false)} />}
      {open && <ExpenseDetail e={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// ─── Costing ──────────────────────────────────────────────────────────

const margin = (m: number | null) =>
  m === null ? <span className="text-muted-foreground">—</span> : <span className={cn(m < 0 && "font-medium text-danger")}>{inr(m)}</span>;

function ClientCosts({ rows }: { rows: ClientCostRow[] }) {
  if (!rows.length) return <EmptyState title="Nothing to cost this month" description="Clients appear once they have a running agreement or work logged." />;
  return (
    <Card className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>Client</TH>
            <TH numeric>Pays</TH>
            <TH numeric>Labour</TH>
            <TH numeric>Shoots</TH>
            <TH numeric>Expenses</TH>
            <TH numeric>Overheads</TH>
            <TH numeric>Cost</TH>
            <TH numeric>Margin</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.client.id}>
              <TD>
                <Link href={`/app/clients/${r.client.id}`} className="font-medium hover:underline">
                  {r.client.name}
                </Link>
                <div className="text-muted-foreground">
                  {r.package ?? "No package"} · {r.videos} {r.videos === 1 ? "video" : "videos"} · {r.hours} h{r.rework ? ` · rework ${inr(r.rework)}` : ""}
                </div>
              </TD>
              <TD numeric>{inr(r.revenue)}</TD>
              <TD numeric>{inr(r.labour)}</TD>
              <TD numeric>{inr(r.shoots)}</TD>
              <TD numeric>{inr(r.expenses)}</TD>
              <TD numeric>{inr(r.overhead)}</TD>
              <TD numeric className="font-medium">
                {inr(r.total)}
              </TD>
              <TD numeric>
                {margin(r.margin)}
                {r.marginPct !== null && <div className="text-muted-foreground">{r.marginPct}%</div>}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

function VideoCosts({ rows }: { rows: VideoCostRow[] }) {
  if (!rows.length) return <EmptyState title="No videos this month" />;
  return (
    <Card className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>Video</TH>
            <TH numeric>Hours</TH>
            <TH numeric>Labour</TH>
            <TH numeric>Rework</TH>
            <TH numeric>Shoot</TH>
            <TH numeric>Expenses</TH>
            <TH numeric>Overheads</TH>
            <TH numeric>Cost</TH>
            <TH numeric>Earns</TH>
            <TH numeric>Margin</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((v) => (
            <TR key={v.id}>
              <TD>
                <Link href={`/app/production/${v.id}`} className="font-mono font-medium hover:underline">
                  {v.code}
                </Link>{" "}
                {v.title}
                <div className="text-muted-foreground">
                  {v.client.name} · {VIDEO_STAGE_LABEL[v.stage as VideoStageKey] ?? v.stage}
                </div>
              </TD>
              <TD numeric>{v.hours}</TD>
              <TD numeric>{inr(v.labour)}</TD>
              <TD numeric className={cn(v.rework > 0 && "text-warning")}>
                {inr(v.rework)}
              </TD>
              <TD numeric>{inr(v.shoots)}</TD>
              <TD numeric>{inr(v.expenses)}</TD>
              <TD numeric>{inr(v.overhead)}</TD>
              <TD numeric className="font-medium">
                {inr(v.total)}
              </TD>
              <TD numeric>{v.revenue === null ? "—" : inr(v.revenue)}</TD>
              <TD numeric>{margin(v.margin)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

/** /app/costing (P5-03): what each client's month and each video really cost, against what the client pays. */
export function LiveCosting() {
  const can = useCan();
  const [month, setMonth] = useState(thisMonth());
  const [view, setView] = useState<"clients" | "videos">("clients");
  const summary = useCostingSummary(month);
  const clients = useClientCosts(month, view === "clients");
  const videos = useVideoCosts(month, view === "videos");
  const list = view === "clients" ? clients : videos;
  return (
    <>
      <PageHeader
        title="Costing"
        description="The true cost of each client's month and each video: time at each person's cost rate, shoots and kit, expenses and a share of overheads — against what the client pays."
        actions={<MonthSwitcher month={month} onChange={setMonth} />}
      />
      {summary.data && summary.data.missingRates.length > 0 && (
        <Alert tone="warning" icon={AlertTriangle} className="mb-4">
          Time by {summary.data.missingRates.map((p) => `${p.name} (${p.hours} h)`).join(", ")} is costed at nothing: they have no cost rate yet.{" "}
          {can("salaries", "edit") && (
            <Link href="/app/settings/costing" className="underline">
              Set their rates
            </Link>
          )}
        </Alert>
      )}
      {summary.data && (
        <p className="mb-4 text-body text-muted-foreground">
          {summary.data.hours} hours logged · overheads {inr(summary.data.overheads)} shared at {inr(summary.data.overheadPerHour)} an hour
        </p>
      )}
      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="mb-4">
        <TabsList>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
        </TabsList>
      </Tabs>
      {list.isPending ? (
        <SkeletonRows rows={6} />
      ) : list.error ? (
        <Alert tone="danger">{errorMessage(list.error)}</Alert>
      ) : view === "clients" ? (
        <ClientCosts rows={clients.data ?? []} />
      ) : (
        <VideoCosts rows={videos.data ?? []} />
      )}
    </>
  );
}

// ─── Settings → Costing ───────────────────────────────────────────────

function RateDialog({ r, onClose }: { r: CostRateRow; onClose: () => void }) {
  const save = useSaveCostRate();
  const [f, setF] = useState({
    monthlyCost: String(r.current?.monthlyCost ?? ""),
    hoursPerMonth: String(r.current?.hoursPerMonth ?? 176),
    effectiveFrom: today(),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hourly = Number(f.monthlyCost) && Number(f.hoursPerMonth) ? Math.round(Number(f.monthlyCost) / Number(f.hoursPerMonth)) : null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`${r.user.name}'s cost`}</DialogTitle>
          <DialogDescription>What the person costs the agency a month — salary and what goes with it — and the working hours it covers.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-3">
          <Field label="Monthly cost (₹)" error={errors.monthlyCost}>
            <Input type="number" min={0} value={f.monthlyCost} onChange={(x) => setF({ ...f, monthlyCost: x.target.value })} />
          </Field>
          <Field label="Hours a month" error={errors.hoursPerMonth}>
            <Input type="number" min={1} value={f.hoursPerMonth} onChange={(x) => setF({ ...f, hoursPerMonth: x.target.value })} />
          </Field>
          <Field label="From" error={errors.effectiveFrom}>
            <Input type="date" value={f.effectiveFrom} onChange={(x) => setF({ ...f, effectiveFrom: x.target.value })} />
          </Field>
          {hourly !== null && <p className="text-body text-muted-foreground sm:col-span-3">That is {inr(hourly)} an hour.</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                { userId: r.user.id, body: { monthlyCost: Number(f.monthlyCost), hoursPerMonth: Number(f.hoursPerMonth), effectiveFrom: f.effectiveFrom } },
                { onSuccess: () => (toast.success("Saved"), onClose()), onError: onIssues(setErrors) },
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

function KitsAndOverheads({ canEdit }: { canEdit: boolean }) {
  const s = useCostSettings();
  const save = useSaveCostSettings();
  const [draft, setDraft] = useState<{ kits: Record<string, string>; overhead: string } | null>(null);
  if (!s.data) return <SkeletonRows rows={3} />;
  const v = draft ?? { kits: Object.fromEntries(s.data.kits.map((k) => [k.key, String(k.dailyRate)])), overhead: String(s.data.monthlyOverhead) };
  return (
    <SectionCard
      title="Kit and overheads"
      description="Each kit's cost for a shoot day, and the month's overheads that are not booked as expenses (rent, software, utilities)."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {s.data.kits.map((k) => (
          <Field key={k.key} label={`${k.name} (₹ a day)`}>
            <Input
              type="number"
              min={0}
              disabled={!canEdit}
              value={v.kits[k.key] ?? "0"}
              onChange={(x) => setDraft({ ...v, kits: { ...v.kits, [k.key]: x.target.value } })}
            />
          </Field>
        ))}
        <Field label="Overheads a month (₹)">
          <Input type="number" min={0} disabled={!canEdit} value={v.overhead} onChange={(x) => setDraft({ ...v, overhead: x.target.value })} />
        </Field>
      </div>
      {canEdit && (
        <Button
          className="mt-4"
          variant="secondary"
          disabled={!draft || save.isPending}
          onClick={() =>
            save.mutate(
              { kitRates: Object.fromEntries(Object.entries(v.kits).map(([k, n]) => [k, Number(n) || 0])), monthlyOverhead: Number(v.overhead) || 0 },
              { onSuccess: () => (setDraft(null), toast.success("Saved")), onError: (e) => toast.error(errorMessage(e)) },
            )
          }
        >
          Save
        </Button>
      )}
    </SectionCard>
  );
}

function PeopleRates({ canEdit }: { canEdit: boolean }) {
  const rates = useCostRates();
  const [open, setOpen] = useState<CostRateRow | null>(null);
  return (
    <SectionCard
      title="People's cost"
      description="Restricted like salaries. Time each person logs on videos and shoots is costed at their rate on that day; a change applies from the day you give."
    >
      {rates.isPending ? (
        <SkeletonRows rows={5} />
      ) : rates.error ? (
        <Alert tone="danger">{errorMessage(rates.error)}</Alert>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Person</TH>
              <TH numeric>Monthly cost</TH>
              <TH numeric>Hours</TH>
              <TH numeric>An hour</TH>
              <TH>Since</TH>
            </TR>
          </THead>
          <TBody>
            {rates.data.map((r) => (
              <TR key={r.user.id} className={cn(canEdit && "cursor-pointer")} onClick={() => canEdit && setOpen(r)}>
                <TD>
                  <span className="font-medium">{r.user.name}</span>
                  {r.user.role && <span className="text-muted-foreground"> · {r.user.role.replace(/_/g, " ")}</span>}
                </TD>
                <TD numeric>{r.current ? inr(r.current.monthlyCost) : <span className="text-warning">Not set</span>}</TD>
                <TD numeric>{r.current?.hoursPerMonth ?? "—"}</TD>
                <TD numeric>{r.hourly !== null ? inr(r.hourly) : "—"}</TD>
                <TD>{r.current ? fmt(r.current.effectiveFrom) : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {open && <RateDialog r={open} onClose={() => setOpen(null)} />}
    </SectionCard>
  );
}

/** Settings → Costing (P5-01). */
export function LiveCostingSettings() {
  const can = useCan();
  return (
    <>
      <PageHeader title="Costing" description="What time, kit and overheads cost, so Costing shows each video's and each client's true cost." />
      <div className="space-y-4">
        {can("finance", "view") && <KitsAndOverheads canEdit={can("finance", "edit")} />}
        {can("salaries", "view") && <PeopleRates canEdit={can("salaries", "edit")} />}
      </div>
    </>
  );
}

// ─── Finance: the month's money and who owes what (P5-04, P5-05) ─────

function ReopenDialog({ month, onClose }: { month: string; onClose: () => void }) {
  const act = useFinanceMonthAction();
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reopen {monthLabel(month)}</DialogTitle>
          <DialogDescription>Time and expenses dated in it can change again, and its figures are worked out afresh until it is closed again.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="Why">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending || reason.trim().length < 3}
            onClick={() =>
              act.mutate(
                { step: "reopen", month, reason },
                { onSuccess: () => (toast.success("Reopened"), onClose()), onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            Reopen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

function Months() {
  const can = useCan();
  const months = useFinanceMonths();
  const act = useFinanceMonthAction();
  const [reopening, setReopening] = useState<string | null>(null);
  const current = thisMonth();
  if (months.isPending) return <SkeletonRows rows={6} />;
  if (months.error) return <Alert tone="danger">{errorMessage(months.error)}</Alert>;
  return (
    <Card className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>Month</TH>
            <TH numeric>Contracted</TH>
            <TH numeric>Invoiced</TH>
            <TH numeric>Earned</TH>
            <TH numeric>Collected</TH>
            <TH numeric>Costs</TH>
            <TH numeric>Margin</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {months.data.map((m) => (
            <TR key={m.month}>
              <TD className="font-medium">
                {monthLabel(m.month)}
                {m.closed && <div className="text-muted-foreground">Closed{m.closedBy ? ` by ${m.closedBy}` : ""}</div>}
              </TD>
              <TD numeric>{inr(m.contracted)}</TD>
              <TD numeric>{inr(m.invoiced)}</TD>
              <TD numeric>{inr(m.earned)}</TD>
              <TD numeric>{inr(m.collected)}</TD>
              <TD numeric>{inr(m.costs)}</TD>
              <TD numeric>
                {margin(m.margin)}
                {m.marginPct !== null && <div className="text-muted-foreground">{m.marginPct}%</div>}
              </TD>
              <TD className="text-right">
                {can("finance", "approve") &&
                  m.month < current &&
                  (m.closed ? (
                    <Button size="xs" variant="ghost" onClick={() => setReopening(m.month)}>
                      Reopen
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      variant="secondary"
                      disabled={act.isPending}
                      onClick={() =>
                        act.mutate(
                          { step: "close", month: m.month },
                          { onSuccess: () => toast.success(`${monthLabel(m.month)} is closed`), onError: (e) => toast.error(errorMessage(e)) },
                        )
                      }
                    >
                      Close the month
                    </Button>
                  ))}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <p className="border-t border-border-subtle px-4 py-2 text-body text-muted-foreground">
        Earned is each agreement&rsquo;s fee in proportion to the videos delivered; invoiced is before GST, collected with it. A closed month keeps its figures, and
        time and expenses dated in it cannot change until it is reopened.
      </p>
      {reopening && <ReopenDialog month={reopening} onClose={() => setReopening(null)} />}
    </Card>
  );
}

const BUCKETS = [
  ["notDue", "Not due"],
  ["d1to30", "1–30 days"],
  ["d31to60", "31–60"],
  ["d61to90", "61–90"],
  ["over90", "Over 90"],
] as const;

function Ageing() {
  const ageing = useAgeing();
  const me = useMe().data!;
  const agency = me.agencies.find((a) => a.id === me.activeAgencyId)?.name ?? "us";
  if (ageing.isPending) return <SkeletonRows rows={5} />;
  if (ageing.error) return <Alert tone="danger">{errorMessage(ageing.error)}</Alert>;
  if (!ageing.data.clients.length) return <EmptyState icon={Receipt} title="Nothing is owed" description="Every issued invoice is paid." />;
  const reminder = (c: AgeingReport["clients"][number], i: AgeingReport["clients"][number]["invoices"][number]) => {
    const first = c.contact?.name.split(/\s+/)[0] ?? "there";
    const text = `Hello ${first}, a gentle reminder from ${agency}: invoice ${i.number ?? ""} for ${inr(i.balance)}${i.dueDate ? ` was due on ${fmt(i.dueDate)}` : " is due"}.${i.payUrl ? ` You can pay here: ${i.payUrl}` : ""} Thank you!`;
    const digits = c.contact?.phone.replace(/\D/g, "") ?? "";
    return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(text)}`;
  };
  return (
    <div className="space-y-4">
      <Card className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-6">
        {BUCKETS.map(([k, label]) => (
          <div key={k}>
            <div className="text-body text-muted-foreground">{label}</div>
            <div className={cn("font-semibold tabular-nums", k !== "notDue" && ageing.data.totals[k] > 0 && "text-danger")}>{inr(ageing.data.totals[k])}</div>
          </div>
        ))}
        <div>
          <div className="text-body text-muted-foreground">Owed in all</div>
          <div className="font-semibold tabular-nums">{inr(ageing.data.totals.total)}</div>
        </div>
      </Card>
      {ageing.data.clients.map((c) => (
        <SectionCard key={c.client.id} title={c.client.name} description={`${inr(c.buckets.total)} owed${c.contact ? ` · ${c.contact.name}` : ""}`}>
          <ul className="divide-y divide-border-subtle">
            {c.invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-body">
                <span>
                  <Link href={`/app/invoices/${i.id}`} className="font-medium hover:underline">
                    {i.number ?? "Invoice"}
                  </Link>{" "}
                  · {inr(i.balance)} ·{" "}
                  {i.daysOverdue ? <span className="text-danger">{i.daysOverdue} days late</span> : i.dueDate ? `due ${fmt(i.dueDate)}` : "no due date"}
                </span>
                {c.contact && i.daysOverdue > 0 && (
                  <Button size="xs" variant="secondary" asChild>
                    <a href={reminder(c, i)} target="_blank" rel="noreferrer">
                      Remind on WhatsApp
                    </a>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}
    </div>
  );
}

/** /app/finance: the month's money, closing months, and who owes what. */
export function LiveFinance() {
  const [view, setView] = useState<"months" | "owed">("months");
  return (
    <>
      <PageHeader
        title="Finance"
        description="Each month's money — contracted, invoiced, earned by delivering, collected and spent — and what clients owe, by how late."
      />
      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="mb-4">
        <TabsList>
          <TabsTrigger value="months">Months</TabsTrigger>
          <TabsTrigger value="owed">Who owes what</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "months" ? <Months /> : <Ageing />}
    </>
  );
}
