"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertOctagon, BellRing, CalendarClock, CheckCircle2, Download, FileText, Hourglass, IndianRupee, PhoneCall, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/shared/stat-card";
import { TODAY, daysBetween } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { fmtDate, inr, inrCompact, pct } from "@/lib/utils";
import { InvoiceSheet, RecordPaymentDialog, useSendReminder } from "./dialogs";
import { InvoicesTable } from "./invoices-table";
import { useBilling, useInvoiceViews, type InvoiceView } from "./store";
import { AdvancesTab, AgingBar, AgingTab, CreditNotesTab } from "./tabs";

export function BillingHeaderActions() {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => toast.success("GSTR-1 export ready", { description: "Sep 2026 B2B invoices · 10 invoices · JSON for GST portal" })}
    >
      <Download /> GSTR-1 export
    </Button>
  );
}

export function BillingView() {
  const invoices = useInvoiceViews();
  const advances = useBilling((s) => s.advances);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const sheetInv = invoices.find((i) => i.id === sheetId) ?? null;
  const payInv = invoices.find((i) => i.id === payId) ?? null;

  const issued = invoices.filter((i) => i.status !== "draft");
  const invoiced = issued.reduce((s, i) => s + i.taxable, 0);
  const invoicedGross = issued.reduce((s, i) => s + i.total, 0);
  const collected = issued.reduce((s, i) => s + i.received, 0);
  const outstanding = issued.reduce((s, i) => s + i.balance, 0);
  const overdue30 = issued.filter((i) => i.daysOverdue > 30);
  const overdue30Amt = overdue30.reduce((s, i) => s + i.balance, 0);
  const last90 = issued.filter((i) => daysBetween(i.issueDate, TODAY) <= 90).reduce((s, i) => s + i.total, 0);
  const dso = Math.round((outstanding / (last90 || 1)) * 90);
  const openCount = issued.filter((i) => i.balance > 0).length;
  const unadjustedAdv = advances.reduce((s, a) => s + a.amount - a.adjustments.reduce((x, y) => x + y.amount, 0), 0);

  const openPay = (i: InvoiceView) => setPayId(i.id);

  return (
    <div className="space-y-6">
      <UrbanNestCallout invoices={invoices} onRecordPayment={openPay} onOpen={(i) => setSheetId(i.id)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Invoiced this FY" value={inrCompact(invoiced)} icon={FileText} tone="accent" hint={`${issued.length} invoices · ${inrCompact(invoicedGross)} incl. GST`} />
        <StatCard label="Collected" value={inrCompact(collected)} icon={Wallet} tone="success" hint={`${pct(collected / invoicedGross)} of billed · incl. TDS`} />
        <StatCard label="Outstanding" value={inrCompact(outstanding)} icon={Hourglass} tone="info" hint={`${openCount} open invoices`} />
        <StatCard label="Overdue > 30 days" value={inrCompact(overdue30Amt)} icon={AlertOctagon} tone="danger" hint={`${overdue30.length} invoices · ${new Set(overdue30.map((i) => i.partyKey)).size} clients`} />
        <StatCard label="DSO" value={`${dso} days`} icon={CalendarClock} tone={dso > 45 ? "warning" : "info"} hint="Target ≤ 30 days · rolling 90d" />
      </div>

      <Tabs defaultValue="invoices">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="scrollbar-thin max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="aging">Aging</TabsTrigger>
            <TabsTrigger value="advances">
              Advances {unadjustedAdv > 0 && <Badge tone="accent" className="px-1.5 py-0">{inrCompact(unadjustedAdv)}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="credit">Credit notes</TabsTrigger>
          </TabsList>
          <div className="hidden min-w-[340px] md:block">
            <AgingMini invoices={invoices} />
          </div>
        </div>
        <TabsContent value="invoices">
          <InvoicesTable invoices={invoices} onOpen={(i) => setSheetId(i.id)} onRecordPayment={openPay} />
        </TabsContent>
        <TabsContent value="aging">
          <AgingTab invoices={invoices} />
        </TabsContent>
        <TabsContent value="advances">
          <AdvancesTab />
        </TabsContent>
        <TabsContent value="credit">
          <CreditNotesTab />
        </TabsContent>
      </Tabs>

      <InvoiceSheet
        invoice={sheetInv}
        onOpenChange={(o) => !o && setSheetId(null)}
        onRecordPayment={(i) => {
          setSheetId(null);
          setPayId(i.id);
        }}
      />
      <RecordPaymentDialog invoice={payInv} open={!!payInv} onOpenChange={(o) => !o && setPayId(null)} />
    </div>
  );
}

function AgingMini({ invoices }: { invoices: InvoiceView[] }) {
  return (
    <div className="flex items-center gap-3 text-body text-muted-foreground">
      <span className="shrink-0">Aging</span>
      <div className="flex-1">
        <AgingBar invoices={invoices} barOnly />
      </div>
    </div>
  );
}

function UrbanNestCallout({
  invoices,
  onRecordPayment,
  onOpen,
}: {
  invoices: InvoiceView[];
  onRecordPayment: (i: InvoiceView) => void;
  onOpen: (i: InvoiceView) => void;
}) {
  const inv = invoices.find((i) => i.number === "GM/26-27/041");
  const remind = useSendReminder();
  const log = useDemo((s) => s.log);
  if (!inv) return null;

  if (inv.balance <= 0) {
    return (
      <Card className="flex items-center gap-3 border-success/30 bg-success-soft p-5">
        <CheckCircle2 className="size-5 text-success" />
        <div className="text-body">
          <span className="font-semibold">Urban Nest Realty cleared GM/26-27/041.</span>{" "}
          <span className="text-muted-foreground">Category can be reviewed from Dangerous → Convincing at the next client review.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-danger/30">
      <div className="flex flex-col gap-4 bg-danger-soft p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-danger text-primary-foreground">
            <AlertOctagon className="size-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-subheading font-semibold">
                Urban Nest {inrCompact(inv.balance)} overdue · {inv.daysOverdue} days · {inv.reminders} reminders sent · category Dangerous
              </span>
              <Badge tone="danger" dot>
                Collection risk
              </Badge>
            </div>
            <p className="mt-1 text-body text-muted-foreground">
              <button className="cursor-pointer rounded font-mono text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => onOpen(inv)}>
                {inv.number}
              </button>{" "}
              · {inv.period} walkthroughs · due {fmtDate(inv.dueDate, { day: "numeric", month: "short" })} · last reminder{" "}
              {fmtDate(inv.lastReminder ?? TODAY)} · Sep cycle work continuing ({inr(40_000)}/mo arrears). Owner: Ashwin.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              toast.warning("Escalated to Janarthanan", { description: "Founder call with Vikram Shetty scheduled · 26 Sep, 11:00 AM" });
              log("Urban Nest overdue escalated to Janarthanan — founder call on 26 Sep", "danger");
            }}
          >
            <PhoneCall /> Escalate
          </Button>
          <Button size="sm" variant="outline" onClick={() => remind(inv)}>
            <BellRing /> Send reminder
          </Button>
          <Button size="sm" variant="danger" onClick={() => onRecordPayment(inv)}>
            <IndianRupee /> Record payment
          </Button>
        </div>
      </div>
    </Card>
  );
}
