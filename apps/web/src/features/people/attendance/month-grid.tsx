"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { employees, TODAY } from "@/lib/mock/core";
import { attendanceMonth, holidayByDate, sepDays, type AttendanceCode, type LeaveRequest } from "@/lib/mock/people";
import { cn } from "@/lib/utils";
import { codeMeta } from "./data";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function MonthGrid({ requests }: { requests: LeaveRequest[] }) {
  // Overlay approved leave from the leave module onto the biometric grid.
  const grid: Record<string, Record<string, AttendanceCode | null>> = {};
  for (const e of employees) {
    const row = { ...attendanceMonth[e.id] };
    for (const r of requests.filter((x) => x.personId === e.id && x.status === "approved")) {
      for (const d of sepDays) if (d >= r.from && d <= r.to && row[d] !== "WO" && row[d] !== "H") row[d] = "L";
    }
    grid[e.id] = row;
  }

  return (
    <Card>
      <CardHeader className="flex-col gap-3 lg:flex-row lg:items-center">
        <div>
          <CardTitle>September 2026 · attendance register</CardTitle>
          <CardDescription>Biometric punches + approved leave. Future days stay blank until punched.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(codeMeta) as AttendanceCode[]).map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 text-body text-muted-foreground">
              <span className={cn("inline-flex h-6 min-w-7 items-center justify-center rounded-md px-1 text-body font-semibold leading-4", codeMeta[c].cls)}>{c}</span>
              {codeMeta[c].label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-max min-w-full border-separate border-spacing-0 text-body">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[180px] bg-card px-5 py-2 text-left text-body font-medium uppercase tracking-wider text-muted-foreground">Employee</th>
                {sepDays.map((d) => {
                  const dt = new Date(`${d}T00:00:00`);
                  const wk = dt.getDay() === 0 || dt.getDay() === 6;
                  const isToday = d === TODAY;
                  return (
                    <th key={d} className={cn("min-w-9 px-0.5 py-1 text-center font-medium leading-4", wk && "bg-muted/60", isToday && "rounded-t-md outline-2 -outline-offset-2 outline-primary")}>
                      <div className="text-body text-muted-foreground">{DOW[dt.getDay()]}</div>
                      <div className={cn("tabular", isToday ? "text-primary" : "text-foreground")}>{dt.getDate()}</div>
                    </th>
                  );
                })}
                <th className="px-2 text-center text-body font-medium uppercase tracking-wider text-muted-foreground">P</th>
                <th className="px-2 text-center text-body font-medium uppercase tracking-wider text-muted-foreground">L</th>
                <th className="px-2 text-center text-body font-medium uppercase tracking-wider text-muted-foreground">A</th>
                <th className="px-3 pr-5 text-center text-body font-medium uppercase tracking-wider text-muted-foreground">LOP</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const row = grid[e.id]!;
                const vals = Object.values(row);
                const p = vals.filter((v) => v === "P").length + vals.filter((v) => v === "HD").length * 0.5;
                const l = vals.filter((v) => v === "L").length;
                const a = vals.filter((v) => v === "A").length;
                const lop = a + vals.filter((v) => v === "HD").length * 0.5;
                return (
                  <tr key={e.id} className="group">
                    <td className="sticky left-0 z-10 border-t border-border bg-card px-5 py-1.5 group-hover:bg-muted">
                      <div className="flex items-center gap-2">
                        <Avatar name={e.name} size="sm" />
                        <span className="truncate font-medium">{e.name}</span>
                      </div>
                    </td>
                    {sepDays.map((d) => {
                      const c = row[d];
                      const dt = new Date(`${d}T00:00:00`);
                      const wk = dt.getDay() === 0 || dt.getDay() === 6;
                      const isToday = d === TODAY;
                      const hol = holidayByDate(d);
                      const tip = c ? `${dt.getDate()} Sep · ${codeMeta[c].label}${hol ? ` — ${hol.name}` : ""}` : `${dt.getDate()} Sep · upcoming`;
                      return (
                        <td key={d} className={cn("border-t border-border px-0.5 py-1 text-center", wk && "bg-muted/60", isToday && "outline-2 -outline-offset-2 outline-primary")}>
                          <Tooltip content={tip}>
                            <span
                              className={cn(
                                "inline-flex h-6 w-8 cursor-default items-center justify-center rounded-md text-body font-semibold leading-4",
                                c ? codeMeta[c].cls : "border border-dashed border-border text-transparent",
                              )}
                            >
                              {c ?? "·"}
                            </span>
                          </Tooltip>
                        </td>
                      );
                    })}
                    <td className="tabular border-t border-border px-2 text-center font-medium">{p}</td>
                    <td className="tabular border-t border-border px-2 text-center">{l}</td>
                    <td className={cn("tabular border-t border-border px-2 text-center", a > 0 && "text-danger font-medium")}>{a}</td>
                    <td className={cn("tabular border-t border-border px-3 pr-5 text-center", lop > 0 ? "font-semibold text-danger" : "text-muted-foreground")}>{lop}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-5 pt-3 text-body text-muted-foreground">
          LOP = unapproved absence (1 day) + half-day (0.5). These figures flow straight into September payroll.
        </p>
      </CardContent>
    </Card>
  );
}
