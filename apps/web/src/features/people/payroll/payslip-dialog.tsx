"use client";

import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { useDemo } from "@/lib/store";
import { cn, fmtDate, inr } from "@/lib/utils";
import { PAY_PERIOD, type PayrollRow } from "./data";
import { rupeesInWords } from "./words";

export function PayslipDialog({
  row,
  released,
  blurred,
  onOpenChange,
}: {
  row: PayrollRow | null;
  released: boolean;
  blurred: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0">
        {row && <Payslip row={row} released={released} blurred={blurred} />}
      </DialogContent>
    </Dialog>
  );
}

function Payslip({ row, released, blurred }: { row: PayrollRow; released: boolean; blurred: boolean }) {
  const m = (v: number) => <span className={cn("tabular", blurred && "blur-sm select-none")}>{inr(v)}</span>;
  const earnings: [string, number][] = [
    ["Basic salary", row.basic],
    ["House rent allowance", row.hra],
    ["Special allowance", row.special],
  ];
  const deductions: [string, number][] = [
    [`Loss of pay (${row.lopDays} ${row.lopDays === 1 ? "day" : "days"})`, row.lop],
    ["Provident fund (employee)", row.pf],
    ["ESI (employee)", row.esi],
    ["Professional tax (TN)", row.pt],
    ["Income tax (TDS)", row.tds],
  ];
  const rows = Math.max(earnings.length, deductions.length);

  const details: [string, string][] = [
    ["Employee name", row.person.name],
    ["Employee ID", row.empId],
    ["Designation", row.person.role],
    ["Department", row.person.department],
    ["Date of joining", fmtDate(row.person.joinedOn, { day: "2-digit", month: "short", year: "numeric" })],
    ["PAN", row.panMasked],
    ["Bank A/C", row.bankMasked],
    ["UAN", row.uanMasked],
    ["Paid days", `${row.paidDays} / ${PAY_PERIOD.days}`],
    ["LOP days", String(row.lopDays)],
  ];

  return (
    <div>
      <div className="px-6 pt-6 pr-12">
        <DialogTitle className="text-body">Payslip preview</DialogTitle>
        <p className="text-body text-muted-foreground">
          {row.person.name} · {PAY_PERIOD.label}
          {released ? (
            <Badge tone="success" dot className="ml-2">
              Released
            </Badge>
          ) : (
            <Badge tone="warning" dot className="ml-2">
              Draft — not yet released
            </Badge>
          )}
        </p>
      </div>

      {/* The slip itself */}
      <div className="m-6 rounded-xl border border-border bg-card">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary text-body font-bold text-primary-foreground">
              GM
            </span>
            <div>
              <div className="text-subheading font-semibold tracking-tight">Genie Magnet</div>
              <div className="text-body text-muted-foreground">Appakudal, Erode District, Tamil Nadu 638315</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">Payslip for the month</div>
            <div className="text-subheading font-semibold">{PAY_PERIOD.label}</div>
            <div className="text-body text-muted-foreground">Pay date: {fmtDate(PAY_PERIOD.payDate, { day: "2-digit", month: "short", year: "numeric" })}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-2 px-6 py-4 text-body sm:grid-cols-2">
          {details.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-dashed border-border pb-1.5">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-right font-medium">{v}</span>
            </div>
          ))}
        </div>

        <div className="px-6 pb-4">
          <table className="w-full border border-border text-body">
            <thead>
              <tr className="bg-muted/60 text-body uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Earnings</th>
                <th className="border-r border-border px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-left font-medium">Deductions</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }, (_, i) => {
                const e = earnings[i];
                const d = deductions[i];
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">{e?.[0]}</td>
                    <td className="border-r border-border px-3 py-2 text-right">{e ? m(e[1]) : null}</td>
                    <td className="px-3 py-2">{d?.[0]}</td>
                    <td className="px-3 py-2 text-right">{d ? m(d[1]) : null}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-border bg-muted/40 font-semibold">
                <td className="px-3 py-2">Gross earnings</td>
                <td className="border-r border-border px-3 py-2 text-right">{m(row.gross)}</td>
                <td className="px-3 py-2">Total deductions</td>
                <td className="px-3 py-2 text-right">{m(row.deductions)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mx-6 mb-5 flex flex-col gap-1 rounded-lg bg-primary-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-body font-medium uppercase tracking-wider text-primary">Net pay</div>
            <div className={cn("text-body text-foreground", blurred && "blur-sm select-none")}>{rupeesInWords(row.net)}</div>
          </div>
          <div className={cn("text-heading font-semibold tracking-tight text-foreground tabular", blurred && "blur-sm select-none")}>
            {inr(row.net)}
          </div>
        </div>

        <div className="border-t border-border px-6 py-3 text-center text-body text-muted-foreground">
          This is a system-generated payslip and does not require a signature. · Employer PF of {inr(row.employerPf)} is part of CTC.
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => toast("Sent to printer queue (demo)")}>
          <Printer /> Print
        </Button>
        <Button
          variant="accent"
          size="sm"
          onClick={() => {
            toast.success("Payslip PDF generated (demo)", { description: `${row.empId}_${row.person.name.replace(/\s+/g, "_")}_Sep2026.pdf` });
            useDemo.getState().log(`Payslip PDF generated for ${row.person.name} (Sep 2026)`);
          }}
        >
          <Download /> Download PDF
        </Button>
      </DialogFooter>
    </div>
  );
}
