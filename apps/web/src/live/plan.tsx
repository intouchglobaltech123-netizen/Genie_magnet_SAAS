"use client";

import { Check, Minus } from "lucide-react";
import { toast } from "sonner";
import { LIMIT_LABEL, type PlanLimits, type PlanOffer, SUBSCRIPTION_STATUS_LABEL, SUITES, type UsageNow } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/progress";
import { cn, fmtDate, inr } from "@/lib/utils";
import { errorMessage } from "./api";
import { useCan, usePlan, usePlanAction } from "./queries";

const STATUS_TONE: Record<string, BadgeTone> = { trialing: "info", active: "success", past_due: "warning", expired: "danger", cancelled: "neutral" };
const GB = 1024 ** 3;
const used = (k: keyof PlanLimits, u: UsageNow) => (k === "storageGb" ? u.storageBytes / GB : u[k]);
const shown = (k: keyof PlanLimits, n: number) => (k === "storageGb" ? n.toFixed(n < 10 ? 1 : 0) : String(n));
const limitText = (l: number | null) => (l === null ? "No limit" : l.toLocaleString("en-IN"));

/** Settings → Plan (P6-02, P6-03): the agency's plan, what it uses, and the plans to choose from. */
export function LivePlan() {
  const q = usePlan();
  const can = useCan();
  const choose = usePlanAction();
  if (q.isPending) return <SkeletonRows rows={6} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const { entitlements: e, usage, plans, brandName } = q.data;
  const mayChoose = can("settings", "edit");
  return (
    <>
      <PageHeader title="Plan" description={`Your ${brandName} plan: the suites it has, how much it allows, and the plans to choose from.`} />
      {e.readOnly && <Alert tone="danger" className="mb-5">{e.readOnlyReason}</Alert>}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <SectionCard title={e.plan ? e.plan.name : "Everything, no limits"}>
          {e.status ? (
            <div className="space-y-2 text-body">
              <Badge tone={STATUS_TONE[e.status] ?? "neutral"}>{SUBSCRIPTION_STATUS_LABEL[e.status]}</Badge>
              {e.status === "trialing" && e.trialEndsAt && <p className="text-muted-foreground">The trial ends on {fmtDate(e.trialEndsAt.slice(0, 10), { day: "numeric", month: "long" })}.</p>}
              {e.status === "active" && e.currentPeriodEnd && (
                <p className="text-muted-foreground">Paid until {fmtDate(e.currentPeriodEnd.slice(0, 10), { day: "numeric", month: "long", year: "numeric" })}.</p>
              )}
              <p className="text-muted-foreground">
                Suites: {e.suites.length ? SUITES.filter((s) => e.suites.includes(s.key)).map((s) => s.label).join(", ") : "the core only"}.
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

      <h2 className="mb-3 mt-8 text-subheading font-semibold">Plans</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <PlanCard
            key={p.key}
            p={p}
            current={e.plan?.key === p.key && e.status !== "expired" && e.status !== "cancelled"}
            disabled={!mayChoose || choose.isPending}
            onChoose={() =>
              choose.mutate(p.key, {
                onSuccess: () => toast.success(`${p.name} chosen`),
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
          />
        ))}
      </div>
      {!mayChoose && <p className="mt-3 text-body text-muted-foreground">Someone who may change the agency&apos;s settings chooses the plan.</p>}
      <p className="mt-3 text-body text-muted-foreground">
        Prices are a month, before GST. A smaller plan hides the suites it does not have; nothing is deleted, and it all comes back with a larger plan.
      </p>
    </>
  );
}

function PlanCard({ p, current, disabled, onChoose }: { p: PlanOffer; current: boolean; disabled: boolean; onChoose: () => void }) {
  return (
    <Card className={cn("flex flex-col p-4", current && "border-primary ring-1 ring-primary/40")}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-subheading font-semibold">{p.name}</div>
        {current && <Badge tone="accent">Your plan</Badge>}
      </div>
      <div className="mt-1 text-body text-muted-foreground">{p.description}</div>
      <div className="mt-3 text-heading font-semibold tabular">{p.priceInr === null ? "—" : inr(p.priceInr)}</div>
      <div className="text-body text-muted-foreground">{p.priceInr === null ? "Price not set yet" : "a month"}</div>
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
        <Button className="w-full" variant={current ? "outline" : "accent"} disabled={disabled || current} onClick={onChoose}>
          {current ? "Your plan" : `Choose ${p.name}`}
        </Button>
      </div>
    </Card>
  );
}
