"use client";

import { addDays, format, parseISO } from "date-fns";
import { CalendarClock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { agreementById, clients, cycles, daysBetween, TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import type { Video } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClientPlatforms, PlatformTile } from "@/features/integrations/platform-bits";
import { platformForLabel, useIntegrations } from "@/features/integrations/platforms";
import { usePublishing } from "./publish-store";

const BEST_TIME: Record<string, string> = {
  "c-kaveri": "6:30 PM",
  "c-lakshmi": "7:00 PM",
  "c-nova": "12:30 PM",
  "c-bright": "8:00 PM",
  "c-urban": "11:00 AM",
};

function Platforms({ labels, clientId }: { labels: string[]; clientId: string }) {
  const connections = useIntegrations((s) => s.connections);
  const seen = new Set<string>();
  return (
    <span className="inline-flex gap-1">
      {labels.map((l) => {
        const p = platformForLabel(l);
        if (!p || seen.has(p.id)) return null;
        seen.add(p.id);
        const ok = connections.some((c) => c.clientId === clientId && c.platform === p.id && c.status !== "error");
        return <PlatformTile key={p.id} p={p} size="sm" className={cn(!ok && "opacity-35 grayscale")} />;
      })}
    </span>
  );
}

/** Next 7 days: approved videos in their slots, plus videos still in production that are planned for those days. */
export function ScheduleView() {
  const videos = useDemo((s) => s.videos);
  const slots = usePublishing((s) => s.slots);
  const days = Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(TODAY), i), "yyyy-MM-dd"));
  const inWindow = videos.filter((v) => days.includes(v.publishDate) && v.stage !== "Published");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-success" /> Approved · will post
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-dashed border-border-strong" /> Planned · still in production
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-accent-strong" /> Genie suggests each client&apos;s best time from last month&apos;s results
        </span>
      </div>
      <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-1">
        <div className="grid min-w-[900px] grid-cols-7 gap-2">
          {days.map((d) => {
            const list = inWindow.filter((v) => v.publishDate === d);
            return (
              <div key={d} className={cn("min-h-64 rounded-2xl border p-2", d === TODAY ? "border-primary/40 bg-primary-soft/30" : "border-border-subtle bg-surface-secondary/70")}>
                <div className="px-1 pb-2">
                  <div className="text-body font-semibold">{format(parseISO(d), "EEE d")}</div>
                  <div className="text-body text-muted-foreground">{d === TODAY ? "Today" : `${list.length} post${list.length === 1 ? "" : "s"}`}</div>
                </div>
                <div className="space-y-1.5">
                  {list.map((v) => (
                    <SlotCard key={v.id} v={v} slot={slots[v.id]} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SlotCard({ v, slot }: { v: Video; slot?: string }) {
  const approved = v.stage === "Approved";
  const time = slot?.split("·")[1]?.trim() ?? BEST_TIME[v.clientId];
  return (
    <div className={cn("rounded-lg border p-2 text-body", approved ? "border-success/35 bg-card" : "border-dashed border-border-strong bg-card/60")}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-muted-foreground">{v.code}</span>
        <Platforms labels={v.platform} clientId={v.clientId} />
      </div>
      <div className="mt-0.5 line-clamp-2 font-medium">{v.title}</div>
      <div className="mt-1 flex items-center justify-between gap-1 text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3" /> {time}
        </span>
        <span className={cn(approved ? "text-success" : "")}>{approved ? "Approved" : v.stage}</span>
      </div>
    </div>
  );
}

/** Monthly quota per client: what the package promises vs what is posted and scheduled. */
export function QuotaView() {
  const videos = useDemo((s) => s.videos);
  const daysLeft = daysBetween(TODAY, "2026-09-30");
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {clients.map((c) => {
        const cycle = cycles.find((x) => x.clientId === c.id && x.label === "Sep 2026");
        if (!cycle) return null;
        const a = agreementById(cycle.agreementId);
        const scheduled = videos.filter((v) => v.cycleId === cycle.id && v.stage === "Approved").length;
        const delivered = cycle.delivered;
        const making = Math.max(0, cycle.inProgress - scheduled);
        const notStarted = Math.max(0, cycle.promised - delivered - scheduled - making);
        const behind = (cycle.promised - delivered) / cycle.promised > 0.5;
        return (
          <Card key={c.id}>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="truncate">{c.name}</CardTitle>
                <CardDescription>
                  {a.packageName} · {cycle.promised} videos a month
                </CardDescription>
              </div>
              <Badge tone={behind ? "warning" : "success"}>{behind ? "At risk" : "On track"}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-success" style={{ width: `${(delivered / cycle.promised) * 100}%` }} />
                  <div className="h-full bg-success/45" style={{ width: `${(scheduled / cycle.promised) * 100}%` }} />
                  <div className="h-full bg-primary/55" style={{ width: `${(making / cycle.promised) * 100}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1 text-body">
                  <Q n={delivered} label="Delivered" />
                  <Q n={scheduled} label="Scheduled" />
                  <Q n={making} label="In making" />
                  <Q n={notStarted} label="Not started" />
                </div>
              </div>
              <div className="space-y-1.5">
                {a.units.map((u) => (
                  <div key={u.label} className="flex items-center gap-2 text-body">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{u.label}</span>
                    <span className="tabular">{u.perCycle}/mo</span>
                  </div>
                ))}
              </div>
              <div className="text-body text-muted-foreground">
                {daysLeft} days left in September · {cycle.promised - delivered} still to deliver{notStarted ? ` · ${notStarted} not started` : ""}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Q({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="font-semibold tabular">{n}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

export function PlatformsView() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {clients.map((c) => (
        <Card key={c.id}>
          <CardHeader>
            <div>
              <CardTitle>{c.name}</CardTitle>
              <CardDescription>Accounts Genie Magnet posts to and reads results from</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ClientPlatforms clientId={c.id} dense />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Delivered vs promised across all September cycles (same numbers as Recurring Cycles). */
export function quotaSummary() {
  const sep = cycles.filter((c) => c.label === "Sep 2026");
  return { promised: sep.reduce((s, c) => s + c.promised, 0), posted: sep.reduce((s, c) => s + c.delivered, 0) };
}

