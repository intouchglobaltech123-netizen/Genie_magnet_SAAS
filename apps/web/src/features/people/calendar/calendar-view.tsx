"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Lock, MapPin, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TODAY } from "@/lib/mock/core";
import { cn } from "@/lib/utils";
import { EVENT_TYPES, seedEvents, typeMeta, type CalEvent, type EventType } from "./data";
import { EventDetailsDialog, NewEventDialog, to12 } from "./event-dialogs";

const START_H = 8;
const END_H = 20;
const HOUR_PX = 52;
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
};
const iso = (d: Date) => format(d, "yyyy-MM-dd");

function tint(color: string, pct: number) {
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}

/** Lay out overlapping timed events into side-by-side lanes. */
function layout(evts: CalEvent[]) {
  const sorted = [...evts].sort((a, b) => toMin(a.start!) - toMin(b.start!) || toMin(b.end!) - toMin(a.end!));
  const res: { ev: CalEvent; lane: number; lanes: number }[] = [];
  let cluster: { ev: CalEvent; lane: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => res.push({ ...c, lanes }));
    cluster = [];
  };
  for (const ev of sorted) {
    const s = toMin(ev.start!);
    if (s >= clusterEnd && cluster.length) flush();
    const laneEnds: number[] = [];
    cluster.forEach((c) => (laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? 0, toMin(c.ev.end!))));
    let lane = 0;
    while (laneEnds[lane] !== undefined && laneEnds[lane]! > s) lane++;
    cluster.push({ ev, lane });
    clusterEnd = Math.max(clusterEnd, toMin(ev.end!));
  }
  flush();
  return res;
}

function Pill({ ev, onClick, compact }: { ev: CalEvent; onClick: () => void; compact?: boolean }) {
  const c = typeMeta[ev.type].color;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-1 truncate rounded-md px-1.5 text-left text-body font-medium leading-4 transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
        compact ? "h-6" : "h-7",
        ev.status === "pending" && "border border-dashed",
      )}
      style={{ background: tint(c, 16), color: "var(--color-foreground)", borderColor: c }}
      title={ev.title}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: c }} />
      {ev.start && <span className="tabular shrink-0 text-muted-foreground">{to12(ev.start).replace(":00", "").replace(" ", "").toLowerCase()}</span>}
      <span className="truncate">{ev.title}</span>
      {ev.locked && <Lock className="size-3 shrink-0" />}
    </button>
  );
}

export function CalendarView() {
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(() => parseISO(TODAY));
  const [enabled, setEnabled] = useState<Record<EventType, boolean>>({ shoot: true, meeting: true, leave: true, publish: true, holiday: true });
  const [events, setEvents] = useState<CalEvent[]>(seedEvents);
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [creating, setCreating] = useState(false);

  const visible = useMemo(() => events.filter((e) => enabled[e.type]), [events, enabled]);
  const byDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of visible) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [visible]);

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const weeksInMonth = Math.ceil((endOfMonth(anchor).getTime() - gridStart.getTime()) / (7 * 86400000));
  const monthDays = Array.from({ length: Math.max(5, weeksInMonth) * 7 }, (_, i) => addDays(gridStart, i));

  const rangeLabel =
    view === "week"
      ? `${format(weekDays[0]!, "d MMM")} – ${format(weekDays[6]!, "d MMM yyyy")}`
      : format(anchor, "MMMM yyyy");

  const step = (dir: 1 | -1) => setAnchor((a) => (view === "week" ? addWeeks(a, dir) : addMonths(a, dir)));
  const counts = EVENT_TYPES.reduce(
    (acc, t) => {
      const days = view === "week" ? weekDays.map(iso) : monthDays.filter((d) => isSameMonth(d, anchor)).map(iso);
      acc[t] = events.filter((e) => e.type === t && days.includes(e.date) && !(t === "meeting" && e.title === "Daily standup" && view === "month")).length;
      return acc;
    },
    {} as Record<EventType, number>,
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAnchor(parseISO(TODAY))}>
            Today
          </Button>
          <div className="flex">
            <Button variant="ghost" size="icon-sm" onClick={() => step(-1)} aria-label="Previous">
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => step(1)} aria-label="Next">
              <ChevronRight />
            </Button>
          </div>
          <h2 className="min-w-44 text-subheading font-semibold tracking-tight">{rangeLabel}</h2>
          <div role="group" aria-label="Calendar view" className="inline-flex rounded-lg bg-muted p-0.5 text-body">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1 font-medium capitalize text-muted-foreground transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                  view === v && "bg-card text-text-primary shadow-sm",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {EVENT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setEnabled((e) => ({ ...e, [t]: !e[t] }))}
              aria-pressed={enabled[t]}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-body font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                enabled[t] ? "border-border bg-card text-text-primary" : "border-dashed border-border text-muted-foreground",
              )}
            >
              <span className="size-2 rounded-full" style={{ background: enabled[t] ? typeMeta[t].color : "var(--color-muted-foreground)" }} />
              {typeMeta[t].label}
              <span className="tabular text-muted-foreground">{counts[t]}</span>
            </button>
          ))}
          <Button variant="accent" size="sm" className="ml-1" onClick={() => setCreating(true)}>
            <Plus /> New event
          </Button>
        </div>
      </Card>

      {view === "week" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[860px]">
              {/* Day headers */}
              <div className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-border">
                <div />
                {weekDays.map((d) => {
                  const today = iso(d) === TODAY;
                  return (
                    <div key={iso(d)} className={cn("border-l border-border px-2 py-2 text-center", d.getDay() === 0 && "bg-muted/50")}>
                      <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">{format(d, "EEE")}</div>
                      <div
                        className={cn(
                          "tabular mx-auto mt-0.5 inline-flex size-7 items-center justify-center rounded-full text-subheading font-semibold",
                          today && "bg-primary text-primary-foreground",
                        )}
                      >
                        {format(d, "d")}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* All-day row */}
              <div className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-border">
                <div className="px-2 py-2 text-right text-body leading-4 text-muted-foreground">All day</div>
                {weekDays.map((d) => {
                  const list = (byDate.get(iso(d)) ?? []).filter((e) => !e.start);
                  return (
                    <div key={iso(d)} className={cn("min-h-10 space-y-1 border-l border-border p-1", d.getDay() === 0 && "bg-muted/50")}>
                      {list.map((e) => (
                        <Pill key={e.id} ev={e} compact onClick={() => setSelected(e)} />
                      ))}
                    </div>
                  );
                })}
              </div>
              {/* Time grid */}
              <div className="grid grid-cols-[72px_repeat(7,1fr)]">
                <div className="relative" style={{ height: (END_H - START_H) * HOUR_PX }}>
                  {Array.from({ length: END_H - START_H }, (_, i) => (
                    <div key={i} className="tabular absolute right-2 -translate-y-1/2 text-body text-muted-foreground" style={{ top: i * HOUR_PX }}>
                      {i === 0 ? "" : to12(`${START_H + i}:00`).replace(":00", "")}
                    </div>
                  ))}
                </div>
                {weekDays.map((d) => {
                  const timed = (byDate.get(iso(d)) ?? []).filter((e) => e.start && e.end);
                  const isToday = iso(d) === TODAY;
                  return (
                    <div
                      key={iso(d)}
                      className={cn("relative border-l border-border", d.getDay() === 0 && "bg-muted/50", isToday && "bg-primary-soft/40")}
                      style={{ height: (END_H - START_H) * HOUR_PX }}
                    >
                      {Array.from({ length: END_H - START_H }, (_, i) => (
                        <div key={i} className="absolute inset-x-0 border-t border-border/70" style={{ top: i * HOUR_PX }} />
                      ))}
                      {isToday && (
                        <div className="absolute inset-x-0 z-20 flex items-center" style={{ top: ((11 * 60 + 20 - START_H * 60) / 60) * HOUR_PX }}>
                          <span className="-ml-1 size-2 rounded-full bg-danger" />
                          <span className="h-px flex-1 bg-danger" />
                        </div>
                      )}
                      {layout(timed).map(({ ev, lane, lanes }) => {
                        const s = Math.max(toMin(ev.start!), START_H * 60);
                        const e = Math.min(toMin(ev.end!), END_H * 60);
                        const top = ((s - START_H * 60) / 60) * HOUR_PX;
                        const height = Math.max(20, ((e - s) / 60) * HOUR_PX - 2);
                        const c = typeMeta[ev.type].color;
                        const early = toMin(ev.start!) < START_H * 60;
                        return (
                          <button
                            key={ev.id}
                            onClick={() => setSelected(ev)}
                            className="absolute z-10 cursor-pointer overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-body leading-4 transition hover:z-30 hover:shadow-pop focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                            style={{
                              top: top + 1,
                              height,
                              left: `calc(${(lane / lanes) * 100}% + 2px)`,
                              width: `calc(${100 / lanes}% - 4px)`,
                              background: tint(c, 18),
                              borderColor: c,
                            }}
                          >
                            <div className="flex items-center gap-1 font-medium">
                              {ev.locked && <Lock className="size-3 shrink-0" />}
                              <span className="truncate">{ev.title}</span>
                            </div>
                            {height > 38 && (
                              <div className="tabular truncate text-body text-muted-foreground">
                                {early ? `Call ${to12(ev.start!)}` : to12(ev.start!)} – {to12(ev.end!)}
                              </div>
                            )}
                            {height > 60 && ev.location && (
                              <div className="flex items-center gap-0.5 truncate text-body text-muted-foreground">
                                <MapPin className="size-3 shrink-0" />
                                <span className="truncate">{ev.location}</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7 border-b border-border">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="px-2 py-2 text-body font-medium uppercase tracking-wider text-muted-foreground">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((d, i) => {
                  const list = (byDate.get(iso(d)) ?? [])
                    .filter((e) => e.title !== "Daily standup")
                    .sort((a, b) => (a.start ?? "00:00").localeCompare(b.start ?? "00:00"));
                  const shown = list.slice(0, 3);
                  const more = list.length - shown.length;
                  const inMonth = isSameMonth(d, anchor);
                  const isToday = iso(d) === TODAY;
                  return (
                    <div
                      key={iso(d)}
                      className={cn(
                        "min-h-36 space-y-1 border-border p-1.5",
                        i % 7 !== 0 && "border-l",
                        i >= 7 && "border-t",
                        !inMonth && "bg-muted/40",
                        d.getDay() === 0 && inMonth && "bg-muted/25",
                      )}
                    >
                      <div className="flex justify-end">
                        <span
                          className={cn(
                            "tabular inline-flex size-6 items-center justify-center rounded-full text-body font-medium",
                            !inMonth && "text-muted-foreground",
                            isToday && "bg-primary text-primary-foreground",
                          )}
                        >
                          {format(d, "d")}
                        </span>
                      </div>
                      {shown.map((e) => (
                        <Pill key={e.id} ev={e} compact onClick={() => setSelected(e)} />
                      ))}
                      {more > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="cursor-pointer rounded-md px-1.5 text-body font-medium text-muted-foreground hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">+{more} more</button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 space-y-1">
                            <div className="mb-1 text-body font-semibold">{format(d, "EEEE, d MMM")}</div>
                            {list.map((e) => (
                              <Pill key={e.id} ev={e} onClick={() => setSelected(e)} />
                            ))}
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="border-t border-border px-4 py-2 text-body text-muted-foreground">
            Daily standups (9:30 AM, Mon–Sat) are hidden in month view — switch to Week to see them.
          </div>
        </Card>
      )}

      <EventDetailsDialog
        event={selected}
        onClose={() => setSelected(null)}
        onMove={(id, date) => setEvents((es) => es.map((e) => (e.id === id ? { ...e, date } : e)))}
      />
      <NewEventDialog
        key={iso(anchor)}
        open={creating}
        onOpenChange={setCreating}
        defaultDate={iso(anchor)}
        onCreate={(e) => {
          setEvents((es) => [...es, e]);
          setEnabled((en) => ({ ...en, [e.type]: true }));
          setAnchor(parseISO(e.date));
        }}
      />
    </div>
  );
}
