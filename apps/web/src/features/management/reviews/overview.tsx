"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, CalendarX2, CheckCircle2, Circle, History, Lock, MapPin, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { daysBetween, personById, TODAY } from "@/lib/mock/core";
import { cadenceById, NEXT_STRATEGIC } from "@/lib/mock/management";
import { cn } from "@/lib/utils";
import { commitmentState, useMgmt, useWs } from "../store";
import { CadenceLetter, cadenceTone, fmtLong } from "./bits";

export function StrategicHero() {
  const meetings = useMgmt((s) => s.meetings);
  const commitments = useMgmt((s) => s.commitments);
  const m = meetings.find((x) => x.id === NEXT_STRATEGIC)!;
  const ws = useWs(m.id);
  const days = daysBetween(TODAY, m.date.slice(0, 10));
  const toReview = commitments.filter((c) => c.reviewInMeetingId === m.id);
  const marked = toReview.filter((c) => c.mark).length;
  const checked = Object.values(ws.attendance).filter(Boolean).length;
  const locked = m.status === "locked";

  const prep = [
    { label: "Numbers snapshot auto-prepared", done: true, detail: "8 data blocks from Billing, Production, QC, Costing" },
    { label: "Previous commitments pre-marked BT / BD", done: marked === toReview.length, detail: `${marked} of ${toReview.length} marked by owners` },
    { label: "Recognitions nominated", done: ws.recognitions.length >= 3, detail: `${ws.recognitions.length} nominations` },
    { label: "Attendance confirmed", done: checked === m.attendeeIds.length, detail: `${checked} of ${m.attendeeIds.length} checked in` },
  ];
  const prepPct = (prep.filter((p) => p.done).length / prep.length) * 100;

  return (
    <Card className="relative overflow-hidden">
      <div className="glow-accent pointer-events-none absolute inset-0" />
      <div className="relative grid grid-cols-1 gap-6 p-5 lg:grid-cols-[auto_1fr_minmax(280px,360px)]">
        <div className="flex flex-col items-center justify-center rounded-xl border border-accent/40 bg-card px-7 py-5 text-center">
          <div className="text-body font-medium uppercase tracking-wider text-accent-strong">{locked ? "Locked" : "Starts in"}</div>
          <div className="mt-1 text-heading font-semibold leading-none tracking-tight tabular">{locked ? "✓" : days}</div>
          <div className="mt-1 text-body text-muted-foreground">{locked ? "record sealed" : days === 1 ? "day" : "days"}</div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">S · Strategic · every 45 days</Badge>
            <Badge tone="danger">Mandatory · full day</Badge>
          </div>
          <h2 className="mt-2 text-heading font-semibold tracking-tight">{m.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              {fmtLong(m.date)} · 10:00 AM – 6:00 PM
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {m.venue}
            </span>
          </div>
          <p className="mt-3 max-w-xl text-body leading-relaxed text-muted-foreground">
            Completion of the last 45 days since <span className="text-foreground">Strategic #6 (26 Aug)</span>, competence development, celebration and
            creation of the next 45-day plan. Facilitated by {personById(m.facilitatorId).name}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="accent" asChild>
              <Link href={`/reviews/${m.id}`}>
                Open workspace <ArrowRight />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/reviews/rv-s6">
                <Lock /> Last review (#6)
              </Link>
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-body">
            <span className="font-medium">Preparation</span>
            <span className="text-muted-foreground tabular">{Math.round(prepPct)}%</span>
          </div>
          <Progress value={prepPct} tone={prepPct === 100 ? "success" : "gold"} />
          <ul className="mt-3 space-y-2.5">
            {prep.map((p) => (
              <li key={p.label} className="flex items-start gap-2">
                {p.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                <div>
                  <div className="text-body font-medium leading-tight">{p.label}</div>
                  <div className="text-body text-muted-foreground">{p.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {toReview.some((c) => commitmentState(c) === "overdue") && (
        <div className="relative flex items-start gap-2 border-t border-border bg-warning-soft/60 px-5 py-2 text-body text-warning">
          <Repeat className="mt-0.5 size-3.5 shrink-0" />
          {toReview.filter((c) => commitmentState(c) === "overdue").length} commitments from #6 are overdue — they will auto-carry to Strategic #8 if still open when #7 is locked.
        </div>
      )}
    </Card>
  );
}

export function UpcomingSchedule() {
  const meetings = useMgmt((s) => s.meetings);
  const upcoming = meetings.filter((m) => m.status !== "locked").sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <CardTitle>Upcoming</CardTitle>
          <CardDescription>Next 3 weeks · daily stand-ups run Mon–Sat 9:30 AM</CardDescription>
        </div>
      </CardHeader>
      <div className="px-5 pb-5">
        {upcoming.length === 0 && (
          <EmptyState compact icon={CalendarX2} title="Nothing scheduled" description="Use Schedule review to add the next meeting." />
        )}
        <ol className={cn("relative space-y-1 border-l border-border pl-5", upcoming.length === 0 && "hidden")}>
          {upcoming.map((m) => {
            const c = cadenceById(m.cadence);
            const d = daysBetween(TODAY, m.date.slice(0, 10));
            return (
              <li key={m.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[26px] top-3.5 size-2.5 rounded-full ring-4 ring-card",
                    m.cadence === "strategic" ? "bg-accent" : m.cadence === "tactical" ? "bg-primary" : m.cadence === "daily" ? "bg-info" : "bg-chart-5",
                  )}
                />
                <Link href={`/reviews/${m.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                  <CadenceLetter cadence={m.cadence} letter={c.letter} className="size-7 text-body" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-medium">{m.title}</div>
                    <div className="text-body text-muted-foreground">
                      {fmtLong(m.date)} · {new Date(m.date).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} · {c.duration}
                    </div>
                  </div>
                  <Badge tone={d === 0 ? "success" : d <= 3 ? "warning" : "outline"}>{d === 0 ? "Today" : `in ${d}d`}</Badge>
                  <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}

export function PastReviews() {
  const meetings = useMgmt((s) => s.meetings);
  const past = meetings.filter((m) => m.status === "locked").sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <CardTitle>Past reviews</CardTitle>
          <CardDescription>Locked records · figures preserved as they were at lock time</CardDescription>
        </div>
      </CardHeader>
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Review</TH>
            <TH>Date</TH>
            <TH numeric>Attended</TH>
            <TH numeric>Decisions</TH>
            <TH>BT / BD</TH>
            <TH className="pr-5 text-right">Record</TH>
          </TR>
        </THead>
        <TBody>
          {past.map((m) => {
            const s = m.stats;
            const total = (s?.bt ?? 0) + (s?.bd ?? 0);
            return (
              <TR key={m.id}>
                <TD className="pl-5">
                  <Link href={`/reviews/${m.id}`} className="flex items-center gap-2 rounded-lg font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                    <Badge tone={cadenceTone[m.cadence]}>{cadenceById(m.cadence).every}</Badge>
                    {m.title}
                  </Link>
                </TD>
                <TD className="text-muted-foreground">{fmtLong(m.date)}</TD>
                <TD numeric>
                  {s?.attended ?? "—"}/{m.attendeeIds.length}
                </TD>
                <TD numeric>{s?.decisions ?? 0}</TD>
                <TD>
                  {total ? (
                    <div className="flex w-32 items-center gap-2">
                      <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="bg-success" style={{ width: `${((s?.bt ?? 0) / total) * 100}%` }} />
                        <div className="bg-danger" style={{ width: `${((s?.bd ?? 0) / total) * 100}%` }} />
                      </div>
                      <span className="text-body text-muted-foreground tabular">
                        {s?.bt}/{s?.bd}
                      </span>
                    </div>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD className="pr-5 text-right">
                  <Link href={`/reviews/${m.id}`} aria-label={`Open locked record: ${m.title}`} className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                    <Badge tone="neutral" className="hover:text-text-primary">
                      <Lock /> Locked
                    </Badge>
                  </Link>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      {past.length === 0 && (
        <div className="px-5 pb-5">
          <EmptyState compact icon={History} title="No locked reviews yet" description="Records appear here once a review is closed and locked." />
        </div>
      )}
    </Card>
  );
}
