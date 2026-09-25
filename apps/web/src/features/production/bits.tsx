"use client";

import Link from "next/link";
import { AlertTriangle, Lock, ShieldAlert } from "lucide-react";
import { clientById, isOverdue, personById } from "@/lib/mock/core";
import { EDIT_STEPS, type Video } from "@/lib/types";
import { cn } from "@/lib/utils";
import { clientDot, clientTint, fmt, type Gate } from "./lib";

export function ClientChip({ clientId, short, className }: { clientId: string; short?: boolean; className?: string }) {
  const c = clientById(clientId);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-body text-muted-foreground", className)}>
      <span className="size-2 shrink-0 rounded-full" style={clientDot(clientId)} />
      <span className="truncate">{short ? c.code : c.name}</span>
    </span>
  );
}

export function ClientTag({ clientId }: { clientId: string }) {
  const c = clientById(clientId);
  return (
    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-body font-semibold tracking-wide" style={clientTint(clientId, 14)}>
      {c.code}
    </span>
  );
}

export function EditStepsBar({ v, className }: { v: Video; className?: string }) {
  return (
    <div className={cn("flex gap-[3px]", className)}>
      {EDIT_STEPS.map((s) => (
        <span key={s} title={s} className={cn("h-1 flex-1 rounded-full", v.editSteps[s] ? "bg-primary" : "bg-muted")} />
      ))}
    </div>
  );
}

export function DueLabel({ v, className }: { v: Video; className?: string }) {
  const over = isOverdue(v);
  return (
    <span className={cn("tabular text-body", over ? "font-medium text-danger" : "text-muted-foreground", className)}>
      {over && <AlertTriangle className="mr-1 inline size-3 -translate-y-px" />}
      {fmt(v.dueDate)}
    </span>
  );
}

export function PersonLine({ id, label }: { id: string; label?: string }) {
  const p = personById(id);
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-body">
      <span className="truncate">{p.name}</span>
      {label && <span className="text-muted-foreground">· {label}</span>}
    </span>
  );
}

export function GateNotice({ gate, className }: { gate: Gate; className?: string }) {
  if (gate.ok) return null;
  const Icon = gate.kind === "qc-fail" ? ShieldAlert : Lock;
  const danger = gate.kind === "qc-fail" || gate.kind === "vp";
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border p-3.5",
        danger ? "border-danger/30 bg-danger-soft" : "border-warning/30 bg-warning-soft",
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", danger ? "text-danger" : "text-warning")} />
      <div className="min-w-0">
        <div className={cn("text-body font-semibold", danger ? "text-danger" : "text-warning")}>{gate.title}</div>
        <p className="mt-0.5 text-body text-foreground/80">{gate.reason}</p>
        {gate.missing.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {gate.missing.map((m) => (
              <span key={m} className="rounded-md border border-border bg-card px-1.5 py-0.5 text-body text-muted-foreground">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function VideoLink({ v, className }: { v: Video; className?: string }) {
  return (
    <Link href={`/production/${v.id}`} className={cn("group min-w-0", className)}>
      <div className="font-mono text-body font-medium tracking-wide text-muted-foreground">{v.code}</div>
      <div className="truncate text-body font-medium group-hover:text-primary">{v.title}</div>
    </Link>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; activeCls?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border border-border bg-muted p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2.5 text-body font-medium text-muted-foreground transition hover:text-foreground [&_svg]:size-3.5",
            value === o.value && (o.activeCls ?? "bg-card text-foreground shadow-sm"),
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
