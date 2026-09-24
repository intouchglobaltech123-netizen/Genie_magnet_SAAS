"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, CopyPlus, FileText, HeartPulse, Lock, Plus, Sun } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { TODAY, personById } from "@/lib/mock/core";
import { holidayByDate, leaveRequests } from "@/lib/mock/people";
import { cn } from "@/lib/utils";
import { useDaily } from "../daily-store";
import { sheetPeople, templates, kindFor } from "./config";
import { onLeave, statusOf, validate } from "./compute";
import { CounterGrid } from "./counters";
import { DaySummary } from "./day-summary";
import { PaperView } from "./paper-view";
import { sheetKey } from "./seed";
import { SignoffRail } from "./signoff-rail";
import { StatusBadge } from "./status-badge";
import { TaskTable } from "./task-table";
import { dayLabel, isSunday, shiftDate } from "./time";

export function SheetWorkspace({
  personId,
  date,
  onPerson,
  onDate,
}: {
  personId: string;
  date: string;
  onPerson: (id: string) => void;
  onDate: (d: string) => void;
}) {
  const sheets = useDaily((s) => s.sheets);
  const { setCounter, setField, addRow, carryForward } = useDaily();
  const [paper, setPaper] = useState(false);
  const [showIssues, setShowIssues] = useState(false);

  const kind = kindFor(personId);
  const template = templates[kind];
  const person = personById(personId);
  const sheet = sheets[sheetKey(personId, date)];
  const locked = !!sheet?.submittedAt;
  const signedLocked = !!sheet?.hrSignedAt;
  const issues = useMemo(() => validate(sheet), [sheet]);
  const issueRows = useMemo(() => new Set(showIssues ? issues.map((i) => i.rowId).filter(Boolean) as string[] : []), [issues, showIssues]);
  const status = statusOf(personId, date, sheet);
  const leave = onLeave(personId, date) ? leaveRequests.find((l) => l.personId === personId && l.status === "approved" && date >= l.from && date <= l.to) : undefined;
  const holiday = holidayByDate(date);
  const sunday = isSunday(date);
  const future = date > TODAY;
  const hasRows = (sheet?.rows.length ?? 0) > 0;
  const Icon = template.icon;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {sheetPeople.map((sp) => {
              const p = personById(sp.personId);
              const active = sp.personId === personId;
              const st = statusOf(sp.personId, date, sheets[sheetKey(sp.personId, date)]);
              return (
                <button
                  key={sp.personId}
                  onClick={() => onPerson(sp.personId)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left transition",
                    active ? "border-accent/40 bg-accent-soft/60 shadow-sm" : "border-transparent hover:bg-muted",
                  )}
                >
                  <Avatar name={p.name} size="md" />
                  <div className="leading-tight">
                    <div className="text-[13px] font-semibold">{p.name}</div>
                    <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                      {templates[sp.kind].short}
                      <StatusDot status={st} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="icon-sm" variant="outline" onClick={() => onDate(shiftDate(date, -1))} aria-label="Previous day">
              <ChevronLeft />
            </Button>
            <label className="relative flex h-8 items-center gap-2 rounded-lg border border-input bg-card pl-2.5 pr-2 text-[13px] font-medium">
              <CalendarDays className="size-4 text-muted-foreground" />
              <span className="tabular">{dayLabel(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
              <input
                type="date"
                value={date}
                max="2026-12-31"
                onChange={(e) => e.target.value && onDate(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <Button size="icon-sm" variant="outline" onClick={() => onDate(shiftDate(date, 1))} aria-label="Next day">
              <ChevronRight />
            </Button>
            {date !== TODAY && (
              <Button size="sm" variant="ghost" onClick={() => onDate(TODAY)}>
                Today
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* The sheet */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/40 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="size-5" />
                </span>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Genie Magnet · Form DS-{kind.toUpperCase()}</div>
                  <h2 className="text-[17px] font-semibold tracking-tight">{template.title}</h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="mr-2 hidden text-right text-[12px] leading-5 sm:block">
                  <div className="font-medium">{person.name}</div>
                  <div className="text-muted-foreground">
                    {person.role} · {dayLabel(date, { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
                <StatusBadge status={status} />
                {signedLocked && (
                  <Badge tone="success">
                    <Lock /> Signed
                  </Badge>
                )}
                <Button size="sm" variant="outline" onClick={() => setPaper(true)}>
                  <FileText /> Paper view
                </Button>
              </div>
            </div>

            {leave && !hasRows ? (
              <EmptyState
                icon={HeartPulse}
                tone="warning"
                title={`${person.name.split(" ")[0]} is on approved ${leave.type === "SL" ? "sick" : "casual"} leave`}
                text={`${leave.reason}. No data sheet expected for ${dayLabel(leave.from, { day: "numeric", month: "short" })}–${dayLabel(leave.to, { day: "numeric", month: "short" })}. Approved by ${leave.approver}.`}
                action={
                  <Button size="sm" variant="outline" onClick={() => onDate(shiftDate(leave.from, -1))}>
                    View last working day’s sheet
                  </Button>
                }
              />
            ) : (sunday || holiday) && !hasRows ? (
              <EmptyState
                icon={Sun}
                tone="info"
                title={sunday ? "Weekly off (Sunday)" : `Holiday — ${holiday?.name}`}
                text="No data sheet required. If you worked today, log it and it will be flagged as extra time."
                action={
                  <Button size="sm" variant="outline" onClick={() => addRow(personId, date)}>
                    <Plus /> Log extra work
                  </Button>
                }
              />
            ) : future && !hasRows ? (
              <EmptyState icon={CalendarDays} tone="neutral" title="This day hasn’t happened yet" text="Sheets open on the day. Plan work in Projects & Tasks." />
            ) : !hasRows ? (
              <EmptyState
                icon={FileText}
                tone="accent"
                title="Start today’s data sheet"
                text="No more paper forms — start from a blank row or carry forward yesterday’s pending tasks."
                action={
                  <div className="flex gap-2">
                    <Button size="sm" variant="accent" onClick={() => addRow(personId, date, { start: "09:30" })}>
                      <Plus /> Blank row
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const n = carryForward(personId, date, shiftDate(date, isSunday(shiftDate(date, -1)) ? -2 : -1));
                        toast.success(n ? `Carried forward ${n} pending task${n > 1 ? "s" : ""}` : "No pending tasks yesterday — started a blank row");
                      }}
                    >
                      <CopyPlus /> Carry forward pending
                    </Button>
                  </div>
                }
              />
            ) : (
              <div className="pt-3">
                <TaskTable
                  personId={personId}
                  date={date}
                  kind={kind}
                  rows={sheet?.rows ?? []}
                  locked={locked}
                  issueRows={issueRows}
                  placeholder={template.taskPlaceholder}
                />
              </div>
            )}
          </Card>

          {hasRows && template.counters.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Daily counters</CardTitle>
                  <CardDescription>The “Total No. of …” lines from the paper sheet</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <CounterGrid defs={template.counters} values={sheet?.counters ?? {}} locked={locked} onChange={(k, v) => setCounter(personId, date, k, v)} />
                <div>
                  <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">Other works</div>
                  <Textarea
                    disabled={locked}
                    className="min-h-14 text-[13px]"
                    placeholder="Anything else you did today"
                    value={sheet?.otherWorks ?? ""}
                    onChange={(e) => setField(personId, date, { otherWorks: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {hasRows && (
            <Card>
              <CardHeader className="pb-2">
                <div>
                  <CardTitle>{kind === "editor" ? "Delay / Extra Time Reason" : "Reason for the delay"}</CardTitle>
                  <CardDescription>Required when the day is more than 30 min short of, or over, the 8h shift</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  disabled={locked}
                  className="min-h-16 text-[13px]"
                  placeholder="e.g. Stayed back 1h to finish Navaratri revision before client’s 10 AM review"
                  value={sheet?.dayReason ?? ""}
                  onChange={(e) => setField(personId, date, { dayReason: e.target.value })}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {hasRows && !locked && issues.length > 0 && (
            <Card className={cn("border-warning/30 p-4 transition", showIssues && "ring-2 ring-warning/30")}>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-warning">
                  <AlertTriangle className="size-4" /> {issues.length} to fix before submit
                </span>
                <Button size="xs" variant="ghost" onClick={() => setShowIssues((v) => !v)}>
                  {showIssues ? "Hide" : "Highlight"}
                </Button>
              </div>
              <ul className="mt-2 space-y-1 text-[12.5px] text-muted-foreground">
                {issues.slice(0, 5).map((i, k) => (
                  <li key={k} className="flex gap-1.5">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-warning" />
                    {i.text}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {hasRows && <DaySummary sheet={sheet} />}
          {hasRows && (
            <SignoffRail personId={personId} date={date} sheet={sheet} template={template} issues={issues} onShowIssues={() => setShowIssues(true)} />
          )}
        </div>
      </div>

      <PaperView open={paper} onOpenChange={setPaper} personId={personId} date={date} sheet={sheet} template={template} />
    </div>
  );
}

function StatusDot({ status }: { status: ReturnType<typeof statusOf> }) {
  const cls =
    status === "Submitted"
      ? "bg-success"
      : status === "Late"
        ? "bg-danger"
        : status === "Pending"
          ? "bg-warning"
          : status === "Missed"
            ? "bg-danger"
            : "bg-muted-foreground/50";
  return <span className={cn("size-1.5 rounded-full", cls)} title={status} />;
}

function EmptyState({
  icon: I,
  title,
  text,
  action,
  tone,
}: {
  icon: typeof Sun;
  title: string;
  text: string;
  action?: React.ReactNode;
  tone: "warning" | "info" | "neutral" | "accent";
}) {
  const t = { warning: "bg-warning-soft text-warning", info: "bg-info-soft text-info", neutral: "bg-muted text-muted-foreground", accent: "bg-accent-soft text-accent" }[tone];
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className={cn("inline-flex size-12 items-center justify-center rounded-2xl", t)}>
        <I className="size-6" />
      </span>
      <div className="mt-3 text-[15px] font-semibold">{title}</div>
      <p className="mt-1 max-w-md text-[13px] text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
