"use client";

import * as React from "react";
import { ArrowRight, Calculator, Clapperboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Asset } from "@/lib/types";
import { inr } from "@/lib/utils";
import { annualDepreciation, perHourCost } from "./data";

const KIT_TAGS = ["GM-CAM-01", "GM-LEN-03", "GM-AUD-01", "GM-LGT-01", "GM-SUP-01"];

export function CostingCard({ assets }: { assets: Asset[] }) {
  const [hours, setHours] = React.useState(6);
  const cam = assets.find((a) => a.tag === "GM-CAM-01")!;
  const annual = annualDepreciation(cam);
  const hourly = perHourCost(cam) ?? 0;
  const kit = KIT_TAGS.map((t) => assets.find((a) => a.tag === t)!).filter(Boolean);
  const kitHourly = kit.reduce((s, a) => s + (perHourCost(a) ?? 0), 0);
  const h = Math.max(0, Math.min(24, hours || 0));

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr]">
        <div className="p-5">
          <div className="flex items-start gap-2">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Calculator className="size-4" />
            </span>
            <div>
              <div className="text-subheading font-semibold tracking-tight">How we cost equipment</div>
              <div className="text-body text-muted-foreground">Straight-line depreciation → cost per hour → charged to every shoot</div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-surface-secondary p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-body">
              <span className="font-medium">{cam.name}</span>
              <Badge tone="outline">{cam.tag}</Badge>
              <span className="text-muted-foreground">· useful life {cam.usefulLifeYears} year</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-body tabular">
              <Chip label="Purchase" value={inr(cam.purchaseValue)} />
              <Op>−</Op>
              <Chip label="Residual" value={inr(cam.residualValue)} />
              <Op>÷</Op>
              <Chip label="Life" value={`${cam.usefulLifeYears} yr`} />
              <Op>=</Op>
              <Chip label="Per year" value={inr(annual)} strong />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-body tabular">
              <Chip label="Per year" value={inr(annual)} />
              <Op>÷</Op>
              <Chip label="Expected use" value="1,200 hrs/yr" />
              <Op>=</Op>
              <Chip label="Per hour" value={`${inr(hourly)}/hr`} strong accent />
            </div>
          </div>
          <p className="mt-3 text-body text-muted-foreground">
            Cameras, lenses, audio, lighting & support assume 1,200 productive hrs/yr; computers 2,000 hrs/yr; storage is costed per project, not per hour.
          </p>
        </div>

        <div className="border-t border-border bg-primary-soft/40 p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-2 text-body font-medium">
            <Clapperboard className="size-4 text-primary" /> Flows into video true costing
          </div>
          <div className="mt-3 flex items-center gap-2 text-body">
            <span className="text-muted-foreground">Shoot length</span>
            <Input
              type="number"
              min={1}
              max={24}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              aria-label="Shoot length in hours"
              className="h-8 w-16 text-center tabular"
            />
            <span className="text-muted-foreground">hours</span>
          </div>
          <div className="mt-4 space-y-2 text-body">
            <Line label={`Camera body (${inr(hourly)} × ${h} h)`} value={inr(hourly * h)} strong />
            {kit.slice(1).map((a) => (
              <Line key={a.tag} label={`${a.name} (${inr(perHourCost(a) ?? 0)}/h)`} value={inr((perHourCost(a) ?? 0) * h)} />
            ))}
            <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
              <span>Kit cost for this shoot</span>
              <span className="tabular">{inr(kitHourly * h)}</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-body text-muted-foreground">
            <ArrowRight className="size-3.5" /> Added to each video&apos;s cost sheet alongside people hours & freelancer fees
          </div>
        </div>
      </div>
    </Card>
  );
}

function Chip({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <span
      className={
        accent
          ? "inline-flex flex-col rounded-lg bg-primary px-3 py-1.5 text-primary-foreground"
          : "inline-flex flex-col rounded-lg border border-border bg-card px-3 py-1.5"
      }
    >
      <span className={accent ? "text-body uppercase tracking-wider text-primary-foreground/80" : "text-body uppercase tracking-wider text-muted-foreground"}>
        {label}
      </span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </span>
  );
}

function Op({ children }: { children: React.ReactNode }) {
  return <span className="text-subheading font-medium text-muted-foreground">{children}</span>;
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "font-semibold tabular" : "tabular"}>{value}</span>
    </div>
  );
}
