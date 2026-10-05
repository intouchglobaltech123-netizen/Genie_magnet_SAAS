"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { CalendarEvent } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { errorMessage } from "./api";
import { fmtDate } from "./format";
import { MonthSwitcher, thisMonth } from "./production-bits";
import { useCalendar } from "./queries";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const KIND: Record<CalendarEvent["kind"], { label: string; bar: string }> = {
  shoot: { label: "Shoot", bar: "border-l-info" },
  post: { label: "Post", bar: "border-l-primary" },
  due: { label: "Due", bar: "border-l-warning" },
  publish: { label: "To publish", bar: "border-l-success" },
  renewal: { label: "Agreement ends", bar: "border-l-accent-strong" },
  followup: { label: "Follow-up", bar: "border-l-secondary" },
  interview: { label: "Interview", bar: "border-l-danger" },
};

/** The Monday on or before the 1st to the Sunday on or after the last day: whole weeks. */
function grid(month: string) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const start = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY);
  const end = new Date(last.getTime() + ((7 - last.getUTCDay()) % 7) * DAY);
  const days: string[] = [];
  for (let d = start; d <= end; d = new Date(d.getTime() + DAY)) days.push(iso(d));
  return days;
}

function Chip({ e }: { e: CalendarEvent }) {
  return (
    <Link
      href={e.link}
      title={[KIND[e.kind].label, e.time, e.title, e.client?.name, e.detail].filter(Boolean).join(" · ")}
      className={cn(
        "block truncate rounded-md border-l-[3px] bg-surface-secondary px-1.5 py-0.5 text-body hover:bg-muted",
        KIND[e.kind].bar,
        e.state === "done" && "text-muted-foreground line-through decoration-1",
        e.state === "late" && "border-l-danger bg-danger-soft/50 text-danger",
      )}
    >
      {e.time && <span className="mr-1 tabular-nums text-muted-foreground">{e.time}</span>}
      {e.title}
      {e.client && <span className="text-muted-foreground"> · {e.client.code}</span>}
    </Link>
  );
}

export function LiveCalendar() {
  const [month, setMonth] = useState(thisMonth());
  const [client, setClient] = useState("all");
  const days = useMemo(() => grid(month), [month]);
  const events = useCalendar(days[0]!, days[days.length - 1]!);
  const today = iso(new Date());
  const all = events.data ?? [];
  const clients = [...new Map(all.filter((e) => e.client).map((e) => [e.client!.id, e.client!])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const shown = client === "all" ? all : all.filter((e) => e.client?.id === client);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of shown) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const inMonth = days.filter((d) => d.startsWith(month) && byDay.has(d));

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Shoots, videos due and to publish, scheduled posts, sales follow-ups and agreements ending — what you work on."
        actions={
          <>
            {clients.length > 1 && (
              <Select
                aria-label="Client"
                className="w-48"
                value={client}
                onValueChange={setClient}
                options={[{ value: "all", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
              />
            )}
            <MonthSwitcher month={month} onChange={setMonth} />
          </>
        }
      />
      <div className="mb-3 flex flex-wrap gap-3 text-body text-muted-foreground">
        {(Object.keys(KIND) as CalendarEvent["kind"][]).map((k) => (
          <span key={k} className={cn("border-l-[3px] pl-1.5", KIND[k].bar)}>
            {KIND[k].label}
          </span>
        ))}
        <span className="border-l-[3px] border-l-danger pl-1.5">Late</span>
      </div>
      {events.isPending ? (
        <SkeletonRows rows={6} />
      ) : events.error ? (
        <Alert tone="danger">{errorMessage(events.error)}</Alert>
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="grid grid-cols-7 border-b border-border bg-surface-secondary text-body font-medium text-muted-foreground">
              {WEEKDAYS.map((w) => (
                <div key={w} className="px-2 py-1.5">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => (
                <div
                  key={d}
                  className={cn(
                    "min-h-28 space-y-1 border-b border-r border-border-subtle p-1.5 [&:nth-child(7n)]:border-r-0",
                    !d.startsWith(month) && "bg-muted/40",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-body",
                      d === today ? "bg-primary font-semibold text-primary-foreground" : !d.startsWith(month) ? "text-text-muted" : "text-muted-foreground",
                    )}
                  >
                    {Number(d.slice(8))}
                  </div>
                  {(byDay.get(d) ?? []).map((e, i) => (
                    <Chip key={`${e.link}-${e.kind}-${i}`} e={e} />
                  ))}
                </div>
              ))}
            </div>
          </Card>
          <div className="space-y-4 md:hidden">
            {!inMonth.length ? (
              <EmptyState icon={CalendarDays} title="Nothing this month" description="Shoots, due dates and posts show here as they are planned." />
            ) : (
              inMonth.map((d) => (
                <div key={d}>
                  <div className={cn("mb-1 text-body font-medium", d === today && "text-primary")}>{fmtDate(d)}</div>
                  <div className="space-y-1">
                    {byDay.get(d)!.map((e, i) => (
                      <Chip key={`${e.link}-${e.kind}-${i}`} e={e} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}
