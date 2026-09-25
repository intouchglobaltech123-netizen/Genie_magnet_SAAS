"use client";

import { Camera, Car, Equal, Plus, RotateCcw, Users, Building2 } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { DIRECT_LABOUR_HOURS, OVERHEAD_RATE, OVERHEAD_TOTAL } from "@/lib/mock/finance";
import { inr } from "@/lib/utils";
import { cn } from "@/lib/utils";

const blocks = [
  {
    key: "labour",
    name: "Labour",
    icon: Users,
    color: "bg-chart-1",
    formula: "Minutes logged ÷ 60 × person hourly cost",
    example: "Divya 16h × ₹460 = ₹7,360",
    detail: "Split by editor, director, camera and freelancers. Hourly cost = loaded CTC ÷ productive hours (rate card v3).",
  },
  {
    key: "equipment",
    name: "Equipment",
    icon: Camera,
    color: "bg-chart-2",
    formula: "(Purchase − Residual) ÷ Life ÷ Productive hrs",
    example: "(₹2,00,000 − ₹20,000) ÷ 1 yr ÷ 1,200 hrs = ₹150/hr",
    detail: "Sony A7 IV (GM-CAM-01). Kit hours come from the shoot sheet; workstation hours from edit time.",
  },
  {
    key: "overhead",
    name: "Shared overhead",
    icon: Building2,
    color: "bg-chart-3",
    formula: "Direct labour hours × overhead rate",
    example: `${inr(OVERHEAD_TOTAL)} ÷ ${DIRECT_LABOUR_HOURS.toLocaleString("en-IN")} hrs = ${inr(OVERHEAD_RATE)}/hr`,
    detail: "Management, HR, rent, software (Adobe, Frame.io, Google Workspace), electricity, internet. Hours already charged as labour are excluded from pools — no double counting.",
  },
  {
    key: "travel",
    name: "Travel & consumables",
    icon: Car,
    color: "bg-chart-4",
    formula: "Shoot travel + consumables ÷ videos in shoot",
    example: "Kanchipuram ₹3,650 ÷ 3 videos = ₹1,217",
    detail: "Fuel, tolls, cabs, stay, crew food, gaffer tape & diffusion — from approved expense claims tagged to the shoot.",
  },
  {
    key: "rework",
    name: "Rework",
    icon: RotateCcw,
    color: "bg-danger",
    formula: "Agency-correction minutes × editor rate",
    example: "2h × ₹460 = ₹920 — never billed",
    detail: "Free corrections caused by our own mistakes (wrong logo, spelling). Measured as cost so it shows up in margin; client revisions within allowance are normal labour.",
  },
] as const;

export function ModelExplainer() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-subheading font-semibold tracking-tight">How true cost is built</h3>
          <p className="mt-0.5 text-body text-muted-foreground">
            Every figure on this page follows one formula. Hover a block to see the rule behind it.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-body font-medium text-muted-foreground">
          Revenue share − True cost = <span className="text-foreground">Margin</span>
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
        {blocks.map((b, i) => (
          <div key={b.key} className="flex flex-1 items-center gap-2 lg:min-w-0">
            <Tooltip content={b.detail}>
              <div className="group min-w-0 flex-1 cursor-help rounded-xl border border-border bg-background/60 p-3 transition hover:border-primary/40 hover:bg-primary-soft/40">
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex size-6 items-center justify-center rounded-md text-white", b.color)}>
                    <b.icon className="size-3.5" />
                  </span>
                  <span className="text-body font-semibold">{b.name}</span>
                </div>
                <div className="mt-2 text-body leading-snug text-muted-foreground">{b.formula}</div>
                <div className="mt-1.5 truncate font-mono text-body text-foreground/80">{b.example}</div>
              </div>
            </Tooltip>
            {i < blocks.length - 1 ? (
              <Plus className="hidden size-4 shrink-0 text-muted-foreground lg:block" />
            ) : (
              <Equal className="hidden size-4 shrink-0 text-muted-foreground lg:block" />
            )}
          </div>
        ))}
        <div className="flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-center text-primary-foreground lg:w-28">
          <div>
            <div className="text-body opacity-70">per video</div>
            <div className="text-body font-semibold">True cost</div>
          </div>
        </div>
      </div>
    </div>
  );
}
