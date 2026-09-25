"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "@/components/shared/video-bits";
import { clientById } from "@/lib/mock/core";
import { OVERHEAD_RATE } from "@/lib/mock/finance";
import { cn, hoursLabel, inr, inrCompact, pct } from "@/lib/utils";
import { marginTone } from "./model";
import { axisProps, tooltipStyle } from "./chart";
import { useCosting } from "./store";
import { useVideoCosts } from "./video-costs";

interface Step {
  name: string;
  base: number;
  value: number;
  fill: string;
  formula: string;
}

export function CostWaterfall() {
  const { rows } = useVideoCosts();
  const selectedId = useCosting((s) => s.selectedId);
  const select = useCosting((s) => s.select);
  const c = rows.find((r) => r.video.id === selectedId) ?? rows[0];
  if (!c) return null;
  const a = c.actual;
  const v = c.video;

  const cost = c.complete ? a.total : c.projected;
  const raw: Omit<Step, "base">[] = [
    { name: "Labour", value: a.labour, fill: "var(--color-chart-1)", formula: `${hoursLabel(a.labourLines.reduce((s, l) => s + l.minutes, 0))} across ${a.labourLines.length} people` },
    { name: "Equip.", value: a.equipment, fill: "var(--color-chart-2)", formula: a.equipmentLines.map((e) => `${e.hours.toFixed(1)}h × ₹${e.rate.toFixed(0)}`).join(" + ") || "No kit hours yet" },
    { name: "Overhead", value: a.overhead, fill: "var(--color-chart-3)", formula: `${a.labourHours.toFixed(1)} labour hrs × ₹${OVERHEAD_RATE.toFixed(0)}/hr` },
    { name: "Travel", value: a.travel, fill: "var(--color-chart-4)", formula: a.travelNote ?? "No shoot travel" },
    { name: "Rework", value: a.rework, fill: "var(--color-danger)", formula: `${a.reworkMinutes} min agency corrections × editor rate` },
  ];
  const steps: Step[] = raw.map((s, i) => ({ ...s, base: raw.slice(0, i).reduce((t, x) => t + x.value, 0) }));
  const data: Step[] = [
    ...steps,
    { name: c.complete ? "True cost" : "To date", base: 0, value: a.total, fill: "var(--color-foreground)", formula: "Sum of the five components" },
    { name: "Revenue", base: 0, value: c.revenue, fill: "var(--color-success)", formula: `₹${c.revenueInfo.fee.toLocaleString("en-IN")} ÷ ${c.revenueInfo.totalWeight} weighted units × ${c.revenueInfo.weight}` },
    c.margin >= 0
      ? { name: "Margin", base: cost, value: c.margin, fill: "color-mix(in srgb, var(--color-success) 45%, transparent)", formula: "Revenue share − true cost" }
      : { name: "Loss", base: c.revenue, value: -c.margin, fill: "color-mix(in srgb, var(--color-danger) 55%, transparent)", formula: "True cost exceeds revenue share" },
  ];

  const tone = marginTone(c.marginPct);

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader className="flex-col items-stretch gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Cost waterfall</CardTitle>
            <CardDescription className="truncate">
              {clientById(v.clientId).name} · {v.title}
            </CardDescription>
          </div>
          <Badge tone={tone} className="shrink-0 tabular">
            {pct(c.marginPct)} margin{!c.complete && " (proj.)"}
          </Badge>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <Select
            value={c.video.id}
            onValueChange={select}
            className="h-8 text-body"
            options={rows.map((r) => ({ value: r.video.id, label: `${r.video.code} · ${r.video.format}` }))}
          />
          <StageBadge stage={v.stage} />
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 18, right: 4, left: -14, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
              <XAxis dataKey="name" {...axisProps} interval={0} tick={{ ...axisProps.tick, fontSize: 11 }} />
              <YAxis {...axisProps} tickFormatter={(x: number) => inrCompact(x)} width={52} />
              <Tooltip
                cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
                content={({ active, payload }) => {
                  const p = payload?.find((x) => x.dataKey === "value")?.payload as Step | undefined;
                  if (!active || !p) return null;
                  return (
                    <div style={tooltipStyle.contentStyle}>
                      <div className="font-medium text-text-primary">
                        {p.name} · {inr(p.value)}
                      </div>
                      <div className="mt-0.5 max-w-56 text-body text-muted-foreground">{p.formula}</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="value" stackId="w" radius={[4, 4, 0, 0]} animationDuration={500}>
                {data.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  className="fill-muted-foreground"
                  style={{ fontSize: 11 }}
                  formatter={(x) => inrCompact(Number(x))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3 text-body">
          <Section title="Labour" total={a.labour} std={c.standard.labour}>
            {a.labourLines.length === 0 && <Muted>No time logged yet</Muted>}
            {a.labourLines.map((l) => (
              <Row key={l.personId + l.bucket} label={`${l.name} · ${l.bucket}`} formula={`${hoursLabel(l.minutes)} × ₹${Math.round(l.rate)}`} value={l.cost} />
            ))}
          </Section>
          <Section title="Equipment" total={a.equipment} std={c.standard.equipment}>
            {a.equipmentLines.length === 0 && <Muted>No kit or workstation hours yet</Muted>}
            {a.equipmentLines.map((e) => (
              <Row key={e.label} label={e.label} formula={`${e.hours.toFixed(1)}h × ₹${e.rate.toFixed(1)}/hr`} value={e.cost} />
            ))}
          </Section>
          <Section title="Overhead" total={a.overhead} std={c.standard.overhead}>
            <Row label="Allocated on labour hours" formula={`${a.labourHours.toFixed(1)}h × ₹${OVERHEAD_RATE.toFixed(0)}`} value={a.overhead} />
          </Section>
          <Section title="Travel & consumables" total={a.travel} std={c.standard.travel}>
            <Muted>{a.travelNote ?? "No shoot attached"}</Muted>
          </Section>
          <Section title="Rework" total={a.rework} std={0} danger={a.rework > 0}>
            <Muted>{a.reworkMinutes ? `${a.reworkMinutes} min of free agency corrections — not billable` : "No agency corrections logged"}</Muted>
          </Section>
          <div className="flex items-center justify-between gap-3 rounded-xl border-t border-border-strong bg-surface-secondary px-3 py-2">
            <span className="text-muted-foreground">
              Revenue share <span className="text-body">({c.revenueInfo.packageName})</span>
            </span>
            <span className="font-semibold tabular">{inr(c.revenue)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, total, std, danger, children }: { title: string; total: number; std: number; danger?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={cn("font-medium", danger && "text-danger")}>{title}</span>
        <span className="flex items-baseline gap-2 tabular">
          <span className="text-body text-muted-foreground">std {inr(std)}</span>
          <span className="font-semibold">{inr(total)}</span>
        </span>
      </div>
      <div className="space-y-0.5 border-l border-border pl-3">{children}</div>
    </div>
  );
}

function Row({ label, formula, value }: { label: string; formula: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-body">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="flex shrink-0 items-baseline gap-2 tabular">
        <span className="font-mono text-body text-muted-foreground/80">{formula}</span>
        <span>{inr(value)}</span>
      </span>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div className="text-body text-muted-foreground">{children}</div>;
}
