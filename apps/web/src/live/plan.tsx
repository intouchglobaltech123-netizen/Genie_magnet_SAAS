"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, FileText, Minus } from "lucide-react";
import { toast } from "sonner";
import {
  LIMIT_LABEL,
  type PlanCurrency,
  type PlanLimits,
  type PlanOffer,
  type PlatformInvoiceRow,
  SUBSCRIPTION_STATUS_LABEL,
  SUITES,
  type UsageNow,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, fmtDate, inr } from "@/lib/utils";
import { errorMessage } from "./api";
import { useCan, usePlan, usePlanAction } from "./queries";

const STATUS_TONE: Record<string, BadgeTone> = { trialing: "info", active: "success", past_due: "warning", expired: "danger", cancelled: "neutral" };
const GB = 1024 ** 3;
const used = (k: keyof PlanLimits, u: UsageNow) => (k === "storageGb" ? u.storageBytes / GB : u[k]);
const shown = (k: keyof PlanLimits, n: number) => (k === "storageGb" ? n.toFixed(n < 10 ? 1 : 0) : String(n));
const limitText = (l: number | null) => (l === null ? "No limit" : l.toLocaleString("en-IN"));
/** The day in India of a moment the server recorded. */
export const istDay = (at: string) => new Date(new Date(at).getTime() + 330 * 60_000).toISOString().slice(0, 10);
/** An amount in the invoice's currency. */
export const money = (n: number, currency: PlanCurrency) => (currency === "INR" ? inr(n) : `US$${n.toLocaleString("en-US")}`);

/** Settings → Plan (P6-02, P6-03): the agency's plan, what it uses, and the plans to choose from. */
export function LivePlan() {
  const q = usePlan();
  const can = useCan();
  const choose = usePlanAction();
  const [picked, setPicked] = useState<PlanCurrency | null>(null);
  if (q.isPending) return <SkeletonRows rows={6} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const { entitlements: e, usage, plans, brandName, billing, invoices } = q.data;
  const mayChoose = can("settings", "edit");
  const currency: PlanCurrency = picked ?? billing.currencies[0] ?? "INR";
  return (
    <>
      <PageHeader title="Plan" description={`Your ${brandName} plan: the suites it has, how much it allows, and the plans to choose from.`} />
      {e.readOnly && (
        <Alert tone="danger" className="mb-5">
          {e.readOnlyReason}
        </Alert>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <SectionCard title={e.plan ? e.plan.name : "Everything, no limits"}>
          {e.status ? (
            <div className="space-y-2 text-body">
              <Badge tone={STATUS_TONE[e.status] ?? "neutral"}>{SUBSCRIPTION_STATUS_LABEL[e.status]}</Badge>
              {e.status === "trialing" && e.trialEndsAt && (
                <p className="text-muted-foreground">The trial ends on {fmtDate(istDay(e.trialEndsAt), { day: "numeric", month: "long" })}.</p>
              )}
              {e.status === "active" && e.currentPeriodEnd && (
                <p className="text-muted-foreground">Paid until {fmtDate(istDay(e.currentPeriodEnd), { day: "numeric", month: "long", year: "numeric" })}.</p>
              )}
              <p className="text-muted-foreground">
                Suites:{" "}
                {e.suites.length
                  ? SUITES.filter((s) => e.suites.includes(s.key))
                      .map((s) => s.label)
                      .join(", ")
                  : "the core only"}
                .
              </p>
            </div>
          ) : (
            <p className="text-body text-muted-foreground">This agency is not on a plan: it has every suite and no limits.</p>
          )}
        </SectionCard>
        <SectionCard title="What you use">
          <div className="space-y-3">
            {(Object.keys(LIMIT_LABEL) as (keyof PlanLimits)[]).map((k) => {
              const limit = e.limits[k];
              const n = used(k, usage);
              return (
                <div key={k}>
                  <div className="flex items-center justify-between text-body">
                    <span>{LIMIT_LABEL[k]}</span>
                    <span className="tabular text-muted-foreground">
                      {shown(k, n)} {limit === null ? "· no limit" : `of ${limit.toLocaleString("en-IN")}`}
                    </span>
                  </div>
                  {limit !== null && limit > 0 && (
                    <Progress value={Math.min(100, (n / limit) * 100)} tone={n >= limit ? "danger" : n / limit > 0.8 ? "warning" : "accent"} className="mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-subheading font-semibold">Plans</h2>
        {billing.currencies.length > 1 && (
          <Select
            className="w-60"
            aria-label="Pay in"
            value={currency}
            onValueChange={(v) => setPicked(v as PlanCurrency)}
            options={[
              { value: "INR", label: "Pay in rupees (India, with GST)" },
              { value: "USD", label: "Pay in US dollars (abroad)" },
            ]}
          />
        )}
      </div>
      {billing.provider === "outbox" && (
        <Alert tone="info" className="mb-4">
          Payments are pretend on this server: choosing a plan starts it at once and issues an invoice, but nothing is charged.
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <PlanCard
            key={p.key}
            p={p}
            currency={currency}
            current={e.plan?.key === p.key && e.status !== "expired" && e.status !== "cancelled"}
            disabled={!mayChoose || choose.isPending || !billing.currencies.includes(currency)}
            onChoose={() =>
              choose.mutate(
                { plan: p.key, currency },
                {
                  // With real payments the plan starts once it is paid on the provider's page.
                  onSuccess: (r) => (r.payUrl ? window.location.assign(r.payUrl) : toast.success(`${p.name} started`)),
                  onError: (err) => toast.error(errorMessage(err)),
                },
              )
            }
          />
        ))}
      </div>
      {!mayChoose && <p className="mt-3 text-body text-muted-foreground">Someone who may change the agency&apos;s settings chooses the plan.</p>}
      <p className="mt-3 text-body text-muted-foreground">
        Prices are a month{currency === "INR" ? ", before GST" : ""}. A smaller plan hides the suites it does not have; nothing is deleted, and it all comes
        back with a larger plan.
      </p>
      <Invoices rows={invoices} />
    </>
  );
}

function Invoices({ rows }: { rows: PlatformInvoiceRow[] }) {
  if (!rows.length) return null;
  return (
    <SectionCard title="Invoices" className="mt-8" contentClassName="p-0">
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Number</TH>
            <TH>Date</TH>
            <TH>Plan</TH>
            <TH>For</TH>
            <TH numeric>Total</TH>
            <TH className="pr-5" />
          </TR>
        </THead>
        <TBody>
          {rows.map((i) => (
            <TR key={i.id}>
              <TD className="pl-5 font-mono">{i.number}</TD>
              <TD>{fmtDate(i.issuedOn, { day: "numeric", month: "short", year: "numeric" })}</TD>
              <TD>{i.plan.name}</TD>
              <TD className="text-muted-foreground">
                {fmtDate(i.periodStart)} – {fmtDate(i.periodEnd)}
              </TD>
              <TD numeric className="font-medium">
                {money(i.total, i.currency)}
              </TD>
              <TD className="pr-5">
                <Button size="xs" variant="ghost" asChild>
                  <Link href={`/app/settings/plan/invoices/${i.id}`}>
                    <FileText /> Open
                  </Link>
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </SectionCard>
  );
}

function PlanCard({
  p,
  currency,
  current,
  disabled,
  onChoose,
}: {
  p: PlanOffer;
  currency: PlanCurrency;
  current: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const price = currency === "INR" ? p.priceInr : p.priceUsd;
  return (
    <Card className={cn("flex flex-col p-4", current && "border-primary ring-1 ring-primary/40")}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-subheading font-semibold">{p.name}</div>
        {current && <Badge tone="accent">Your plan</Badge>}
      </div>
      <div className="mt-1 text-body text-muted-foreground">{p.description}</div>
      <div className="mt-3 text-heading font-semibold tabular">{price === null ? "—" : money(price, currency)}</div>
      <div className="text-body text-muted-foreground">{price === null ? "Price not set yet" : currency === "INR" ? "a month, plus GST" : "a month"}</div>
      <ul className="mt-3 space-y-1 text-body">
        {SUITES.map((s) => (
          <li key={s.key} className={cn("flex items-center gap-1.5", !p.suites.includes(s.key) && "text-muted-foreground")}>
            {p.suites.includes(s.key) ? <Check className="size-4 text-success" /> : <Minus className="size-4" />}
            {s.label}
          </li>
        ))}
      </ul>
      <ul className="mt-3 space-y-0.5 text-body text-muted-foreground">
        {(Object.keys(LIMIT_LABEL) as (keyof PlanLimits)[]).map((k) => (
          <li key={k}>
            {LIMIT_LABEL[k]}: <span className="tabular text-foreground">{limitText(p.limits[k])}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-4">
        <Button className="w-full" variant={current ? "outline" : "accent"} disabled={disabled || current || price === null} onClick={onChoose}>
          {current ? "Your plan" : `Choose ${p.name}`}
        </Button>
      </div>
    </Card>
  );
}
