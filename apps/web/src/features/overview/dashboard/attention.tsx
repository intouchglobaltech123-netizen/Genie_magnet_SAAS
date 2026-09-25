"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, CheckCircle2, CircleDollarSign, Clock, PackageX, Percent, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { clientById, daysBetween, isOverdue, TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { cn, inr } from "@/lib/utils";
import { useCrmDemo } from "@/features/crm/crm-store";

interface Item {
  key: string;
  icon: typeof Clock;
  tone: "danger" | "warning" | "info" | "accent";
  title: React.ReactNode;
  detail: React.ReactNode;
  actions: React.ReactNode;
}

const toneCls = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  accent: "bg-primary-soft text-primary",
};

export function AttentionCard() {
  const videos = useDemo((s) => s.videos);
  const log = useDemo((s) => s.log);
  const { discounts, decideDiscount, resolved, resolve } = useCrmDemo();
  const balaji = discounts["l-09"];

  const done = (key: string, msg: string, tone: "success" | "accent" | "warning" = "success") => {
    resolve(key);
    log(msg, tone);
    toast.success(msg);
  };

  const items: Item[] = [];

  videos.filter(isOverdue).forEach((v) => {
    const c = clientById(v.clientId);
    const late = daysBetween(v.dueDate, TODAY);
    items.push({
      key: `ov-${v.id}`,
      icon: Clock,
      tone: "danger",
      title: (
        <>
          <span className="font-mono text-body text-muted-foreground">{v.code}</span> {v.title}
        </>
      ),
      detail: (
        <>
          {c.name} · <span className="text-danger">{late}d overdue</span> · {v.stage}
          {v.delayReason && <> · {v.delayReason}</>}
        </>
      ),
      actions: (
        <>
          <Button size="xs" variant="outline" asChild>
            <Link href={`/production/${v.id}`}>Open</Link>
          </Button>
          <Button size="xs" variant="ghost" onClick={() => done(`ov-${v.id}`, `Nudged ${c.contacts[0]!.name} on ${v.code}`, "accent")}>
            Nudge
          </Button>
        </>
      ),
    });
  });

  if (balaji && balaji.status === "pending") {
    items.push({
      key: "disc-l-09",
      icon: Percent,
      tone: "warning",
      title: <>Balaji Textiles asks {balaji.pct}% discount — above sales authority (10%)</>,
      detail: <>₹75,000/mo deal in Negotiation · {balaji.reason} · Net {inr(75000 * (1 - balaji.pct / 100))}/mo</>,
      actions: (
        <>
          <Button
            size="xs"
            variant="success"
            onClick={() => {
              decideDiscount("l-09", true);
              log("Janarthanan approved 12% discount for Balaji Textiles", "success");
              toast.success("Discount approved", { description: "Priya can now send proposal v3 at ₹66,000/mo" });
            }}
          >
            <Check /> Approve
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              decideDiscount("l-09", false);
              log("Janarthanan rejected 12% discount for Balaji Textiles — counter at 8%", "warning");
              toast("Discount rejected", { description: "Sales asked to counter at 8% with 3-month lock-in" });
            }}
          >
            <X /> Reject
          </Button>
        </>
      ),
    });
  }

  items.push(
    {
      key: "dangerous-urban",
      icon: CircleDollarSign,
      tone: "danger",
      title: <>Urban Nest Realty · ₹1,20,000 outstanding</>,
      detail: <>Category D · Dangerous · 3 invoices, oldest 56 days · health 38</>,
      actions: (
        <>
          <Button size="xs" variant="outline" asChild>
            <Link href="/client-health">Recovery plan</Link>
          </Button>
          <Button size="xs" variant="ghost" onClick={() => done("dangerous-urban", "Payment reminder sent to Vikram Shetty (Urban Nest)", "warning")}>
            Send reminder
          </Button>
        </>
      ),
    },
    {
      key: "leave-naveen",
      icon: UserX,
      tone: "warning",
      title: <>Naveen Raj on sick leave (25–26 Sep) — 2 tasks unassigned</>,
      detail: <>NAS backup for Kaveri batch B · LMS account setup for Nirmala onboarding</>,
      actions: (
        <Button size="xs" variant="outline" onClick={() => done("leave-naveen", "Naveen's 2 tasks reassigned to Surya Prakash")}>
          Reassign to Surya
        </Button>
      ),
    },
    {
      key: "asset-mic",
      icon: PackageX,
      tone: "info",
      title: <>Rode NTG4+ shotgun mic in maintenance</>,
      detail: <>Needed for Kaveri testimonial shoot on 27 Sep · rental ₹1,200/day from Erode Camera House</>,
      actions: (
        <Button size="xs" variant="outline" onClick={() => done("asset-mic", "Rental mic booked for 27 Sep shoot (₹1,200)")}>
          Book rental
        </Button>
      ),
    },
  );

  const visible = items.filter((i) => !resolved.includes(i.key));

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" /> Needs your attention
          </CardTitle>
          <CardDescription>Exceptions only — everything else is on track</CardDescription>
        </div>
        <Badge tone={visible.length ? "danger" : "success"}>{visible.length ? `${visible.length} open` : "All clear"}</Badge>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="divide-y divide-border">
          <AnimatePresence initial={false}>
            {visible.map((i) => (
              <motion.li
                key={i.key}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
                className="flex flex-col gap-2 overflow-hidden py-3 first:pt-0 sm:flex-row sm:items-center"
              >
                <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", toneCls[i.tone])}>
                  <i.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body font-medium">{i.title}</div>
                  <div className="line-clamp-1 text-body text-muted-foreground">{i.detail}</div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">{i.actions}</div>
              </motion.li>
            ))}
          </AnimatePresence>
          {!visible.length && (
            <li>
              <EmptyState compact icon={CheckCircle2} title="All clear" description="Nothing needs you right now. Enjoy the chai." />
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
