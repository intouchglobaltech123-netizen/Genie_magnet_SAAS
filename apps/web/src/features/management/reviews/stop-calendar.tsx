"use client";

import { useState } from "react";
import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, getDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TODAY } from "@/lib/mock/core";
import type { CadenceId } from "@/lib/mock/management";
import { cn } from "@/lib/utils";
import { useMgmt } from "../store";

/** Alternate Saturdays for the 14-day tactical review, and the 45-day strategic cycle. */
const TACTICAL = ["2026-09-05", "2026-09-19", "2026-10-03", "2026-10-17", "2026-10-31", "2026-11-14", "2026-11-28", "2026-12-12", "2026-12-26"];
const STRATEGIC = ["2026-08-26", "2026-10-10", "2026-11-24"];

const CHIP: Record<CadenceId, string> = {
  daily: "bg-info-soft text-info",
  weekly: "bg-muted text-text-secondary",
  tactical: "bg-primary-soft text-primary",
  strategic: "bg-accent text-primary font-semibold",
};

interface Ev {
  cadence: CadenceId;
  label: string;
  time: string;
  href?: string;
}

export function StopCalendar() {
  const [month, setMonth] = useState(startOfMonth(parseISO(TODAY)));
  const meetings = useMgmt((s) => s.meetings);
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });

  const eventsFor = (d: Date): Ev[] => {
    const iso = format(d, "yyyy-MM-dd");
    const dow = getDay(d);
    const rec = (c: CadenceId) => meetings.find((m) => m.cadence === c && m.date.startsWith(iso));
    const out: Ev[] = [];
    if (STRATEGIC.includes(iso) || rec("strategic")) {
      const m = rec("strategic");
      out.push({ cadence: "strategic", label: m ? `Strategic #${m.number}` : "Strategic review", time: "Full day", href: m ? `/reviews/${m.id}` : undefined });
    }
    if (TACTICAL.includes(iso) || rec("tactical")) {
      const m = rec("tactical");
      out.push({ cadence: "tactical", label: m ? `Tactical #${m.number}` : "Tactical review", time: "10:00 · 2 h", href: m ? `/reviews/${m.id}` : undefined });
    }
    if (dow === 1) {
      const m = rec("weekly");
      out.push({ cadence: "weekly", label: "Weekly review", time: "10:00 · 1 h", href: m ? `/reviews/${m.id}` : undefined });
    }
    if (dow !== 0 && !out.some((e) => e.cadence === "strategic")) out.push({ cadence: "daily", label: "Stand-up", time: "9:30" });
    return out;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon-sm" variant="outline" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft />
          </Button>
          <h2 className="min-w-36 text-center text-subheading font-semibold">{format(month, "MMMM yyyy")}</h2>
          <Button size="icon-sm" variant="outline" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-body text-muted-foreground">
          {(
            [
              ["strategic", "S · Strategic · every 45 days"],
              ["tactical", "T · Tactical · every 14 days"],
              ["weekly", "W · Weekly"],
              ["daily", "O · Daily stand-up"],
            ] as [CadenceId, string][]
          ).map(([c, l]) => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-sm", CHIP[c])} /> {l}
            </span>
          ))}
          <Button size="sm" variant="ghost" onClick={() => toast.success("Calendar subscription link copied", { description: "Add it to Google Calendar — every STOP review appears for the team, with the agenda link." })}>
            <CalendarPlus /> Add to Google Calendar
          </Button>
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-secondary text-body font-medium text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-2 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const inMonth = isSameMonth(d, month);
            const evs = eventsFor(d);
            return (
              <div key={iso} className={cn("min-h-24 border-b border-r border-border-subtle p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-surface-secondary/60", iso === TODAY && "bg-primary-soft/40")}>
                <div className={cn("mb-1 text-body tabular", inMonth ? "text-text-secondary" : "text-muted-foreground/60", iso === TODAY && "font-semibold text-primary")}>
                  {format(d, "d")}
                  {iso === TODAY && " · today"}
                </div>
                {inMonth && (
                  <div className="space-y-1">
                    {evs.map((e) => {
                      const chip = (
                        <span className={cn("block truncate rounded-md px-1.5 py-0.5 text-body", CHIP[e.cadence], e.cadence === "daily" && "bg-transparent px-0 text-muted-foreground")}>
                          {e.cadence === "daily" ? `· ${e.label} ${e.time}` : `${e.label} · ${e.time}`}
                        </span>
                      );
                      return e.href ? (
                        <Link key={e.cadence} href={e.href} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
                          {chip}
                        </Link>
                      ) : (
                        <div key={e.cadence}>{chip}</div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <p className="text-body text-muted-foreground">
        The rhythm comes from the agency questionnaire and Settings. Moving a strategic review moves the next one 45 days on; leave is checked against every mandatory review.
      </p>
    </div>
  );
}
