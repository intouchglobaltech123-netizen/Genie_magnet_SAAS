"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Download, Lock, Plus, Printer, RefreshCw, Trash2, Unlock, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  DAY_BASES,
  DAY_BASIS_LABEL,
  DEDUCTION_KIND_LABEL,
  DEDUCTION_KINDS,
  type DeductionKind,
  type PayrollRunRow,
  type PayrollSettings,
  type PayslipRow,
  type SalaryRow,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, inr } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { MonthSwitcher, monthLabel, shiftMonth, thisMonth } from "./production-bits";
import { fetchBankSheet, useCan, useMyPayslips, usePayrollAction, usePayrollRun, usePayrollRuns, usePayrollSettings, usePayslip, useSalaries } from "./queries";

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const days = (n: number) => `${n % 1 ? n.toFixed(1).replace(/\.0$/, "") : n} ${n === 1 ? "day" : "days"}`;
const onError = (e: unknown) => toast.error(errorMessage(e));
const issuesOf = (setErrors: (e: Record<string, string>) => void) => (e: unknown) =>
  e instanceof ApiError && e.body.issues ? setErrors(Object.fromEntries(e.body.issues.map((i) => [i.path, i.message]))) : onError(e);

// ─── The month's run ──────────────────────────────────────────────────

/** Why the days paid are what they are, in words. */
function daysWhy(p: PayslipRow) {
  const d = p.days;
  const why = [
    d.absent && `${days(d.absent)} absent`,
    d.halfDays && `${d.halfDays} half ${d.halfDays === 1 ? "day" : "days"}`,
    d.unpaidLeave && `${days(d.unpaidLeave)} unpaid leave`,
    d.latePenalty && `${days(d.latePenalty)} for ${d.lates} late days`,
    d.extra && `${days(d.extra)} added by payroll`,
  ].filter(Boolean);
  return why.length ? why.join(" · ") : "No days without pay";
}

function PayslipDialog({
  month,
  slip,
  settings,
  editable,
  onClose,
}: {
  month: string;
  slip: PayslipRow;
  settings: PayrollSettings | undefined;
  editable: boolean;
  onClose: () => void;
}) {
  const act = usePayrollAction();
  const perPerson = (settings?.deductions ?? []).filter((d) => d.kind === "each_person").map((d) => d.name);
  const [adjustments, setAdjustments] = useState(slip.adjustments.map((a) => ({ name: a.name, amount: String(a.amount) })));
  const [entries, setEntries] = useState<Record<string, string>>(Object.fromEntries(perPerson.map((n) => [n, slip.entries[n] ? String(slip.entries[n]) : ""])));
  const [extraLop, setExtraLop] = useState(String(slip.extraLop || ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () =>
    act.mutate(
      {
        step: "change",
        month,
        userId: slip.user.id,
        body: {
          adjustments: adjustments.filter((a) => a.name.trim() || a.amount).map((a) => ({ name: a.name.trim(), amount: Math.round(Number(a.amount) || 0) })),
          entries: Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, Math.round(Number(v) || 0)])),
          extraLop: Number(extraLop) || 0,
        },
      },
      { onSuccess: () => (toast.success("Worked out again"), onClose()), onError: issuesOf(setErrors) },
    );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {slip.user.name} · {monthLabel(month)}
          </DialogTitle>
          <DialogDescription>
            Paid for {days(slip.days.paid)} of {days(slip.days.employed)} · {daysWhy(slip)}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {slip.notes.map((n) => (
            <Alert key={n} tone="warning">
              {n}
            </Alert>
          ))}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-body font-medium">Earnings</div>
              <Table>
                <TBody>
                  {slip.earnings.map((e) => (
                    <TR key={e.name}>
                      <TD>
                        {e.name}
                        <div className="text-muted-foreground">{inr(e.amount)} a month</div>
                      </TD>
                      <TD numeric>{inr(e.paid)}</TD>
                    </TR>
                  ))}
                  <TR>
                    <TD className="font-medium">Gross</TD>
                    <TD numeric className="font-medium">
                      {inr(slip.gross)}
                    </TD>
                  </TR>
                </TBody>
              </Table>
            </div>
            <div>
              <div className="mb-1 text-body font-medium">Deductions</div>
              <Table>
                <TBody>
                  {slip.deductions.length ? (
                    slip.deductions.map((d) => (
                      <TR key={d.name}>
                        <TD>{d.name}</TD>
                        <TD numeric>{inr(d.amount)}</TD>
                      </TR>
                    ))
                  ) : (
                    <TR>
                      <TD className="text-muted-foreground">None</TD>
                    </TR>
                  )}
                  {slip.contributions.map((c) => (
                    <TR key={c.name}>
                      <TD className="text-muted-foreground">{c.name} (paid by the agency)</TD>
                      <TD numeric className="text-muted-foreground">
                        {inr(c.amount)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </div>
          {editable ? (
            <SectionCard
              title="This month only"
              description="A bonus or reimbursement (plus), an advance recovered (minus), amounts entered each month, and days without pay the attendance does not show."
            >
              <div className="space-y-2">
                {adjustments.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="e.g. Festival bonus"
                      value={a.name}
                      onChange={(e) => setAdjustments(adjustments.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <Input
                      type="number"
                      className="w-36"
                      aria-label="Amount"
                      value={a.amount}
                      onChange={(e) => setAdjustments(adjustments.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                    />
                    <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => setAdjustments(adjustments.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="secondary" onClick={() => setAdjustments([...adjustments, { name: "", amount: "" }])}>
                  <Plus />
                  Add a line
                </Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {perPerson.map((n) => (
                  <Field key={n} label={n} hint="This month">
                    <Input type="number" min={0} value={entries[n] ?? ""} onChange={(e) => setEntries({ ...entries, [n]: e.target.value })} />
                  </Field>
                ))}
                <Field label="Days without pay to add" hint="In half days; minus to forgive" error={errors.extraLop}>
                  <Input type="number" step={0.5} value={extraLop} onChange={(e) => setExtraLop(e.target.value)} />
                </Field>
              </div>
            </SectionCard>
          ) : (
            slip.adjustments.length > 0 && (
              <p className="text-body">
                This month only: {slip.adjustments.map((a) => `${a.name} ${a.amount < 0 ? "−" : "+"}${inr(Math.abs(a.amount))}`).join(" · ")}
              </p>
            )
          )}
          <div className="flex items-baseline justify-between rounded-xl bg-muted px-4 py-3">
            <span className="font-medium">Net pay</span>
            <span className="text-lg font-semibold tabular-nums">{inr(slip.net)}</span>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" asChild>
            <Link href={`/app/payslips/${slip.id}`}>
              <Printer />
              The payslip
            </Link>
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {editable && (
            <Button disabled={act.isPending} onClick={save}>
              Save and work out again
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnlockDialog({ month, onClose }: { month: string; onClose: () => void }) {
  const act = usePayrollAction();
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock {monthLabel(month)}</DialogTitle>
          <DialogDescription>
            The month&rsquo;s attendance can change again, and payroll is worked out again before it is locked. Payslips already given stay with each person
            until then.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="Why">
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. A missed punch was corrected" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={reason.trim().length < 3 || act.isPending}
            onClick={() => act.mutate({ step: "unlock", month, reason }, { onSuccess: onClose, onError })}
          >
            <Unlock />
            Unlock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function downloadBankSheet(month: string) {
  try {
    const s = await fetchBankSheet(month);
    const url = URL.createObjectURL(new Blob([s.csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: s.fileName });
    a.click();
    URL.revokeObjectURL(url);
    if (s.missing.length) toast.warning(`No bank account for ${s.missing.join(", ")} — add it on their employee record.`);
  } catch (e) {
    onError(e);
  }
}

function RunView({ month }: { month: string }) {
  const can = useCan();
  const run = usePayrollRun(month);
  const settings = usePayrollSettings();
  const act = usePayrollAction();
  const [open, setOpen] = useState<PayslipRow | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  if (run.isPending) return <SkeletonRows rows={6} />;
  if (run.error) {
    if (run.error instanceof ApiError && run.error.status === 404)
      return (
        <EmptyState
          icon={Wallet}
          title={`No payroll for ${monthLabel(month)} yet`}
          description="It is worked out from each person's salary, the month's attendance and leave, and your deductions. You check it, adjust it and lock it."
          action={
            can("salaries", "edit") ? (
              <Button disabled={act.isPending} onClick={() => act.mutate({ step: "start", month }, { onError })}>
                Work out {monthLabel(month)}
              </Button>
            ) : undefined
          }
        />
      );
    return <Alert tone="danger">{errorMessage(run.error)}</Alert>;
  }
  const r: PayrollRunRow = run.data;
  const draft = r.status === "draft";
  const editable = draft && can("salaries", "edit");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={draft ? "warning" : "success"}>{draft ? "Draft" : "Locked"}</Badge>
          {!draft && r.lockedAt && (
            <span className="text-body text-muted-foreground">
              by {r.lockedBy} on {fmt(new Date(new Date(r.lockedAt).getTime() + 330 * 60_000).toISOString().slice(0, 10))}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <>
              <Button variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ step: "remove", month }, { onError })}>
                <Trash2 />
                Remove draft
              </Button>
              <Button
                variant="secondary"
                disabled={act.isPending}
                onClick={() => act.mutate({ step: "refresh", month }, { onSuccess: () => toast.success("Worked out again"), onError })}
              >
                <RefreshCw />
                Work out again
              </Button>
            </>
          )}
          {draft && can("salaries", "approve") && (
            <Button
              disabled={act.isPending}
              onClick={() => act.mutate({ step: "lock", month }, { onSuccess: () => toast.success("Locked — each person can see their payslip"), onError })}
            >
              <Lock />
              Lock and give out payslips
            </Button>
          )}
          {!draft && can("salaries", "approve") && (
            <>
              <Button variant="ghost" onClick={() => setUnlocking(true)}>
                <Unlock />
                Unlock
              </Button>
              <Button variant="secondary" onClick={() => void downloadBankSheet(month)}>
                <Download />
                Bank transfer sheet
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="People" value={r.people} />
        <StatCard label="Gross" value={inr(r.gross)} />
        <StatCard label="Deductions" value={inr(r.deductions)} hint={r.contributions ? `The agency adds ${inr(r.contributions)}` : undefined} />
        <StatCard label="Net pay" value={inr(r.net)} tone="success" />
      </div>
      {r.notes.map((n) => (
        <Alert key={n} tone="info">
          {n}{" "}
          <Link href="/app/payroll?tab=salaries" className="underline">
            Set salaries
          </Link>
        </Alert>
      ))}
      <Card className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Person</TH>
              <TH numeric>Days paid</TH>
              <TH numeric>Gross</TH>
              <TH numeric>Deductions</TH>
              <TH numeric>This month only</TH>
              <TH numeric>Net pay</TH>
            </TR>
          </THead>
          <TBody>
            {r.payslips?.map((p) => (
              <TR key={p.id} className="cursor-pointer" onClick={() => setOpen(p)}>
                <TD>
                  <div className="flex items-center gap-1.5 font-medium">
                    {p.user.name}
                    {p.notes.length > 0 && <AlertTriangle className="size-3.5 text-warning" aria-label="Worth a look" />}
                  </div>
                  <div className="text-muted-foreground">{daysWhy(p)}</div>
                </TD>
                <TD numeric>
                  {p.days.paid} / {p.days.employed}
                </TD>
                <TD numeric>{inr(p.gross)}</TD>
                <TD numeric>{inr(p.totalDeductions)}</TD>
                <TD numeric>{p.adjustments.length ? inr(p.adjustments.reduce((s, a) => s + a.amount, 0)) : "—"}</TD>
                <TD numeric className={cn("font-medium", p.net < 0 && "text-danger")}>
                  {inr(p.net)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      {open && <PayslipDialog month={month} slip={open} settings={settings.data} editable={editable} onClose={() => setOpen(null)} />}
      {unlocking && <UnlockDialog month={month} onClose={() => setUnlocking(false)} />}
    </div>
  );
}

function Runs() {
  const runs = usePayrollRuns();
  const [month, setMonth] = useState(shiftMonth(thisMonth(), -1));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <MonthSwitcher month={month} onChange={setMonth} />
        <div className="flex flex-wrap gap-1.5">
          {runs.data?.slice(0, 6).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setMonth(r.month)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-body",
                r.month === month ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {monthLabel(r.month)} · {r.status === "locked" ? inr(r.net) : "draft"}
            </button>
          ))}
        </div>
      </div>
      <RunView key={month} month={month} />
    </div>
  );
}

// ─── Salaries ─────────────────────────────────────────────────────────

function SalaryDialog({ row, onClose }: { row: SalaryRow; onClose: () => void }) {
  const can = useCan();
  const act = usePayrollAction();
  const [from, setFrom] = useState(`${thisMonth()}-01`);
  const [parts, setParts] = useState((row.current?.earnings ?? [{ name: "Basic", amount: 0 }]).map((e) => ({ name: e.name, amount: String(e.amount || "") })));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const total = parts.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{row.user.name}&rsquo;s salary</DialogTitle>
          <DialogDescription>
            {row.current ? `${inr(row.current.total)} a month since ${fmt(row.current.from)}.` : "No salary set yet."} A new salary applies from the day you
            pick; months already locked keep what they paid.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <Field label="From" error={errors.from}>
            <Input type="date" className="w-48" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <div>
            <div className="mb-1 text-body text-muted-foreground">Parts of the monthly salary, as your payslips show them</div>
            <div className="space-y-2">
              {parts.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="e.g. Basic"
                    value={p.name}
                    onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                  <Input
                    type="number"
                    min={0}
                    className="w-40"
                    aria-label={`${p.name || "Part"} a month`}
                    value={p.amount}
                    onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove"
                    disabled={parts.length === 1}
                    onClick={() => setParts(parts.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            {errors.earnings && <p className="mt-1 text-body text-danger">{errors.earnings}</p>}
            <div className="mt-2 flex items-center justify-between">
              <Button size="sm" variant="secondary" onClick={() => setParts([...parts, { name: "", amount: "" }])}>
                <Plus />
                Add a part
              </Button>
              <span className="text-body">
                A month: <span className="font-semibold tabular-nums">{inr(total)}</span>
              </span>
            </div>
          </div>
          <Field label="Note" hint="Optional, e.g. yearly raise">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {row.history.length > 0 && (
            <div>
              <div className="mb-1 text-body text-muted-foreground">Salaries so far</div>
              <ul className="divide-y divide-border-subtle text-body">
                {row.history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-1.5">
                    <span>
                      From {fmt(h.from)} · {inr(h.total)} a month
                    </span>
                    {can("salaries", "edit") && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove the salary from ${fmt(h.from)}`}
                        onClick={() => act.mutate({ step: "removeSalary", id: h.id }, { onSuccess: onClose, onError })}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
                  step: "salary",
                  userId: row.user.id,
                  body: {
                    from,
                    earnings: parts.map((p) => ({ name: p.name.trim(), amount: Math.round(Number(p.amount) || 0) })),
                    note: note.trim() || undefined,
                  },
                },
                {
                  onSuccess: () => (toast.success("Salary saved"), onClose()),
                  onError: (e) =>
                    e instanceof ApiError && e.body.issues
                      ? setErrors(Object.fromEntries(e.body.issues.map((i) => [i.path.startsWith("earnings") ? "earnings" : i.path, i.message])))
                      : onError(e),
                },
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

function Salaries() {
  const can = useCan();
  const rows = useSalaries();
  const [open, setOpen] = useState<SalaryRow | null>(null);
  if (rows.isPending) return <SkeletonRows rows={6} />;
  if (rows.error) return <Alert tone="danger">{errorMessage(rows.error)}</Alert>;
  return (
    <>
      <Card className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Person</TH>
              <TH>Code</TH>
              <TH numeric>A month</TH>
              <TH>Since</TH>
            </TR>
          </THead>
          <TBody>
            {rows.data.map((r) => (
              <TR key={r.user.id} className={cn(can("salaries", "edit") && "cursor-pointer")} onClick={() => can("salaries", "edit") && setOpen(r)}>
                <TD className="font-medium">{r.user.name}</TD>
                <TD className="font-mono">{r.employeeCode ?? "—"}</TD>
                <TD numeric>{r.current ? inr(r.current.total) : <span className="text-muted-foreground">Not set</span>}</TD>
                <TD>{r.current ? fmt(r.current.from) : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      {open && <SalaryDialog row={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// ─── Rules ────────────────────────────────────────────────────────────

type RuleDraft = {
  name: string;
  kind: DeductionKind;
  of: string;
  percent: string;
  ceiling: string;
  amount: string;
  slabs: { upTo: string; amount: string }[];
  onlyUpTo: string;
  employer: boolean;
};
const str = (n: number | null | undefined) => (n === undefined || n === null ? "" : String(n));
const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

function Rules({ s }: { s: PayrollSettings }) {
  const can = useCan();
  const act = usePayrollAction();
  const [basis, setBasis] = useState(s.dayBasis);
  const [lates, setLates] = useState(str(s.latesPerHalfDay));
  const [rules, setRules] = useState<RuleDraft[]>(
    s.deductions.map((d) => ({
      name: d.name,
      kind: d.kind,
      of: d.of.join(", "),
      percent: str(d.percent),
      ceiling: str(d.ceiling),
      amount: str(d.amount),
      slabs: d.slabs.map((x) => ({ upTo: str(x.upTo), amount: str(x.amount) })),
      onlyUpTo: str(d.onlyUpTo),
      employer: d.employer,
    })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (i: number, patch: Partial<RuleDraft>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const editable = can("salaries", "edit");
  const save = () =>
    act.mutate(
      {
        step: "settings",
        body: {
          dayBasis: basis,
          latesPerHalfDay: lates.trim() ? Number(lates) : null,
          deductions: rules.map((r) => ({
            name: r.name.trim(),
            kind: r.kind,
            of: r.of
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
            percent: r.kind === "percent" ? num(r.percent) : undefined,
            ceiling: r.kind === "percent" ? num(r.ceiling) : undefined,
            amount: r.kind === "fixed" ? num(r.amount) : undefined,
            slabs: r.kind === "slabs" ? r.slabs.map((x) => ({ upTo: x.upTo.trim() ? Number(x.upTo) : null, amount: Number(x.amount) || 0 })) : [],
            onlyUpTo: num(r.onlyUpTo),
            employer: r.employer,
          })),
        },
      },
      { onSuccess: () => (setErrors({}), toast.success("Saved")), onError: issuesOf(setErrors) },
    );
  return (
    <div className="space-y-4">
      <SectionCard title="Days" description="How a day's pay is worked out, for days without pay and for part of a month.">
        <fieldset disabled={!editable} className="grid gap-3 sm:grid-cols-2">
          <Field label="A day's pay is the month's salary over">
            <Select
              value={basis}
              onValueChange={(v) => setBasis(v as typeof basis)}
              options={DAY_BASES.map((b) => ({ value: b, label: DAY_BASIS_LABEL[b] }))}
            />
          </Field>
          <Field label="Late days that count as half a day without pay" hint="Leave empty if lateness is not taken off pay">
            <Input type="number" min={1} max={31} value={lates} onChange={(e) => setLates(e.target.value)} />
          </Field>
        </fieldset>
      </SectionCard>
      <SectionCard
        title="Deductions and contributions"
        description="Add each one your auditor gives you — such as provident fund, ESI, professional tax and income tax — with its rate. Nothing is assumed: the app only works out what you enter here."
      >
        {errors.deductions && <Alert tone="danger">{errors.deductions}</Alert>}
        <div className="space-y-3">
          {rules.map((r, i) => (
            <fieldset key={i} disabled={!editable} className="rounded-xl border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Field label="Name" error={errors[`deductions.${i}.name`]}>
                  <Input value={r.name} placeholder="e.g. Provident fund" onChange={(e) => set(i, { name: e.target.value })} />
                </Field>
                <Field label="Worked out as">
                  <Select
                    value={r.kind}
                    onValueChange={(v) => set(i, { kind: v as DeductionKind })}
                    options={DEDUCTION_KINDS.map((k) => ({ value: k, label: DEDUCTION_KIND_LABEL[k] }))}
                  />
                </Field>
                <div className="flex items-end">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${r.name || "this deduction"}`}
                    onClick={() => setRules(rules.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {r.kind === "percent" && (
                  <>
                    <Field label="Percent" error={errors[`deductions.${i}.percent`]}>
                      <Input type="number" min={0} max={100} step="any" value={r.percent} onChange={(e) => set(i, { percent: e.target.value })} />
                    </Field>
                    <Field label="Of these parts" hint="Comma-separated; empty for the whole salary">
                      <Input value={r.of} placeholder="e.g. Basic" onChange={(e) => set(i, { of: e.target.value })} />
                    </Field>
                    <Field label="Worked out on at most" hint="A ceiling, if the rule has one">
                      <Input type="number" min={0} value={r.ceiling} onChange={(e) => set(i, { ceiling: e.target.value })} />
                    </Field>
                  </>
                )}
                {r.kind === "fixed" && (
                  <Field label="Amount a month" error={errors[`deductions.${i}.amount`]}>
                    <Input type="number" min={0} value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} />
                  </Field>
                )}
                {r.kind === "slabs" && (
                  <div className="sm:col-span-3">
                    <div className="mb-1 text-body text-muted-foreground">By the month&rsquo;s salary as paid: up to (empty for anything above) → amount</div>
                    {errors[`deductions.${i}.slabs`] && <p className="mb-1 text-body text-danger">{errors[`deductions.${i}.slabs`]}</p>}
                    <div className="space-y-2">
                      {r.slabs.map((x, k) => (
                        <div key={k} className="flex gap-2">
                          <Input
                            type="number"
                            min={0}
                            placeholder="Up to (empty: above)"
                            value={x.upTo}
                            onChange={(e) => set(i, { slabs: r.slabs.map((y, m) => (m === k ? { ...y, upTo: e.target.value } : y)) })}
                          />
                          <Input
                            type="number"
                            min={0}
                            placeholder="Amount"
                            value={x.amount}
                            onChange={(e) => set(i, { slabs: r.slabs.map((y, m) => (m === k ? { ...y, amount: e.target.value } : y)) })}
                          />
                          <Button size="icon-sm" variant="ghost" aria-label="Remove slab" onClick={() => set(i, { slabs: r.slabs.filter((_, m) => m !== k) })}>
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" variant="secondary" onClick={() => set(i, { slabs: [...r.slabs, { upTo: "", amount: "" }] })}>
                        <Plus />
                        Add a slab
                      </Button>
                    </div>
                  </div>
                )}
                {r.kind === "each_person" && (
                  <p className="text-body text-muted-foreground sm:col-span-3">Payroll enters each person&rsquo;s amount on their payslip each month.</p>
                )}
                <Field label="Only when the monthly salary is at most" hint="Leave empty if it applies to everyone">
                  <Input type="number" min={0} value={r.onlyUpTo} onChange={(e) => set(i, { onlyUpTo: e.target.value })} />
                </Field>
                <label className="flex items-center gap-2 text-body sm:col-span-2 sm:self-end sm:pb-2">
                  <Switch aria-label="Paid by the agency on top" checked={r.employer} onCheckedChange={(employer) => set(i, { employer })} />
                  Paid by the agency on top of the salary (shown, not taken from it)
                </label>
              </div>
            </fieldset>
          ))}
        </div>
        {editable && (
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() =>
              setRules([...rules, { name: "", kind: "percent", of: "", percent: "", ceiling: "", amount: "", slabs: [], onlyUpTo: "", employer: false }])
            }
          >
            <Plus />
            Add a deduction
          </Button>
        )}
      </SectionCard>
      {editable && (
        <Button disabled={act.isPending} onClick={save}>
          Save the rules
        </Button>
      )}
    </div>
  );
}

/** /app/payroll: the month's run, salaries and the agency's payroll rules. */
export function LivePayroll({ initialTab }: { initialTab?: string }) {
  const settings = usePayrollSettings();
  const [tab, setTab] = useState(initialTab === "salaries" || initialTab === "rules" ? initialTab : "run");
  return (
    <>
      <PageHeader
        title="Payroll"
        description="Each month worked out from salaries, attendance and leave, with your own deductions; checked, adjusted and locked, when each person gets their payslip."
      />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="run">Monthly run</TabsTrigger>
          <TabsTrigger value="salaries">Salaries</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "run" ? <Runs /> : tab === "salaries" ? <Salaries /> : settings.data ? <Rules s={settings.data} /> : <SkeletonRows rows={4} />}
    </>
  );
}

// ─── Payslips ─────────────────────────────────────────────────────────

/** /app/payslips: each person's own payslips. */
export function LivePayslips() {
  const list = useMyPayslips();
  return (
    <>
      <PageHeader title="My payslips" description="Each month's payslip, once payroll has locked the month." />
      {list.isPending ? (
        <SkeletonRows rows={3} />
      ) : !list.data?.length ? (
        <EmptyState icon={Wallet} title="No payslips yet" description="Your payslip shows here once payroll locks the month." />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Month</TH>
                <TH numeric>Days paid</TH>
                <TH numeric>Net pay</TH>
              </TR>
            </THead>
            <TBody>
              {list.data.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/app/payslips/${p.id}`} className="font-medium hover:underline">
                      {monthLabel(p.month)}
                    </Link>
                  </TD>
                  <TD numeric>{p.days.paid}</TD>
                  <TD numeric>{inr(p.net)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}

function PayslipDocument({ p }: { p: PayslipRow }) {
  const brand = p.employer?.brandColor ?? "#1E3A8A";
  const rows = Math.max(p.earnings.length, p.deductions.length);
  return (
    <article className="relative mx-auto max-w-[820px] rounded-xl bg-white p-8 text-[13px] leading-relaxed text-neutral-900 shadow-card print:max-w-none print:rounded-none print:p-0 print:shadow-none sm:p-10">
      {p.status === "draft" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
          <span className="-rotate-12 select-none text-[96px] font-bold tracking-widest text-neutral-200/70">DRAFT</span>
        </div>
      )}
      <div className="relative">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 pb-5" style={{ borderColor: brand }}>
          <div className="flex items-start gap-3">
            {p.employer?.logo && (
              // eslint-disable-next-line @next/next/no-img-element -- the agency's logo, a small data URL
              <img src={p.employer.logo} alt="" className="size-14 rounded object-contain" />
            )}
            <div>
              <div className="text-[17px] font-bold">{p.employer?.name}</div>
              {p.employer?.address && <div className="whitespace-pre-line text-neutral-600">{p.employer.address}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[20px] font-bold uppercase tracking-wide" style={{ color: brand }}>
              Payslip
            </div>
            <div className="text-neutral-700">{monthLabel(p.month)}</div>
          </div>
        </header>
        <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-[auto_1fr_auto_1fr]">
          {[
            ["Name", p.user.name],
            ["Employee code", p.employeeCode ?? "—"],
            ["Designation", p.designation ?? "—"],
            ["Department", p.department ?? "—"],
            ["PAN", p.panHint ?? "—"],
            ["UAN", p.uan ?? "—"],
            ["Bank account", p.bankHint ?? "—"],
            ["Days paid", `${p.days.paid} of ${p.days.employed}`],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-neutral-500">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {p.days.lop > 0 && <p className="mt-2 text-neutral-600">Days without pay: {daysWhy(p)}.</p>}
        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-y border-neutral-300 text-left">
              <th className="py-1.5 pr-3 font-semibold">Earnings</th>
              <th className="py-1.5 pr-3 text-right font-semibold">A month</th>
              <th className="py-1.5 pr-6 text-right font-semibold">This month</th>
              <th className="py-1.5 pr-3 font-semibold">Deductions</th>
              <th className="py-1.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => {
              const e = p.earnings[i];
              const d = p.deductions[i];
              return (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-1.5 pr-3">{e?.name}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-neutral-500">{e && inr(e.amount)}</td>
                  <td className="py-1.5 pr-6 text-right tabular-nums">{e && inr(e.paid)}</td>
                  <td className="py-1.5 pr-3">{d?.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{d && inr(d.amount)}</td>
                </tr>
              );
            })}
            <tr className="border-y border-neutral-300 font-semibold">
              <td className="py-1.5 pr-3">Gross</td>
              <td />
              <td className="py-1.5 pr-6 text-right tabular-nums">{inr(p.gross)}</td>
              <td className="py-1.5 pr-3">Total deductions</td>
              <td className="py-1.5 text-right tabular-nums">{inr(p.totalDeductions)}</td>
            </tr>
          </tbody>
        </table>
        {p.adjustments.length > 0 && (
          <table className="mt-3 w-full border-collapse">
            <tbody>
              {p.adjustments.map((a) => (
                <tr key={a.name} className="border-b border-neutral-100">
                  <td className="py-1.5">{a.name}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {a.amount < 0 ? "−" : "+"}
                    {inr(Math.abs(a.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 rounded-lg px-4 py-3" style={{ backgroundColor: `${brand}12` }}>
          <span className="font-semibold">Net pay</span>
          <span className="text-[18px] font-bold tabular-nums">{inr(p.net)}</span>
          <span className="w-full text-neutral-600">{p.netInWords}</span>
        </div>
        {p.contributions.length > 0 && (
          <p className="mt-3 text-neutral-600">
            Paid by {p.employer?.name} on top of the salary: {p.contributions.map((c) => `${c.name} ${inr(c.amount)}`).join(" · ")}.
          </p>
        )}
        <p className="mt-6 text-[11px] text-neutral-500">Worked out from the month&rsquo;s attendance and leave. This is a computer-made payslip.</p>
      </div>
    </article>
  );
}

/** /app/payslips/[id]: one payslip, to read and print. */
export function LivePayslip({ id }: { id: string }) {
  const can = useCan();
  const slip = usePayslip(id);
  if (slip.isPending) return <SkeletonRows rows={8} />;
  if (slip.error) return <Alert tone="danger">{errorMessage(slip.error)}</Alert>;
  return (
    <>
      <div className="print:hidden">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href={can("salaries", "view") ? "/app/payroll" : "/app/payslips"}>
            <ArrowLeft />
            {can("salaries", "view") ? "Payroll" : "My payslips"}
          </Link>
        </Button>
        <PageHeader
          title={`${slip.data.user.name} · ${monthLabel(slip.data.month)}`}
          actions={
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer />
              Download PDF
            </Button>
          }
        />
        <p className="mb-3 text-body text-muted-foreground">To save it as a PDF, choose “Save as PDF” in the print window.</p>
      </div>
      <PayslipDocument p={slip.data} />
    </>
  );
}
