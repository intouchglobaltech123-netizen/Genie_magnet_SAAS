"use client";

import * as React from "react";
import { AlertTriangle, BadgeIndianRupee, Building2, Calculator, Check, Eye, EyeOff, FileText, Lock, MinusCircle, Send, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { useDemo } from "@/lib/store";
import { cn, inr, inrCompact } from "@/lib/utils";
import { PAY_PERIOD, RUN_STEPS, STATUTORY, payrollRows, payrollTotals, type PayrollRow } from "./data";
import { PayslipDialog } from "./payslip-dialog";

const STEP_ICONS = [Lock, Calculator, ShieldCheck, Send];

function stamp() {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function PayrollView() {
  const [done, setDone] = React.useState(0); // number of completed steps
  const [stamps, setStamps] = React.useState<string[]>([]);
  const [blur, setBlur] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [slip, setSlip] = React.useState<PayrollRow | null>(null);

  const released = done >= 4;
  const calculated = done >= 2;

  function complete(i: number) {
    setDone(i + 1);
    setStamps((s) => {
      const n = [...s];
      n[i] = `${RUN_STEPS[i]!.who} · 25 Sep, ${stamp()}`;
      return n;
    });
    const log = useDemo.getState().log;
    if (i === 0) {
      toast.success("Payroll inputs locked", { description: "Attendance, leave & LOP for Sep 2026 are now frozen." });
      log("Harini locked Sep 2026 payroll inputs (attendance & LOP)");
    } else if (i === 1) {
      toast.success("Payroll calculated", { description: `10 employees · Net payout ${inr(payrollTotals.net)}` });
      log(`Sep 2026 payroll calculated — net ${inr(payrollTotals.net)}`);
    } else if (i === 2) {
      toast.success("Approved by Janarthanan", { description: "Payroll is ready to release." });
      log("Janarthanan approved Sep 2026 payroll", "success");
    } else {
      toast.success("Payslips released", { description: "10 payslips emailed and published to the employee portal." });
      log("Sep 2026 payslips released to 10 employees", "success");
    }
  }

  const m = (v: number, className?: string) => (
    <span className={cn("tabular", blur && "blur-[5px] select-none", className)}>{inr(v)}</span>
  );
  const dash = <span className="text-muted-foreground/60">—</span>;

  return (
    <div className="space-y-6">
      <PageHeader
        depth="preview"
        eyebrow={
          <Badge tone="danger">
            <Lock /> Sensitive · salary data
          </Badge>
        }
        title="Payroll"
        description={`${PAY_PERIOD.label} run · ${PAY_PERIOD.days} days · 10 employees. LOP is pulled directly from the attendance register.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setBlur((b) => !b)}>
              {blur ? <EyeOff /> : <Eye />}
              {blur ? "Show salaries" : "Blur salaries"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast("Bank transfer file prepared (demo)", { description: "KVB bulk-upload format · 10 beneficiaries" })}
              disabled={!released}
            >
              <FileText /> Bank advice
            </Button>
          </>
        }
      />

      {/* Run stepper */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-subheading font-semibold tracking-tight">Payroll run · {PAY_PERIOD.short}</div>
            <div className="text-body text-muted-foreground">
              {released ? "Run complete. Payslips are visible to employees." : `Step ${done + 1} of 4 — ${RUN_STEPS[done]!.label}`}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {done < 2 && (
              <Button variant="accent" size="sm" onClick={() => complete(done)}>
                {done === 0 ? <Lock /> : <Calculator />}
                {RUN_STEPS[done]!.action}
              </Button>
            )}
            {done === 2 && (
              <Button variant="accent" size="sm" onClick={() => setConfirmOpen(true)}>
                <ShieldCheck /> Approve payroll
              </Button>
            )}
            <Button variant={done === 3 ? "success" : "outline"} size="sm" disabled={done !== 3} onClick={() => complete(3)}>
              <Send /> {released ? "Payslips released" : "Release payslips"}
            </Button>
          </div>
        </div>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {RUN_STEPS.map((s, i) => {
            const Icon = STEP_ICONS[i]!;
            const state = i < done ? "done" : i === done ? "current" : "todo";
            return (
              <li
                key={s.key}
                className={cn(
                  "relative flex items-start gap-3 rounded-xl border p-3 transition-colors",
                  state === "done" && "border-success/30 bg-success-soft/60",
                  state === "current" && "border-primary/40 bg-primary-soft/60",
                  state === "todo" && "border-border",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-full",
                    state === "done" && "bg-success text-white",
                    state === "current" && "bg-primary text-primary-foreground",
                    state === "todo" && "bg-muted text-muted-foreground",
                  )}
                >
                  {state === "done" ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <div className="min-w-0">
                  <div className="text-body font-medium">{s.label}</div>
                  <div className="truncate text-body text-muted-foreground">{stamps[i] ?? s.detail}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total gross" value={blur ? "₹ ••••••" : inrCompact(payrollTotals.gross)} icon={Wallet} hint="Before LOP & statutory" />
        <StatCard label="Total net payout" value={blur ? "₹ ••••••" : inrCompact(payrollTotals.net)} icon={BadgeIndianRupee} tone="success" hint={`Pay date 30 Sep`} />
        <StatCard
          label="LOP deduction"
          value={blur ? "₹ ••••" : inr(payrollTotals.lop)}
          icon={MinusCircle}
          tone="warning"
          hint={`${payrollTotals.lopDays} LOP days · ${payrollRows.filter((r) => r.lopDays > 0).length} people`}
        />
        <StatCard label="Employer cost" value={blur ? "₹ ••••••" : inrCompact(payrollTotals.employerCost)} icon={Building2} tone="gold" hint="CTC incl. employer PF" />
      </div>

      <Card>
        <CardHeader className="flex-wrap">
          <div>
            <CardTitle>Salary register · {PAY_PERIOD.short}</CardTitle>
            <CardDescription>
              Split: Basic 50% · HRA 20% · Special allowance (remainder after employer PF). LOP = gross ÷ 30 × LOP days.
            </CardDescription>
          </div>
          <Tooltip
            content={`Placeholders until confirmed with the auditor: PF 12% of basic capped at ₹${STATUTORY.pfCap.toLocaleString("en-IN")}; ESI 0.75% only if gross ≤ ₹21,000; TN professional tax ~₹208/month (half-yearly); TDS = new-regime slab estimate.`}
          >
            <span>
              <Badge tone="warning" className="cursor-help">
                <AlertTriangle /> Statutory config to confirm
              </Badge>
            </span>
          </Tooltip>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Employee</TH>
              <TH className="text-right">Monthly CTC</TH>
              <TH className="text-right">Gross</TH>
              <TH className="text-right">LOP days</TH>
              <TH className="text-right">LOP ded.</TH>
              <TH className="text-right">
                <StatHead label="PF" />
              </TH>
              <TH className="text-right">
                <StatHead label="ESI" />
              </TH>
              <TH className="text-right">
                <StatHead label="PT" />
              </TH>
              <TH className="text-right">
                <StatHead label="TDS" />
              </TH>
              <TH className="text-right">Net pay</TH>
              <TH className="pr-5 text-right">Payslip</TH>
            </TR>
          </THead>
          <TBody>
            {payrollRows.map((r) => (
              <TR key={r.person.id}>
                <TD className="pl-5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.person.name} size="sm" />
                    <div className="min-w-0">
                      <div className="font-medium">{r.person.name}</div>
                      <div className="text-body text-muted-foreground">
                        {r.empId} · {r.person.role}
                      </div>
                    </div>
                  </div>
                </TD>
                <TD className="text-right">{m(r.ctc)}</TD>
                <TD className="text-right">{m(r.gross)}</TD>
                <TD className="text-right tabular">
                  {r.lopDays ? (
                    <Tooltip content="From attendance register (absent = 1, half-day = 0.5)">
                      <span className="cursor-help font-medium text-warning">{r.lopDays}</span>
                    </Tooltip>
                  ) : (
                    dash
                  )}
                </TD>
                <TD className="text-right">{r.lop ? m(r.lop, "text-warning") : dash}</TD>
                <TD className="text-right">{m(r.pf)}</TD>
                <TD className="text-right">{r.esi ? m(r.esi) : <Tooltip content="Gross above ₹21,000 — not ESI-eligible"><span className="cursor-help text-muted-foreground/60">n/a</span></Tooltip>}</TD>
                <TD className="text-right">{m(r.pt)}</TD>
                <TD className="text-right">{r.tds ? m(r.tds) : <Tooltip content="Below ₹12L taxable — 87A rebate (estimate)"><span className="cursor-help text-muted-foreground/60">Nil</span></Tooltip>}</TD>
                <TD className="text-right font-semibold">{calculated ? m(r.net) : <span className="text-muted-foreground">Pending</span>}</TD>
                <TD className="pr-5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {released && (
                      <Badge tone="success" dot>
                        Released
                      </Badge>
                    )}
                    <Button variant="ghost" size="xs" onClick={() => setSlip(r)} disabled={!calculated}>
                      View payslip
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
            <TR className="bg-muted/50 font-semibold hover:bg-muted/50">
              <TD className="pl-5">Total · 10 employees</TD>
              <TD className="text-right">{m(payrollTotals.ctc)}</TD>
              <TD className="text-right">{m(payrollTotals.gross)}</TD>
              <TD className="text-right tabular">{payrollTotals.lopDays}</TD>
              <TD className="text-right">{m(payrollTotals.lop)}</TD>
              <TD className="text-right">{m(payrollTotals.pf)}</TD>
              <TD className="text-right">{m(payrollTotals.esi)}</TD>
              <TD className="text-right">{m(payrollTotals.pt)}</TD>
              <TD className="text-right">{m(payrollTotals.tds)}</TD>
              <TD className="text-right">{calculated ? m(payrollTotals.net) : "—"}</TD>
              <TD className="pr-5" />
            </TR>
          </TBody>
        </Table>
        {!calculated && (
          <div className="border-t border-border px-5 py-3 text-body text-muted-foreground">
            Net pay and payslips unlock after the run is calculated. Lock inputs first so late attendance edits can&apos;t change LOP.
          </div>
        )}
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {PAY_PERIOD.label} payroll?</DialogTitle>
            <DialogDescription>Once approved, amounts are frozen and HR can release payslips.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4 text-body">
              <Summary label="Employees" value="10" />
              <Summary label="Total gross" value={inr(payrollTotals.gross)} />
              <Summary label="LOP deductions" value={inr(payrollTotals.lop)} />
              <Summary label="Net payout" value={inr(payrollTotals.net)} strong />
            </div>
            <div className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2 text-body text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              PF, ESI, PT and TDS are placeholder rules — statutory configuration still to be confirmed.
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => {
                setConfirmOpen(false);
                complete(2);
              }}
            >
              <ShieldCheck /> Approve as Janarthanan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PayslipDialog row={slip} released={released} blurred={blur} onOpenChange={(o) => !o && setSlip(null)} />
    </div>
  );
}

function StatHead({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <AlertTriangle className="size-3 text-warning" />
    </span>
  );
}

function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-body text-muted-foreground">{label}</div>
      <div className={cn("tabular", strong ? "text-subheading font-semibold" : "font-medium")}>{value}</div>
    </div>
  );
}
