"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { AlertOctagon, ArrowRight, CalendarClock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { CategoryBadge, categoryMeta } from "@/components/shared/video-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { agreements, clients, daysBetween, TODAY } from "@/lib/mock/core";
import { effortReturn, healthFactors, recoveryActions } from "@/lib/mock/crm";
import { useDemo } from "@/lib/store";
import type { CustomerCategory } from "@/lib/types";
import { cn, inr, inrCompact } from "@/lib/utils";
import { axisProps, tooltipStyle } from "@/features/overview/chart-style";
import { useCrmDemo } from "./crm-store";

const catColor: Record<CustomerCategory, string> = {
  Awesome: "var(--color-success)",
  Breadwinning: "var(--color-chart-1)",
  Convincing: "var(--color-warning)",
  Dangerous: "var(--color-danger)",
};

const catTile: Record<CustomerCategory, string> = {
  Awesome: "bg-success-soft text-success",
  Breadwinning: "bg-primary-soft text-primary",
  Convincing: "bg-warning-soft text-warning",
  Dangerous: "bg-danger-soft text-danger",
};

const factorDefs: { key: keyof (typeof healthFactors)[string]; label: string; invert?: boolean }[] = [
  { key: "billing", label: "Billing value" },
  { key: "profitability", label: "Profitability" },
  { key: "payment", label: "Payment cycle" },
  { key: "repeat", label: "Repeat business" },
  { key: "salesEffort", label: "Sales effort", invert: true },
  { key: "deliveryEffort", label: "Delivery effort", invert: true },
];

export function ClientHealth() {
  const sorted = clients.slice().sort((a, b) => a.health - b.health);
  return (
    <div>
      <PageHeader
        eyebrow="Module 23 · Agreement Review & Client Health"
        title="Client health"
        description="Every client scored on what they bring in versus what they take to serve. Reviewed at each 45-day strategic review."
        depth="preview"
      />
      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Matrix />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-1">
          {(Object.keys(categoryMeta) as CustomerCategory[]).map((cat) => {
            const list = clients.filter((c) => c.category === cat);
            return (
              <Card key={cat} className="flex items-center gap-3 p-5">
                <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-subheading font-semibold", catTile[cat])}>
                  {categoryMeta[cat].letter}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-body font-semibold">{cat}</div>
                  <div className="text-body text-muted-foreground">{categoryMeta[cat].desc}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-subheading font-semibold tabular">{list.length}</div>
                  <div className="text-body text-muted-foreground">{list.map((c) => c.code).join(" · ") || "—"}</div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sorted.map((c) => (
          <ClientCard key={c.id} clientId={c.id} />
        ))}
      </div>
    </div>
  );
}

function Matrix() {
  const data = clients.map((c) => ({ ...effortReturn(c.id), name: c.name, code: c.code, category: c.category, value: c.monthlyValue }));
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Effort vs return</CardTitle>
          <CardDescription>Bubble size = monthly value</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 0 }}>
              <ReferenceArea x1={0} x2={50} y1={50} y2={100} fill="var(--color-success)" fillOpacity={0.05} />
              <ReferenceArea x1={50} x2={100} y1={50} y2={100} fill="var(--color-chart-1)" fillOpacity={0.05} />
              <ReferenceArea x1={0} x2={50} y1={0} y2={50} fill="var(--color-warning)" fillOpacity={0.05} />
              <ReferenceArea x1={50} x2={100} y1={0} y2={50} fill="var(--color-danger)" fillOpacity={0.06} />
              <CartesianGrid stroke="var(--color-chart-grid)" />
              <ReferenceLine x={50} stroke="var(--color-border-strong)" strokeWidth={1.5} />
              <ReferenceLine y={50} stroke="var(--color-border-strong)" strokeWidth={1.5} />
              <XAxis type="number" dataKey="effort" domain={[0, 100]} {...axisProps} label={{ value: "Effort to serve →", position: "insideBottom", offset: -12, fill: "var(--color-text-muted)", fontSize: 12 }} />
              <YAxis type="number" dataKey="return" domain={[0, 100]} {...axisProps} width={40} label={{ value: "Return →", angle: -90, position: "insideLeft", offset: 14, fill: "var(--color-text-muted)", fontSize: 12 }} />
              <ZAxis type="number" dataKey="value" range={[260, 900]} />
              <Tooltip
                {...tooltipStyle}
                cursor={{ strokeDasharray: "3 3", stroke: "var(--color-border)" }}
                content={({ payload }) => {
                  const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
                  if (!p) return null;
                  return (
                    <div style={tooltipStyle.contentStyle}>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-muted-foreground">
                        {p.category} · effort {p.effort} · return {p.return} · {inrCompact(p.value)}/mo
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={data}
                shape={(props: unknown) => {
                  const { cx, cy, size, payload } = props as { cx: number; cy: number; size: number; payload: (typeof data)[number] };
                  const r = Math.sqrt(size / Math.PI);
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={r} fill={catColor[payload.category]} fillOpacity={0.22} stroke={catColor[payload.category]} strokeWidth={1.5} />
                      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-text-primary)">
                        {payload.code}
                      </text>
                    </g>
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <QuadLabel className="left-12 top-2" letter="A" text="Awesome" color={catColor.Awesome} />
          <QuadLabel className="right-5 top-2" letter="B" text="Breadwinning" color={catColor.Breadwinning} />
          <QuadLabel className="bottom-9 left-12" letter="C" text="Convincing" color={catColor.Convincing} />
          <QuadLabel className="bottom-9 right-5" letter="D" text="Dangerous" color={catColor.Dangerous} />
        </div>
      </CardContent>
    </Card>
  );
}

function QuadLabel({ className, letter, text, color }: { className: string; letter: string; text: string; color: string }) {
  return (
    <span className={cn("pointer-events-none absolute rounded-md bg-card/80 px-1.5 text-body font-semibold", className)} style={{ color }} title={text}>
      {letter}
      <span className="hidden sm:inline"> · {text}</span>
    </span>
  );
}

function ClientCard({ clientId }: { clientId: string }) {
  const c = clients.find((x) => x.id === clientId)!;
  const a = agreements.find((x) => x.clientId === c.id)!;
  const f = healthFactors[c.id]!;
  const renewIn = daysBetween(TODAY, a.endDate);
  const actions = recoveryActions[c.id];
  const danger = c.category === "Dangerous";
  const tone = c.health >= 80 ? "var(--color-success)" : c.health >= 60 ? "var(--color-warning)" : "var(--color-danger)";
  return (
    <Card className={cn(danger && "border-danger/40")}>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative size-14 shrink-0">
            <svg viewBox="0 0 36 36" className="size-14 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-muted)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke={tone} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(c.health / 100) * 97.4} 97.4`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-subheading font-semibold tabular">{c.health}</span>
          </div>
          <div className="min-w-0">
            <CardTitle>{c.name}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <CategoryBadge category={c.category} />
              <span className="text-body text-muted-foreground">
                {c.industry} · {c.city}
              </span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="xs" asChild>
          <Link href={`/agreements?client=${c.id}`}>
            Agreement <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-body text-muted-foreground">{categoryMeta[c.category].desc}</p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {factorDefs.map((fd) => {
            const raw = f[fd.key];
            const good = fd.invert ? 100 - raw : raw;
            return (
              <div key={fd.key}>
                <div className="mb-1 flex justify-between text-body">
                  <span className="text-muted-foreground">{fd.label}</span>
                  <span className="font-medium tabular">{fd.invert ? (raw >= 70 ? "High" : raw >= 40 ? "Medium" : "Low") : raw}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", good >= 70 ? "bg-success" : good >= 45 ? "bg-warning" : "bg-danger")}
                    style={{ width: `${raw}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-body">
          <div>
            <div className="text-muted-foreground">Monthly value</div>
            <div className="mt-0.5 text-body font-semibold tabular">{inr(c.monthlyValue)}</div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Wallet className="size-3 shrink-0" /> Outstanding
            </div>
            <div className={cn("mt-0.5 text-body font-semibold tabular", c.outstanding >= 90000 ? "text-danger" : c.outstanding ? "text-warning" : "text-success")}>
              {c.outstanding ? inr(c.outstanding) : "Nil"}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <CalendarClock className="size-3 shrink-0" /> Renewal
            </div>
            <div className={cn("mt-0.5 text-body font-semibold", renewIn <= 45 && "text-warning")}>
              {format(parseISO(a.endDate), "d MMM yy")} <span className="text-body font-normal text-muted-foreground">({renewIn}d)</span>
            </div>
          </div>
        </div>
        {actions && <RecoveryPlan clientId={c.id} name={c.name} actions={actions} danger={danger} />}
      </CardContent>
    </Card>
  );
}

function RecoveryPlan({ clientId, name, actions, danger }: { clientId: string; name: string; actions: string[]; danger: boolean }) {
  const { resolved, resolve } = useCrmDemo();
  const log = useDemo((s) => s.log);
  return (
    <div className={cn("mt-4 rounded-xl border p-3.5", danger ? "border-danger/30 bg-danger-soft/50" : "border-warning/30 bg-warning-soft/50")}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3">
        <div className="flex items-center gap-1.5 text-body font-semibold">
          <AlertOctagon className={cn("size-4", danger ? "text-danger" : "text-warning")} /> {danger ? "Recovery plan" : "Improvement actions"}
        </div>
        <span className="text-body text-muted-foreground tabular">
          {actions.filter((_, i) => resolved.includes(`${clientId}-rec-${i}`)).length}/{actions.length} done
        </span>
      </div>
      <ul className="space-y-2">
        {actions.map((t, i) => {
          const key = `${clientId}-rec-${i}`;
          const done = resolved.includes(key);
          return (
            <li key={key} className="flex items-start gap-2.5">
              <Checkbox
                checked={done}
                disabled={done}
                onCheckedChange={() => {
                  resolve(key);
                  log(`${name} recovery: ${t}`, "accent");
                  toast.success("Action logged", { description: t });
                }}
                className="mt-0.5"
              />
              <span className={cn("text-body", done && "text-muted-foreground line-through")}>{t}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
