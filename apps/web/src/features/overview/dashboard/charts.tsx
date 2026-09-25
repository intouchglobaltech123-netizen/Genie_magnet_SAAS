"use client";

import Link from "next/link";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryBadge, stageTone } from "@/components/shared/video-bits";
import { clients } from "@/lib/mock/core";
import { revenueTrend } from "@/lib/mock/crm";
import { useDemo } from "@/lib/store";
import { VIDEO_STAGES, type CustomerCategory } from "@/lib/types";
import { cn, inr, inrCompact } from "@/lib/utils";
import { axisProps, tooltipStyle } from "@/features/overview/chart-style";

export function RevenueTrendCard() {
  const totalCollected = revenueTrend.reduce((s, r) => s + r.collected, 0);
  const totalContracted = revenueTrend.reduce((s, r) => s + r.contracted, 0);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Revenue trend</CardTitle>
          <CardDescription>Contracted vs collected · Apr – Sep 2026</CardDescription>
        </div>
        <div className="flex gap-5 text-right">
          <div>
            <div className="text-body text-muted-foreground">Contracted (6 mo)</div>
            <div className="text-subheading font-semibold tabular">{inrCompact(totalContracted)}</div>
          </div>
          <div>
            <div className="text-body text-muted-foreground">Collected (6 mo)</div>
            <div className="text-subheading font-semibold tabular">{inrCompact(totalCollected)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex gap-4 text-body text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-1" />Contracted</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-2" />Collected</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="gContracted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gCollected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v: number) => inrCompact(v)} width={56} />
              <Tooltip {...tooltipStyle} cursor={{ stroke: "var(--color-border)" }} formatter={(v) => inr(Number(v))} />
              <Area type="monotone" dataKey="contracted" name="Contracted" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#gContracted)" />
              <Area type="monotone" dataKey="collected" name="Collected" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#gCollected)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

const stageBar: Record<string, string> = {
  neutral: "bg-chart-5",
  outline: "bg-chart-5",
  info: "bg-info",
  accent: "bg-primary",
  gold: "bg-accent",
  warning: "bg-warning",
  danger: "bg-danger",
  success: "bg-success",
};

export function PipelineByStageCard() {
  const videos = useDemo((s) => s.videos);
  const counts = VIDEO_STAGES.map((stage) => ({ stage, count: videos.filter((v) => v.stage === stage).length }));
  const max = Math.max(...counts.map((c) => c.count), 1);
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Delivery pipeline</CardTitle>
          <CardDescription>{videos.length} videos in the September cycle</CardDescription>
        </div>
        <Button variant="ghost" size="xs" asChild>
          <Link href="/production">
            Board <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {counts.map(({ stage, count }) => (
          <Link key={stage} href="/production" className="group grid grid-cols-[112px_1fr_24px] items-center gap-3 text-body">
            <span className="truncate text-muted-foreground group-hover:text-foreground">{stage}</span>
            <div className="h-5 rounded-md bg-muted/60">
              <div
                className={cn("h-full rounded-md transition-all duration-500", stageBar[stageTone[stage]])}
                style={{ width: `${count ? Math.max(6, (count / max) * 100) : 0}%`, opacity: count ? 0.85 : 0 }}
              />
            </div>
            <span className="text-right font-semibold tabular">{count}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

const catColor: Record<CustomerCategory, string> = {
  Awesome: "var(--color-success)",
  Breadwinning: "var(--color-chart-1)",
  Convincing: "var(--color-warning)",
  Dangerous: "var(--color-danger)",
};

export function PortfolioCard() {
  const cats: CustomerCategory[] = ["Awesome", "Breadwinning", "Convincing", "Dangerous"];
  const data = cats.map((c) => ({ name: c, value: clients.filter((x) => x.category === c).reduce((s, x) => s + x.monthlyValue, 0) }));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Client portfolio</CardTitle>
          <CardDescription>Monthly value by category · with health</CardDescription>
        </div>
        <Button variant="ghost" size="xs" asChild>
          <Link href="/client-health">
            Health <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-5">
          <div className="relative size-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={42} outerRadius={60} paddingAngle={3} stroke="none">
                  {data.map((d) => (
                    <Cell key={d.name} fill={catColor[d.name as CustomerCategory]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v) => inr(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-subheading font-semibold tabular">{inrCompact(total)}</span>
              <span className="text-body text-muted-foreground">/ month</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            {clients
              .slice()
              .sort((a, b) => b.monthlyValue - a.monthlyValue)
              .map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: catColor[c.category] }} />
                  <span className="min-w-0 flex-1 truncate text-body font-medium">{c.name}</span>
                  <span className="w-12 text-right text-body text-muted-foreground tabular">{inrCompact(c.monthlyValue)}</span>
                  <HealthPill value={c.health} />
                </div>
              ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <CategoryBadge key={c} category={c} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function HealthPill({ value }: { value: number }) {
  const tone = value >= 80 ? "text-success bg-success-soft" : value >= 60 ? "text-warning bg-warning-soft" : "text-danger bg-danger-soft";
  return <span className={cn("inline-flex w-9 justify-center rounded-md py-0.5 text-body font-semibold tabular", tone)}>{value}</span>;
}
