"use client";

import { Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { CounterDef } from "./config";

export function CounterGrid({
  defs,
  values,
  locked,
  onChange,
}: {
  defs: CounterDef[];
  values: Record<string, number>;
  locked: boolean;
  onChange: (key: string, v: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
      {defs.map((d) => {
        const v = values[d.key] ?? 0;
        const step = d.step ?? 1;
        const warn = d.bad && v > 0;
        return (
          <div
            key={d.key}
            className={cn(
              "rounded-xl border border-border bg-card p-3 transition",
              warn && "border-danger/30 bg-danger-soft/50",
            )}
          >
            <div className={cn("text-body font-medium text-muted-foreground", warn && "text-danger")}>{d.label}</div>
            <div className="mt-2 flex items-center justify-between gap-1">
              <StepBtn disabled={locked || v <= 0} onClick={() => onChange(d.key, +(v - step).toFixed(1))}>
                <Minus className="size-3.5" />
              </StepBtn>
              <motion.span
                key={v}
                initial={{ y: -4, opacity: 0.4 }}
                animate={{ y: 0, opacity: 1 }}
                className={cn("text-heading font-semibold leading-none tracking-tight tabular", warn && "text-danger")}
              >
                {v}
                {d.unit && <span className="ml-0.5 text-body font-medium text-muted-foreground">{d.unit}</span>}
              </motion.span>
              <StepBtn disabled={locked} onClick={() => onChange(d.key, +(v + step).toFixed(1))}>
                <Plus className="size-3.5" />
              </StepBtn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-primary/40 hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
