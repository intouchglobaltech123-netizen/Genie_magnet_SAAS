"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import type { PlatformInvoiceRow } from "@gm/shared";
import { Button } from "@/components/ui/button";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { fmtDate } from "@/lib/utils";
import { errorMessage } from "./api";
import { istDay, money } from "./plan";
import { usePlanInvoice } from "./queries";

/** One of our invoices to the agency for its plan (P6-04), to print or save as a PDF. */
export function LivePlanInvoice({ id }: { id: string }) {
  const q = usePlanInvoice(id);
  if (q.isPending) return <SkeletonRows rows={8} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/settings/plan">
            <ArrowLeft /> Plan
          </Link>
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer /> Print or save as PDF
        </Button>
      </div>
      <PlanInvoiceDocument inv={q.data} />
    </>
  );
}

function PlanInvoiceDocument({ inv }: { inv: PlatformInvoiceRow }) {
  const gst = inv.cgst + inv.sgst + inv.igst > 0;
  const date = (d: string) => fmtDate(d, { day: "numeric", month: "short", year: "numeric" });
  return (
    <article className="mx-auto max-w-[820px] rounded-xl bg-white p-8 text-[13px] leading-relaxed text-neutral-900 shadow-card print:max-w-none print:rounded-none print:p-0 print:shadow-none sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-neutral-800 pb-5">
        <div>
          <div className="text-[17px] font-bold">{inv.seller.name}</div>
          {inv.seller.address && <div className="whitespace-pre-line text-neutral-600">{inv.seller.address}</div>}
          {inv.seller.gstin && <div className="text-neutral-600">GSTIN: {inv.seller.gstin}</div>}
          {inv.seller.state && <div className="text-neutral-600">State: {inv.seller.state}</div>}
        </div>
        <div className="text-right">
          <div className="text-[20px] font-bold uppercase tracking-wide">{gst ? "Tax invoice" : "Invoice"}</div>
          <dl className="mt-1 grid grid-cols-[auto_auto] justify-end gap-x-3 text-neutral-700">
            <dt>Number</dt>
            <dd className="font-semibold text-neutral-900">{inv.number}</dd>
            <dt>Date</dt>
            <dd>{date(inv.issuedOn)}</dd>
            <dt>Paid</dt>
            <dd>{date(istDay(inv.paidAt))}</dd>
          </dl>
        </div>
      </header>

      <section className="mt-5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Billed to</div>
        <div className="font-semibold">{inv.buyer.name}</div>
        {inv.buyer.address && <div className="whitespace-pre-line text-neutral-600">{inv.buyer.address}</div>}
        {inv.buyer.gstin && <div className="text-neutral-600">GSTIN: {inv.buyer.gstin}</div>}
        {inv.buyer.state && <div className="text-neutral-600">State: {inv.buyer.state}</div>}
      </section>

      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="border-y border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-500">
            <th className="py-2 pr-2 font-semibold">Description</th>
            {inv.sac && <th className="py-2 pr-2 font-semibold">SAC</th>}
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-neutral-200 align-top">
            <td className="py-2 pr-2">
              {inv.plan.name} plan, {date(inv.periodStart)} to {date(inv.periodEnd)}
            </td>
            {inv.sac && <td className="py-2 pr-2 font-mono text-[12px]">{inv.sac}</td>}
            <td className="py-2 text-right">{money(inv.amount, inv.currency)}</td>
          </tr>
        </tbody>
      </table>

      <section className="mt-4 flex justify-end">
        <dl className="grid min-w-[260px] grid-cols-[1fr_auto] gap-x-6 gap-y-1">
          <dt className="text-neutral-600">Taxable value</dt>
          <dd className="text-right">{money(inv.amount, inv.currency)}</dd>
          {inv.cgst > 0 && (
            <>
              <dt className="text-neutral-600">CGST @ {inv.gstRate / 2}%</dt>
              <dd className="text-right">{money(inv.cgst, inv.currency)}</dd>
              <dt className="text-neutral-600">SGST @ {inv.gstRate / 2}%</dt>
              <dd className="text-right">{money(inv.sgst, inv.currency)}</dd>
            </>
          )}
          {inv.igst > 0 && (
            <>
              <dt className="text-neutral-600">IGST @ {inv.gstRate}%</dt>
              <dd className="text-right">{money(inv.igst, inv.currency)}</dd>
            </>
          )}
          <dt className="border-t border-neutral-300 pt-1 font-semibold">Total</dt>
          <dd className="border-t border-neutral-300 pt-1 text-right font-semibold">{money(inv.total, inv.currency)}</dd>
        </dl>
      </section>
      <p className="mt-3 text-right text-neutral-600">{inv.totalInWords}</p>
      {inv.currency === "USD" && <p className="mt-4 text-neutral-600">Export of services: no GST charged.</p>}
      <p className="mt-6 text-neutral-500">Paid in full. Thank you.</p>
    </article>
  );
}
