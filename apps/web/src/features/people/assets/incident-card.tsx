"use client";

import { AlertTriangle, Check, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { INCIDENT_STEPS } from "./data";

export function IncidentCard({ done, stamps, onAdvance, onOpenAsset }: { done: number; stamps: string[]; onAdvance: () => void; onOpenAsset: () => void }) {
  const closed = done >= INCIDENT_STEPS.length;
  const next = INCIDENT_STEPS[done];
  return (
    <Card className={cn("p-5", !closed && "border-warning/40")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
              closed ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
            )}
          >
            {closed ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold tracking-tight">Incident INC-0922 · Rode NTG4+ shotgun mic</span>
              <Badge tone="outline">GM-AUD-02</Badge>
              {closed ? <Badge tone="success" dot>Resolved</Badge> : <Badge tone="warning" dot>Open</Badge>}
            </div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Crackling on XLR during Nova Dental shoot · reported by Vignesh Kumar · repair est. ₹3,500
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onOpenAsset}>
            View asset
          </Button>
          {!closed && next && (
            <Button variant={done === INCIDENT_STEPS.length - 1 ? "success" : "accent"} size="sm" onClick={onAdvance}>
              {next.action}
            </Button>
          )}
        </div>
      </div>

      <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INCIDENT_STEPS.map((s, i) => {
          const state = i < done ? "done" : i === done ? "current" : "todo";
          return (
            <li key={s.label} className="relative">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    state === "done" && "bg-success text-white",
                    state === "current" && "bg-warning text-white",
                    state === "todo" && "bg-muted text-muted-foreground",
                  )}
                >
                  {state === "done" ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={cn("text-[13px] font-medium", state === "todo" && "text-muted-foreground")}>{s.label}</span>
                {i < INCIDENT_STEPS.length - 1 && <span className={cn("hidden h-px flex-1 lg:block", i < done ? "bg-success/50" : "bg-border")} />}
              </div>
              <div className="mt-1.5 pl-8 text-[12px] text-muted-foreground">
                {stamps[i] && <span className="font-medium text-foreground/80">{stamps[i]} · </span>}
                {s.detail}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
