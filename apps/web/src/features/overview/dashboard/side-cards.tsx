"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowRight, Camera, CalendarClock, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { daysBetween, people, personById, shoots, TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { cn, pct } from "@/lib/utils";

const REVIEW_DATE = "2026-10-10";

export function ReviewCountdownCard() {
  const days = daysBetween(TODAY, REVIEW_DATE);
  const elapsed = 45 - days;
  return (
    <Card className="relative overflow-hidden border-primary/25 bg-grid">
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
      <CardContent className="relative flex items-center gap-5 p-5">
        <div className="relative size-20 shrink-0">
          <svg viewBox="0 0 36 36" className="size-20 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-muted)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(elapsed / 45) * 97.4} 97.4`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-heading font-semibold leading-none tabular">{days}</span>
            <span className="text-body text-muted-foreground">days</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-body font-medium uppercase tracking-wider text-primary">Next 45-day strategic review</div>
          <div className="mt-1 text-subheading font-semibold">Saturday, 10 Oct 2026 · 10:00 AM</div>
          <div className="mt-0.5 text-body text-muted-foreground">Goals, client health, margins, founder dependency. 4 of 7 pre-reads ready.</div>
          <Button variant="link" size="xs" className="mt-1 h-auto" asChild>
            <Link href="/reviews">
              Prepare agenda <ArrowRight />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function WeekShootsCard() {
  const upcoming = shoots.filter((s) => s.status === "planned").sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>This week</CardTitle>
          <CardDescription>Upcoming shoots</CardDescription>
        </div>
        <Button variant="ghost" size="xs" asChild>
          <Link href="/shoots">
            All shoots <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {upcoming.map((s) => {
          const d = parseISO(s.date);
          const inDays = daysBetween(TODAY, s.date);
          return (
            <Link key={s.id} href="/shoots" className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:border-primary/40 hover:bg-muted/40">
              <div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted py-1">
                <span className="text-body font-medium uppercase text-muted-foreground">{format(d, "EEE")}</span>
                <span className="text-subheading font-semibold leading-tight tabular">{format(d, "d")}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-medium">{s.projectName}</div>
                <div className="flex items-center gap-1 truncate text-body text-muted-foreground">
                  <MapPin className="size-3 shrink-0" /> {s.location} · {s.callTime}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={inDays <= 2 ? "warning" : "neutral"}>in {inDays}d</Badge>
                <span className="inline-flex items-center gap-1 text-body text-muted-foreground">
                  <Camera className="size-3" />
                  {s.kit === "dual" ? "Dual" : "Single"}
                </span>
              </div>
            </Link>
          );
        })}
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-body text-muted-foreground">
          <CalendarClock className="size-3.5" /> Nirmala Cooking Academy kickoff shoot — pending onboarding gate
        </div>
      </CardContent>
    </Card>
  );
}

const dotTone = { accent: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-danger" };

export function ActivityFeedCard({ limit = 9 }: { limit?: number }) {
  const activity = useDemo((s) => s.activity);
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            Live activity
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
          </CardTitle>
          <CardDescription>Across the agency</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="max-h-[380px] flex-1 overflow-y-auto scrollbar-thin">
        <ol className="relative space-y-3.5 before:absolute before:bottom-1 before:left-[3px] before:top-1 before:w-px before:bg-border">
          {activity.slice(0, limit).map((a) => (
            <li key={a.id} className="relative pl-5">
              <span className={cn("absolute left-0 top-1.5 size-[7px] rounded-full ring-2 ring-card", dotTone[a.tone ?? "accent"])} />
              <div className="text-body leading-snug">{a.text}</div>
              <div className="mt-0.5 text-body text-muted-foreground tabular">{format(parseISO(a.at), "d MMM · HH:mm")}</div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function WorkloadCard() {
  const team = people
    .filter((p) => p.type === "employee" || p.utilisation >= 0.5)
    .sort((a, b) => b.utilisation - a.utilisation)
    .slice(0, 8);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Team workload</CardTitle>
          <CardDescription>Utilisation this week</CardDescription>
        </div>
        <Button variant="ghost" size="xs" asChild>
          <Link href="/planning">
            Capacity <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {team.map((p) => {
          const over = p.utilisation > 1;
          const low = p.utilisation < 0.5;
          return (
            <div key={p.id} className="flex items-center gap-2.5">
              <Avatar name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-body font-medium">
                    {p.name}
                    {p.type === "freelancer" && <span className="ml-1 text-body font-normal text-muted-foreground">freelance</span>}
                  </span>
                  <Tooltip content={over ? "Over capacity — rebalance" : p.status === "on-leave" ? "On leave" : `${pct(p.utilisation)} of available hours`}>
                    <span className={cn("text-body font-semibold tabular", over ? "text-danger" : low ? "text-muted-foreground" : "")}>
                      {pct(p.utilisation)}
                    </span>
                  </Tooltip>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", over ? "bg-danger" : p.utilisation > 0.9 ? "bg-warning" : low ? "bg-chart-5" : "bg-primary")}
                    style={{ width: `${Math.min(100, p.utilisation * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
        <div className="pt-1 text-body text-muted-foreground">
          {personById("p-naveen").name} on leave · capacity reduced by 16h this week
        </div>
      </CardContent>
    </Card>
  );
}

