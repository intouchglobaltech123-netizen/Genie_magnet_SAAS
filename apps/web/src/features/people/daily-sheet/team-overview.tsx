"use client";

import { AlertOctagon, BellRing, CheckCircle2, Clock4, ExternalLink, FileWarning, Hourglass, Timer } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { StatCard } from "@/components/shared/stat-card";
import { TODAY, employees, personById } from "@/lib/mock/core";
import { attendanceMonth, holidayByDate } from "@/lib/mock/people";
import { cn, hoursLabel } from "@/lib/utils";
import { useDaily } from "../daily-store";
import { CUTOFF, sheetPeople } from "./config";
import { statusOf, summarise, type SubmissionStatus } from "./compute";
import { sheetKey } from "./seed";
import { StatusBadge } from "./status-badge";
import { clock12, dayLabel, isSunday, shiftDate, stampLabel } from "./time";

interface Row {
  personId: string;
  status: SubmissionStatus;
  minutes: number;
  errors: number;
  completed: number;
  pending: number;
  submittedAt?: string;
  gm: boolean;
  hr: boolean;
  live: boolean;
  note?: string;
}

/** Static data for team members whose sheets are not part of the live demo. */
const staticToday: Record<string, Omit<Row, "personId" | "live">> = {
  "p-ashwin": { status: "Submitted", minutes: 490, errors: 0, completed: 7, pending: 1, submittedAt: "2026-09-25T18:30:00", gm: true, hr: false },
  "p-priya": { status: "Submitted", minutes: 465, errors: 0, completed: 5, pending: 2, submittedAt: "2026-09-25T18:41:00", gm: true, hr: false },
  "p-karthik": { status: "Submitted", minutes: 500, errors: 1, completed: 6, pending: 0, submittedAt: "2026-09-25T18:55:00", gm: false, hr: false },
  "p-vignesh": { status: "Submitted", minutes: 605, errors: 0, completed: 3, pending: 0, submittedAt: "2026-09-25T18:50:00", gm: false, hr: false, note: "On shoot · filed from phone" },
  "p-surya": { status: "Late", minutes: 480, errors: 2, completed: 3, pending: 2, submittedAt: "2026-09-25T19:32:00", gm: false, hr: false },
};

const team = employees.filter((e) => e.id !== "p-jana");
const livePeople = new Set(sheetPeople.map((s) => s.personId));

function hash(s: string) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function historicStatus(personId: string, date: string): SubmissionStatus {
  const att = attendanceMonth[personId]?.[date];
  if (holidayByDate(date) || att === "H") return "Holiday";
  if (att === "L") return "On leave";
  if (att === "A") return "Missed";
  if (date > TODAY) return "Upcoming";
  const h = hash(personId + date) % 10;
  if (personId === "p-surya") return h < 5 ? "Late" : "Submitted";
  return h === 0 ? "Late" : "Submitted";
}

const cellTone: Record<SubmissionStatus, string> = {
  Submitted: "bg-success/80",
  Late: "bg-warning/80",
  Pending: "bg-warning/30 ring-1 ring-inset ring-warning/60",
  Missed: "bg-danger/80",
  "On leave": "bg-info/60",
  Holiday: "bg-muted-foreground/25",
  Upcoming: "bg-muted",
};

export function TeamOverview({ date, onOpen }: { date: string; onOpen: (personId: string, date: string) => void }) {
  const sheets = useDaily((s) => s.sheets);

  const rows: Row[] = team.map((p) => {
    if (livePeople.has(p.id)) {
      const sh = sheets[sheetKey(p.id, date)];
      const s = summarise(sh);
      return {
        personId: p.id,
        status: statusOf(p.id, date, sh),
        minutes: s.total,
        errors: s.errors,
        completed: s.completed,
        pending: s.pending,
        submittedAt: sh?.submittedAt,
        gm: !!sh?.gmSignedAt,
        hr: !!sh?.hrSignedAt,
        live: true,
      };
    }
    const st = date === TODAY ? staticToday[p.id] : undefined;
    if (st) return { personId: p.id, live: false, ...st };
    const status = historicStatus(p.id, date);
    const done = status === "Submitted" || status === "Late";
    return {
      personId: p.id,
      live: false,
      status,
      minutes: done ? 450 + (hash(p.id + date) % 70) : 0,
      errors: done ? hash(date + p.id) % 3 === 0 ? 1 : 0 : 0,
      completed: done ? 4 + (hash(p.id) % 3) : 0,
      pending: done ? hash(date) % 2 : 0,
      submittedAt: done ? `${date}T${status === "Late" ? "19:2" : "18:3"}${hash(p.id) % 9}:00` : undefined,
      gm: done && date < TODAY,
      hr: done && date < TODAY,
    };
  });

  const submitted = rows.filter((r) => r.status === "Submitted" || r.status === "Late").length;
  const pending = rows.filter((r) => r.status === "Pending" || r.status === "Missed");
  const late = rows.filter((r) => r.status === "Late").length;
  const expected = rows.filter((r) => !["On leave", "Holiday", "Upcoming"].includes(r.status)).length;
  const working = rows.filter((r) => r.minutes > 0);
  const avg = working.length ? working.reduce((s, r) => s + r.minutes, 0) / working.length : 0;
  const errors = rows.reduce((s, r) => s + r.errors, 0);

  // heatmap: two working weeks ending the Saturday of the selected week
  const d = new Date(`${date}T00:00:00`);
  const sat = shiftDate(date, 6 - d.getDay());
  const days: string[] = [];
  for (let i = 12; i >= 0; i--) {
    const x = shiftDate(sat, -i);
    if (!isSunday(x)) days.push(x);
  }

  const heatStatus = (pid: string, day: string): SubmissionStatus => {
    if (livePeople.has(pid)) {
      const sh = sheets[sheetKey(pid, day)];
      if (sh || day >= "2026-09-21") return statusOf(pid, day, sh);
    }
    if (day === TODAY && staticToday[pid]) return staticToday[pid].status;
    return historicStatus(pid, day);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sheets submitted" value={`${submitted}/${expected}`} icon={CheckCircle2} tone="success" hint={`${dayLabel(date, { day: "numeric", month: "short" })} · cut-off ${clock12(CUTOFF)}`} />
        <StatCard label="Pending / missing" value={pending.length} icon={Hourglass} tone={pending.length ? "warning" : "success"} hint={late ? `${late} submitted late` : "none late"} />
        <StatCard label="Avg hours logged" value={hoursLabel(Math.round(avg))} icon={Timer} tone="accent" hint="vs 8h shift" />
        <StatCard label="Errors reported" value={errors} icon={AlertOctagon} tone={errors ? "danger" : "success"} hint="from role counters" />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Team — {dayLabel(date, { weekday: "long", day: "numeric", month: "short" })}</CardTitle>
            <CardDescription>Every employee’s sheet for the day, with sign-off progress</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!pending.length}
            onClick={() =>
              toast.success(`WhatsApp reminder sent to ${pending.length} ${pending.length === 1 ? "person" : "people"}`, {
                description: pending.map((r) => personById(r.personId).name).join(", "),
              })
            }
          >
            <BellRing /> Remind pending
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => {
              const p = personById(r.personId);
              const pctShift = Math.min(100, (r.minutes / 480) * 100);
              return (
                <div key={r.personId} className="group rounded-xl border border-border bg-card p-4 transition hover:border-primary/30 hover:shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={p.name} />
                      <div className="min-w-0">
                        <div className="truncate text-body font-semibold">{p.name}</div>
                        <div className="truncate text-body text-muted-foreground">{p.role}</div>
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <Metric label="Hours" value={r.minutes ? hoursLabel(r.minutes) : "—"} />
                    <Metric label="Tasks" value={r.completed + r.pending ? `${r.completed}/${r.completed + r.pending}` : "—"} />
                    <Metric label="Errors" value={r.errors} cls={r.errors ? "text-danger" : undefined} />
                  </div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", r.minutes > 480 ? "bg-warning" : "bg-primary")} style={{ width: `${pctShift}%` }} />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-body text-muted-foreground">
                    <span className="flex items-center gap-2">
                      {r.submittedAt ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock4 className="size-3" /> {stampLabel(r.submittedAt).split(" · ")[1]}
                        </span>
                      ) : r.note || !(r.status === "Pending" || r.status === "Missed") ? null : (
                        <span>Not submitted</span>
                      )}
                      <SignPip on={r.gm} label="GM" />
                      <SignPip on={r.hr} label="HR" />
                    </span>
                    {r.live ? (
                      <Button size="xs" variant="ghost" className="h-6 px-2 text-primary" onClick={() => onOpen(r.personId, date)}>
                        Open sheet <ExternalLink className="size-3" />
                      </Button>
                    ) : r.status === "Pending" || r.status === "Missed" ? (
                      <Button size="xs" variant="ghost" className="h-6 px-2" onClick={() => toast.success(`Reminder sent to ${p.name}`)}>
                        <BellRing className="size-3" /> Remind
                      </Button>
                    ) : (
                      r.note && <span className="truncate">{r.note}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Submission heatmap</CardTitle>
            <CardDescription>Last two working weeks · click a cell to open that sheet</CardDescription>
          </div>
          <div className="hidden flex-wrap items-center gap-3 text-body text-muted-foreground md:flex">
            {(["Submitted", "Late", "Pending", "Missed", "On leave", "Holiday"] as SubmissionStatus[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={cn("size-3 rounded-[4px]", cellTone[s])} /> {s}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[720px] border-separate border-spacing-1 text-body">
              <thead>
                <tr>
                  <th className="w-44" />
                  {days.map((dd) => (
                    <th key={dd} className={cn("pb-1 text-center font-medium text-muted-foreground", dd === date && "text-primary")}>
                      <div className="text-body uppercase">{dayLabel(dd, { weekday: "short" })}</div>
                      <div className="tabular">{Number(dd.slice(8))}</div>
                    </th>
                  ))}
                  <th className="pl-2 text-right text-body font-medium text-muted-foreground">On-time</th>
                </tr>
              </thead>
              <tbody>
                {team.map((p) => {
                  const sts = days.map((dd) => heatStatus(p.id, dd));
                  const counted = sts.filter((s) => ["Submitted", "Late", "Missed"].includes(s));
                  const onTime = counted.length ? counted.filter((s) => s === "Submitted").length / counted.length : 1;
                  return (
                    <tr key={p.id}>
                      <td className="pr-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={p.name} size="xs" />
                          <span className="truncate font-medium">{p.name}</span>
                        </div>
                      </td>
                      {days.map((dd, i) => {
                        const s = sts[i]!;
                        const clickable = livePeople.has(p.id) && dd <= TODAY;
                        return (
                          <td key={dd} className="p-0">
                            <Tooltip content={`${p.name.split(" ")[0]} · ${dayLabel(dd, { day: "numeric", month: "short" })} · ${s}`}>
                              <button
                                onClick={() => clickable ? onOpen(p.id, dd) : toast(`${p.name} — ${s}`, { description: "Historical sheet (read-only in demo)" })}
                                className={cn(
                                  "h-7 w-full min-w-7 cursor-pointer rounded-[6px] transition hover:scale-110 hover:shadow-sm",
                                  cellTone[s],
                                  dd === date && "outline-2 outline-offset-1 outline-primary",
                                )}
                              />
                            </Tooltip>
                          </td>
                        );
                      })}
                      <td className="pl-2 text-right font-semibold tabular">
                        <span className={cn(onTime < 0.7 ? "text-danger" : onTime < 0.9 ? "text-warning" : "text-success")}>{Math.round(onTime * 100)}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-body text-muted-foreground">
            <FileWarning className="size-3.5 shrink-0" />
            Repeated late or missed sheets flow into the monthly KRA as a discipline parameter — see Performance & KRA.
            <Badge tone="outline" className="ml-auto">
              Cut-off {clock12(CUTOFF)}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, cls }: { label: string; value: React.ReactNode; cls?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 py-1.5">
      <div className={cn("text-body font-semibold tabular", cls)}>{value}</div>
      <div className="text-body text-muted-foreground">{label}</div>
    </div>
  );
}

function SignPip({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={cn("rounded px-1 text-body font-semibold", on ? "bg-success-soft text-success" : "bg-muted text-muted-foreground/70")}>
      {label}
      {on ? " ✓" : ""}
    </span>
  );
}
