"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StageBadge, UrgencyIcon, VPBadge } from "@/components/shared/video-bits";
import { clientById, clients, isOverdue, personById, shoots, TODAY } from "@/lib/mock/core";
import type { Shoot, Video } from "@/lib/types";
import { cn } from "@/lib/utils";
import { clientDot, clientTint, fmt, HOLIDAYS, isDone, toIso } from "./lib";

type Item = { kind: "video"; v: Video } | { kind: "shoot"; s: Shoot };

export function CalendarView({ videos, clientFilter, onNew }: { videos: Video[]; clientFilter: string; onNew: (day: string) => void }) {
  const [month, setMonth] = useState(() => startOfMonth(parseISO(TODAY)));
  const [selected, setSelected] = useState(TODAY);

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }),
    [month],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    const push = (d: string, it: Item) => map.set(d, [...(map.get(d) ?? []), it]);
    shoots.filter((s) => clientFilter === "all" || s.clientId === clientFilter).forEach((s) => push(s.date, { kind: "shoot", s }));
    videos.forEach((v) => push(v.dueDate, { kind: "video", v }));
    return map;
  }, [videos, clientFilter]);

  const monthVideos = videos.filter((v) => isSameMonth(parseISO(v.dueDate), month));
  const monthShoots = shoots.filter((s) => isSameMonth(parseISO(s.date), month) && (clientFilter === "all" || s.clientId === clientFilter));
  const selectedItems = byDay.get(selected) ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-subheading font-semibold tracking-tight">{format(month, "MMMM yyyy")}</h2>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon-sm" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month">
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
                <ChevronRight />
              </Button>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setMonth(startOfMonth(parseISO(TODAY)));
                setSelected(TODAY);
              }}
            >
              Today
            </Button>
          </div>
          <div className="flex items-center gap-4 text-body text-muted-foreground">
            <span className="tabular">
              <b className="font-semibold text-foreground">{monthVideos.length}</b> videos
            </span>
            <span className="tabular">
              <b className="font-semibold text-foreground">{monthShoots.length}</b> shoots
            </span>
            <span className="tabular">
              <b className="font-semibold text-success">{monthVideos.filter(isDone).length}</b> delivered
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-b border-border bg-muted/30 px-5 py-2.5">
          {clients.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 text-body text-muted-foreground">
              <span className="size-2 rounded-full" style={clientDot(c.id)} />
              {c.name}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-body text-muted-foreground">
            <Camera className="size-3" /> Shoot day
          </span>
        </div>
        <div className="grid grid-cols-7 border-b border-border text-body font-medium uppercase tracking-wider text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-2.5 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const iso = toIso(d);
            const items = byDay.get(iso) ?? [];
            const inMonth = isSameMonth(d, month);
            const isToday = iso === TODAY;
            const isSel = iso === selected;
            const sunday = d.getDay() === 0;
            const holiday = HOLIDAYS[iso];
            const shown = items.slice(0, 3);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                className={cn(
                  "group relative flex min-h-[112px] cursor-pointer flex-col gap-1 border-border p-1.5 text-left transition-colors hover:bg-muted/50",
                  i % 7 !== 6 && "border-r",
                  i < days.length - 7 && "border-b",
                  !inMonth && "bg-muted/30 opacity-50",
                  (sunday || holiday) && inMonth && "bg-muted/40",
                  isSel && "bg-primary-soft/40 ring-2 ring-inset ring-primary/50",
                )}
              >
                <div className="flex items-center justify-between px-1">
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-body font-medium tabular",
                      isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {holiday && <span className="truncate text-body text-accent-strong">{holiday}</span>}
                </div>
                {shown.map((it) =>
                  it.kind === "shoot" ? (
                    <span
                      key={it.s.id}
                      className="flex items-center gap-1 truncate rounded-md border border-dashed px-1.5 py-[3px] text-body font-medium"
                      style={{ ...clientTint(it.s.clientId, 8), borderColor: `color-mix(in srgb, ${clientTint(it.s.clientId).color} 45%, transparent)` }}
                    >
                      <Camera className="size-3 shrink-0" />
                      <span className="truncate">{it.s.batchNo}</span>
                    </span>
                  ) : (
                    <span
                      key={it.v.id}
                      className={cn("flex items-center gap-1 truncate rounded-md px-1.5 py-[3px] text-body font-medium", isOverdue(it.v) && "ring-1 ring-danger/60")}
                      style={clientTint(it.v.clientId, isDone(it.v) ? 8 : 16)}
                    >
                      {isDone(it.v) ? <CheckCircle2 className="size-3 shrink-0" /> : <span className="size-1.5 shrink-0 rounded-full bg-current" />}
                      <span className={cn("truncate", isDone(it.v) && "opacity-70")}>{it.v.title}</span>
                    </span>
                  ),
                )}
                {items.length > 3 && <span className="px-1.5 text-body font-medium text-muted-foreground">+{items.length - 3} more</span>}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="flex flex-col">
        <div className="flex items-start justify-between border-b border-border p-5 pb-4">
          <div>
            <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">{fmt(selected, "EEEE")}</div>
            <div className="mt-0.5 text-heading font-semibold tracking-tight">{fmt(selected, "d MMMM yyyy")}</div>
            {HOLIDAYS[selected] && <div className="mt-1 text-body text-accent-strong">Holiday · {HOLIDAYS[selected]}</div>}
          </div>
          <Button size="xs" variant="outline" onClick={() => onNew(selected)}>
            <Plus /> Video
          </Button>
        </div>
        <div className="flex-1 space-y-2.5 p-4">
          {!selectedItems.length && (
            <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
              <div className="text-body font-medium">Nothing scheduled</div>
              <div className="text-body text-muted-foreground">{selected === TODAY ? "A calm day — plan ahead." : "Free slot for a shoot or delivery."}</div>
            </div>
          )}
          {selectedItems.map((it) =>
            it.kind === "shoot" ? (
              <Link key={it.s.id} href={`/shoots/${it.s.id}`} className="block rounded-xl border border-dashed border-border p-3 transition hover:border-primary/50 hover:bg-muted/40">
                <div className="flex items-center gap-2 text-body font-medium" style={{ color: clientTint(it.s.clientId).color }}>
                  <Camera className="size-3.5" /> Shoot · {it.s.batchNo} · {it.s.callTime}
                </div>
                <div className="mt-1 text-body font-medium">{it.s.projectName}</div>
                <div className="mt-1 flex items-center gap-1 text-body text-muted-foreground">
                  <MapPin className="size-3" /> {it.s.location}
                </div>
                <div className="mt-1 text-body text-muted-foreground">
                  {personById(it.s.cameraId).name} · {it.s.videoIds.length} videos · {it.s.kit === "dual" ? "Dual" : "Single"} cam
                </div>
              </Link>
            ) : (
              <Link key={it.v.id} href={`/production/${it.v.id}`} className="block rounded-xl border border-border p-3 transition hover:border-primary/50 hover:bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-body font-medium text-muted-foreground">{it.v.code}</span>
                  <div className="flex items-center gap-1">
                    <UrgencyIcon urgency={it.v.urgency} />
                    <VPBadge on={it.v.videoProtection} />
                  </div>
                </div>
                <div className="mt-1 text-body font-medium leading-snug">{it.v.title}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-body text-muted-foreground">
                    <span className="size-2 rounded-full" style={clientDot(it.v.clientId)} />
                    {clientById(it.v.clientId).name}
                  </span>
                  <StageBadge stage={it.v.stage} />
                </div>
              </Link>
            ),
          )}
        </div>
      </Card>
    </div>
  );
}
