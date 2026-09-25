"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, Camera, Check, CheckCircle2, Cloud, ExternalLink, FileText, HardDrive, Link2, MapPin, Quote, Server, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import type { Video } from "@/lib/types";
import { cn, hoursLabel, inr } from "@/lib/utils";
import { briefFor, costBreakdown, fmt, shiftIso, shootOf } from "../lib";
import { useProduction } from "../store";

// ─────────────────────────── Brief & script ───────────────────────────

export function BriefTab({ v }: { v: Video }) {
  const b = briefFor(v);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-body font-semibold uppercase tracking-wider text-muted-foreground">
              <Quote className="size-3.5" /> Hook · first 3 seconds
            </div>
            <p className="mt-2 text-heading font-semibold leading-snug tracking-tight">{b.hook}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Script</CardTitle>
              <CardDescription>Approved by {b.approvedBy} · Tamil VO with English captions</CardDescription>
            </div>
            <Badge tone="success" dot>
              Script approved
            </Badge>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-0 border-l border-border pl-5">
              {b.script.map((s) => (
                <li key={s.t} className="relative pb-4 last:pb-0">
                  <span className="absolute -left-[25px] top-1 size-2 rounded-full bg-primary ring-4 ring-card" />
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-body text-muted-foreground">{s.t}</span>
                    <span className="text-body font-medium">{s.line}</span>
                  </div>
                  <div className="mt-0.5 pl-[52px] text-body text-muted-foreground">
                    <Camera className="mr-1 inline size-3 -translate-y-px" />
                    {s.shot}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Brief</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-body">
            {[
              ["Objective", b.objective],
              ["Audience", b.audience],
              ["Tone", b.tone],
              ["Call to action", b.cta],
              ["Deliverable", `${v.format} · ${v.aspect} · ${v.platform.join(", ")}`],
            ].map(([k, val]) => (
              <div key={k}>
                <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">{k}</div>
                <div className="mt-0.5 leading-relaxed">{val}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>References</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {b.references.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => toast(`Opening ${r.label}`, { description: `${r.kind} link (demo)` })}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-left text-body transition hover:bg-muted"
              >
                <FileText className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{r.label}</span>
                <Badge tone="outline">{r.kind}</Badge>
                <ExternalLink className="size-3.5 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────── Shoot & footage ───────────────────────────

export function ShootTab({ v }: { v: Video }) {
  const updateVideo = useDemo((s) => s.updateVideo);
  const log = useDemo((s) => s.log);
  const backup = useProduction((s) => s.backups[v.id]);
  const setBackup = useProduction((s) => s.setBackup);
  const shoot = shootOf(v);

  if (!shoot) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-muted">
            <Camera className="size-5 text-muted-foreground" />
          </div>
          <div className="font-semibold">Not assigned to a shoot yet</div>
          <p className="max-w-sm text-body text-muted-foreground">Once the script is approved, add this video to a shoot batch so it gets a clip range and VP tracking.</p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/shoots">
              <Camera /> Open shoot schedule
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const verified = backup ?? (v.videoProtection ? { by: "Naveen Raj", at: `${shiftIso(shoot.date, 0)}T18:40:00` } : undefined);
  const steps = [
    { icon: HardDrive, label: "Cards offloaded to edit SSD", detail: "2 × 128 GB · 214 clips" },
    { icon: Check, label: "Checksum verified (xxHash)", detail: "0 mismatches" },
    { icon: Server, label: "Mirrored to NAS", detail: "Synology 16TB · /Raw/" + shoot.batchNo },
    { icon: Cloud, label: "Cold copy to Google Drive", detail: "Kept 90 days after publish" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{shoot.projectName}</CardTitle>
            <CardDescription>
              Batch {shoot.batchNo} · {shoot.kit === "dual" ? "Dual" : "Single"} cam
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/shoots/${shoot.id}`}>
              Shoot sheet <ArrowUpRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-body">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">Shooting date</div>
              <div className="mt-0.5">{fmt(shoot.date, "EEE, d MMM yyyy")} · {shoot.callTime}</div>
            </div>
            <div>
              <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">Location</div>
              <div className="mt-0.5 flex items-start gap-1">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                {shoot.location}
              </div>
            </div>
            <div>
              <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">Camera man</div>
              <div className="mt-0.5">{personById(shoot.cameraId).name}</div>
            </div>
            <div>
              <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">Content director</div>
              <div className="mt-0.5">{personById(shoot.directorId).name}</div>
            </div>
          </div>
          <div>
            <div className="mb-1 text-body font-medium uppercase tracking-wider text-muted-foreground">Clip numbers</div>
            <Input
              value={v.clipNo}
              onChange={(e) => updateVideo(v.id, { clipNo: e.target.value })}
              onBlur={() => toast.success("Clip range saved", { description: v.clipNo })}
              className="font-mono"
            />
          </div>
          {shoot.notes && <div className="rounded-lg bg-muted px-3 py-2 text-body text-muted-foreground">Note: {shoot.notes}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Footage backup · VP</CardTitle>
            <CardDescription>Video Protection — editing is blocked until raw footage is safe.</CardDescription>
          </div>
          {v.videoProtection ? (
            <Badge tone="success">
              <ShieldCheck /> Protected
            </Badge>
          ) : (
            <Badge tone="danger">
              <ShieldOff /> Not protected
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.label} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                  <span className={cn("inline-flex size-7 items-center justify-center rounded-md", v.videoProtection ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-medium">{s.label}</div>
                    <div className="text-body text-muted-foreground">{s.detail}</div>
                  </div>
                  {v.videoProtection && <CheckCircle2 className="size-4 text-success" />}
                </li>
              );
            })}
          </ul>
          {verified && v.videoProtection ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-body text-success">
              <ShieldCheck className="size-4" />
              Card-to-NAS copy verified by {verified.by} · {format(parseISO(verified.at), "d MMM, HH:mm")}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="rounded-lg bg-warning-soft px-3 py-2 text-body text-warning">
                Naveen Raj is on sick leave (25–26 Sep). Surya Prakash is the designated backup verifier.
              </div>
              <Button
                variant="success"
                className="w-full"
                onClick={() => {
                  const sig = { by: "Surya Prakash (cover for Naveen)", at: new Date().toISOString() };
                  setBackup(v.id, sig);
                  updateVideo(v.id, { videoProtection: true });
                  log(`${v.code} footage verified on NAS — VP ticked by Surya Prakash`, "success");
                  toast.success("Footage protected — VP ticked", { description: "Editing can now begin." });
                }}
              >
                <ShieldCheck /> Verify backup & tick VP
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────── True cost ───────────────────────────

const lineColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-info)", "var(--color-chart-5)"];

export function CostTab({ v }: { v: Video }) {
  const c = costBreakdown(v);
  const marginPct = c.revenue ? c.margin / c.revenue : 0;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>True cost breakdown</CardTitle>
            <CardDescription>Actual minutes × loaded hourly cost, plus equipment and overhead.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted">
            {c.lines.map((l, i) => (
              <div key={l.label} style={{ width: `${(l.value / c.total) * 100}%`, backgroundColor: lineColors[i] }} title={l.label} />
            ))}
          </div>
          <div className="divide-y divide-border">
            {c.lines.map((l, i) => (
              <div key={l.label} className="flex items-center gap-3 py-2.5">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: lineColors[i] }} />
                <div className="min-w-0 flex-1">
                  <div className="text-body font-medium">{l.label}</div>
                  <div className="text-body text-muted-foreground">{l.detail}</div>
                </div>
                <div className="text-body font-medium tabular">{inr(l.value)}</div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3">
              <span className="text-body font-semibold">Total cost to deliver</span>
              <span className="text-subheading font-semibold tabular tracking-tight">{inr(c.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div>
              <div className="text-body text-muted-foreground">Revenue per deliverable</div>
              <div className="text-heading font-semibold tabular tracking-tight">{inr(c.revenue)}</div>
              <div className="text-body text-muted-foreground">Monthly fee ÷ units in the package</div>
            </div>
            <div>
              <div className="text-body text-muted-foreground">Contribution margin</div>
              <div className={cn("text-heading font-semibold tabular tracking-tight", c.margin < 0 ? "text-danger" : "text-success")}>
                {inr(c.margin)} <span className="text-body">({(marginPct * 100).toFixed(0)}%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Editing: planned vs actual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Planned", v.plannedMinutes, c.editPlanned, "bg-muted-foreground/40"],
              ["Actual", v.loggedMinutes, c.editActual, v.loggedMinutes > v.plannedMinutes ? "bg-danger" : "bg-primary"],
            ].map(([label, mins, cost, cls]) => (
              <div key={label as string}>
                <div className="mb-1 flex justify-between text-body">
                  <span className="text-muted-foreground">
                    {label as string} · {hoursLabel(mins as number)}
                  </span>
                  <span className="font-medium tabular">{inr(cost as number)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", cls as string)} style={{ width: `${((mins as number) / Math.max(v.plannedMinutes, v.loggedMinutes, 1)) * 100}%` }} />
                </div>
              </div>
            ))}
            <Button variant="link" size="sm" asChild>
              <Link href="/costing">
                <Link2 /> Open True Costing
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
