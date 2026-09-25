"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertOctagon, Boxes, Camera, CalendarClock, CheckCircle2, Clock, MapPin, Plus, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { clientById, daysBetween, kitItems, personById, shoots, TODAY } from "@/lib/mock/core";
import type { Shoot } from "@/lib/types";
import { ClientTag, Segmented } from "../bits";
import { clientTint, fmt } from "../lib";
import { defaultKit, useProduction, useProductionHydration } from "../store";

export const shootStatusMeta: Record<Shoot["status"], { label: string; tone: BadgeTone }> = {
  planned: { label: "Planned", tone: "neutral" },
  packed: { label: "Kit packed", tone: "info" },
  "on-shoot": { label: "On shoot", tone: "info" },
  returned: { label: "Kit returned", tone: "warning" },
  closed: { label: "Closed", tone: "success" },
};

export function ShootsList() {
  useProductionHydration();
  const kit = useProduction((s) => s.kit);
  const statuses = useProduction((s) => s.shootStatus);
  const incidents = useProduction((s) => s.incidents);
  const [tab, setTab] = useState<"upcoming" | "completed">("upcoming");

  const statusOf = (s: Shoot) => statuses[s.id] ?? s.status;
  const upcoming = shoots.filter((s) => s.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date));
  const completed = shoots.filter((s) => s.date < TODAY).sort((a, b) => b.date.localeCompare(a.date));
  const list = tab === "upcoming" ? upcoming : completed;
  const kitOut = shoots.filter((s) => ["packed", "on-shoot", "returned"].includes(statusOf(s))).length;

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Camera className="size-3.5" /> Client Delivery · Module 15
          </span>
        }
        title="Shoots & Kit"
        description="Digital shoot sheets with the dual / single cam equipment checklist — packed, shot, received, signed."
        actions={
          <Button variant="accent" onClick={() => toast.success("Shoot draft created", { description: "BPA-B05 · BrightPath campus, Salem — pick a date to confirm." })}>
            <Plus /> Schedule shoot
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Shoots in September" value={shoots.filter((s) => s.date.startsWith("2026-09")).length} icon={Camera} tone="accent" hint="9 batches" />
        <StatCard label="Upcoming" value={upcoming.length} icon={CalendarClock} tone="info" hint={upcoming[0] ? `next: ${fmt(upcoming[0].date)}` : undefined} />
        <StatCard label="Kits out of studio" value={kitOut} icon={Boxes} tone="warning" hint="not yet closed" />
        <StatCard label="Open kit incidents" value={incidents.length} icon={AlertOctagon} tone={incidents.length ? "danger" : "success"} hint={incidents.length ? "missing on return" : "all items accounted"} />
      </div>

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={(["upcoming", "completed"] as const).map((t) => ({
          value: t,
          label: (
            <span className="capitalize">
              {t} <span className="ml-1 tabular text-muted-foreground">{t === "upcoming" ? upcoming.length : completed.length}</span>
            </span>
          ),
        }))}
      />

      {!list.length && (
        <EmptyState
          icon={Camera}
          title={tab === "upcoming" ? "No upcoming shoots" : "No completed shoots yet"}
          description={tab === "upcoming" ? "Schedule a shoot to generate its shoot sheet and kit checklist." : "Shoots move here once their date has passed."}
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {list.map((s) => {
          const k = kit[s.id] ?? defaultKit(s);
          const total = kitItems[s.kit].length;
          const packed = Object.values(k).filter((t) => t.packed).length;
          const received = Object.values(k).filter((t) => t.received).length;
          const st = statusOf(s);
          const inDays = daysBetween(TODAY, s.date);
          return (
            <Link key={s.id} href={`/shoots/${s.id}`} className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
              <Card className="group h-full p-5 transition-colors hover:border-primary/40">
                <div className="flex items-start gap-4">
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-xl py-2" style={clientTint(s.clientId, 12)}>
                    <span className="text-body font-semibold uppercase">{fmt(s.date, "MMM")}</span>
                    <span className="text-heading font-semibold leading-none tabular">{fmt(s.date, "d")}</span>
                    <span className="mt-0.5 text-body opacity-80">{fmt(s.date, "EEE")}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ClientTag clientId={s.clientId} />
                      <span className="font-mono text-body text-muted-foreground">{s.batchNo}</span>
                      <Badge tone={shootStatusMeta[st].tone} dot className="ml-auto">
                        {shootStatusMeta[st].label}
                      </Badge>
                    </div>
                    <div className="mt-1.5 truncate text-subheading font-semibold tracking-tight group-hover:text-primary">{s.projectName}</div>
                    <div className="mt-1 flex items-center gap-1 truncate text-body text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" /> {s.location}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-body [&>div]:min-w-0">
                  <div className="rounded-lg bg-surface-secondary px-2.5 py-1.5">
                    <div className="text-muted-foreground">Call time</div>
                    <div className="mt-0.5 flex items-center gap-1 font-medium">
                      <Clock className="size-3" /> {s.callTime}
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-secondary px-2.5 py-1.5">
                    <div className="text-muted-foreground">Kit</div>
                    <div className="mt-0.5 truncate font-medium">{s.kit === "dual" ? "Dual cam" : "Single cam"}</div>
                  </div>
                  <div className="rounded-lg bg-surface-secondary px-2.5 py-1.5">
                    <div className="text-muted-foreground">Videos</div>
                    <div className="mt-0.5 flex items-center gap-1 font-medium">
                      <VideoIcon className="size-3" /> {s.videoIds.length}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-body text-muted-foreground">
                    <span>{st === "planned" || st === "packed" ? `Packed ${packed}/${total}` : `Returned ${received}/${total}`}</span>
                    {tab === "upcoming" && <span>{inDays === 0 ? "Today" : `in ${inDays} days`}</span>}
                    {tab === "completed" && received === total && (
                      <span className="inline-flex items-center gap-1 text-success">
                        <CheckCircle2 className="size-3" /> All items back
                      </span>
                    )}
                  </div>
                  <Progress
                    value={((st === "planned" || st === "packed" ? packed : received) / total) * 100}
                    tone={st === "returned" && received < total ? "warning" : st === "closed" ? "success" : "accent"}
                  />
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-body text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-2 truncate">
                    <AvatarStack names={[personById(s.cameraId).name, personById(s.directorId).name]} size="xs" />
                    {personById(s.cameraId).name.split(" ")[0]} · {personById(s.directorId).name.split(" ")[0]}
                  </span>
                  <span className="shrink-0">{clientById(s.clientId).city}</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
