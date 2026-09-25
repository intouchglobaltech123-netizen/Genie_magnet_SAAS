"use client";

import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowUpRight, CalendarCheck2, Clapperboard, IndianRupee, Percent, Target, Users, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/shared/stat-card";
import { clients, cycles, employees, isOverdue } from "@/lib/mock/core";
import { revenueTrend, stageProbability } from "@/lib/mock/crm";
import { useDemo } from "@/lib/store";
import { cn, inr, inrCompact, pct } from "@/lib/utils";

const sep = revenueTrend.at(-1)!;

export function RevenueHero() {
  const rows = [
    { label: "Contracted", value: sep.contracted, tone: "accent" as const, note: "5 active agreements" },
    { label: "Invoiced", value: sep.invoiced, tone: "info" as const, note: "2 arrears invoices pending" },
    { label: "Collected", value: sep.collected, tone: "success" as const, note: "5 days left in month" },
  ];
  return (
    <Card className="glow-accent relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={revenueTrend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Area type="monotone" dataKey="collected" stroke="var(--color-chart-1)" strokeOpacity={0.35} strokeWidth={1.5} fill="var(--color-chart-1)" fillOpacity={0.05} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-body font-medium text-muted-foreground">Revenue · September 2026</div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-heading font-semibold leading-none tracking-tight tabular">{inrCompact(sep.contracted)}</span>
              <span className="text-body text-muted-foreground">contracted / month</span>
            </div>
          </div>
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <IndianRupee className="size-4" />
          </span>
        </div>
        <div className="mt-5 space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex items-center justify-between text-body">
                <span className="font-medium">{r.label}</span>
                <span className="tabular">
                  <span className="font-semibold">{inr(r.value)}</span>
                  <span className="ml-2 text-muted-foreground">{pct(r.value / sep.contracted)}</span>
                </span>
              </div>
              <Progress value={(r.value / sep.contracted) * 100} tone={r.tone} />
              <div className="mt-1 text-body text-muted-foreground">{r.note}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function KpiGrid() {
  const videos = useDemo((s) => s.videos);
  const leads = useDemo((s) => s.leads);
  const sepCycles = cycles.filter((c) => c.label === "Sep 2026");
  const promised = sepCycles.reduce((s, c) => s + c.promised, 0);
  const deliveredLive = videos.filter((v) => v.stage === "Approved" || v.stage === "Published").length;
  const delivered = sepCycles.reduce((s, c) => s + c.delivered, 0);
  const revenue = sepCycles.reduce((s, c) => s + c.revenue, 0);
  const cost = sepCycles.reduce((s, c) => s + c.cost, 0);
  const margin = (revenue - cost) / revenue;
  const outstanding = clients.reduce((s, c) => s + c.outstanding, 0);
  const overdueClients = clients.filter((c) => c.outstanding > 0).length;
  const util = employees.reduce((s, p) => s + p.utilisation, 0) / employees.length;
  const over = employees.filter((p) => p.utilisation > 1).length;
  const overdue = videos.filter(isOverdue).length;
  const open = leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
  const weighted = open.reduce((s, l) => s + l.value * stageProbability[l.stage], 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      <StatCard label="Videos delivered · Sep" value={`${delivered}/${promised}`} icon={Clapperboard} tone="accent" hint={`${deliveredLive} approved/published in queue`}>
        <Progress className="mt-3" value={(delivered / promised) * 100} />
      </StatCard>
      <StatCard label="On-time delivery" value="86%" icon={CalendarCheck2} tone={overdue ? "warning" : "success"} delta={-0.04} deltaLabel={`${overdue} overdue now`} />
      <StatCard label="Gross margin · Sep" value={pct(margin)} icon={Percent} tone="success" delta={0.03} deltaLabel="vs Aug" />
      <StatCard label="Cash outstanding" value={inrCompact(outstanding)} icon={Wallet} tone="danger" hint={`${overdueClients} clients · ₹1.2L at Urban Nest`} />
      <StatCard label="Team utilisation" value={pct(util)} icon={Users} tone="info" hint={<span className={cn(over && "text-danger")}>{over} over 100% this week</span>} />
      <Link href="/crm" className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
        <StatCard label="Weighted pipeline" value={inrCompact(weighted)} icon={Target} tone="gold" className="h-full transition group-hover:border-primary/40">
          <div className="mt-1 flex items-center gap-1 text-body text-muted-foreground">
            {open.length} open deals <ArrowUpRight className="size-3.5 opacity-0 transition group-hover:opacity-100" />
          </div>
        </StatCard>
      </Link>
    </div>
  );
}
