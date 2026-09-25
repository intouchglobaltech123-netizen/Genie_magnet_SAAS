"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { AlertTriangle, Check, CheckCheck, Clock, Film, Hourglass, Plus, TrendingUp, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/select";
import { Field, Input } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatCard } from "@/components/shared/stat-card";
import { personById, TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";
import { tooltipStyle } from "@/features/overview/chart-style";
import { CATEGORIES, catMeta, seedEntries, TIME_PEOPLE, VIDEO_CODES, WEEK, type Category, type EntryStatus, type TimeEntry } from "./data";

const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
const h = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(2).replace(/0$/, ""));

const statusTone: Record<EntryStatus, "neutral" | "info" | "success" | "danger"> = {
  Draft: "neutral",
  Submitted: "info",
  Approved: "success",
  Rejected: "danger",
};

function LogTimeDialog({ open, onOpenChange, defaultPerson, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; defaultPerson: string; onAdd: (e: TimeEntry) => void }) {
  const [personId, setPersonId] = useState(defaultPerson === "all" ? "p-surya" : defaultPerson);
  const [date, setDate] = useState(TODAY);
  const [category, setCategory] = useState<Category>("Production");
  const [hours, setHours] = useState("2");
  const [video, setVideo] = useState("none");
  const [note, setNote] = useState("");
  const hrs = Number(hours);
  const valid = hrs > 0 && hrs <= 14 && note.trim().length > 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log time</DialogTitle>
          <DialogDescription>Entries are submitted to Ashwin for approval and costed against the video&apos;s budget.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Person">
              <Select value={personId} onValueChange={setPersonId} options={TIME_PEOPLE.map((id) => ({ value: id, label: personById(id).name }))} />
            </Field>
            <Field label="Date">
              <Select value={date} onValueChange={setDate} options={WEEK.map((d) => ({ value: d, label: dayLabel(d) + " Sep" }))} />
            </Field>
            <Field label="Category">
              <Select value={category} onValueChange={(v) => setCategory(v as Category)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
            </Field>
            <Field label="Hours">
              <Input type="number" step="0.25" min="0.25" max="14" value={hours} onChange={(e) => setHours(e.target.value)} />
            </Field>
          </div>
          <Field label="Video" hint="Link production, revision and client-waiting time to a video code.">
            <Select value={video} onValueChange={setVideo} options={[{ value: "none", label: "Not linked to a video" }, ...VIDEO_CODES.map((c) => ({ value: c, label: c }))]} />
          </Field>
          <Field label="What did you work on?">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Diwali hamper ad — BGM and final spelling pass" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={!valid}
            onClick={() => {
              onAdd({ id: `te-new-${Date.now()}`, personId, date, category, hours: hrs, videoCode: video === "none" ? undefined : video, note: note.trim(), status: "Submitted" });
              toast.success(`Logged ${h(hrs)}h · ${category}`, { description: `${personById(personId).name}${video !== "none" ? ` · ${video}` : ""} — submitted for approval` });
              useDemo.getState().log(`${personById(personId).name} logged ${h(hrs)}h ${category.toLowerCase()}${video !== "none" ? ` on ${video}` : ""}`, "accent");
              setNote("");
              onOpenChange(false);
            }}
          >
            Log time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TimeView() {
  const [entries, setEntries] = useState<TimeEntry[]>(seedEntries);
  const [person, setPerson] = useState("all");
  const [status, setStatus] = useState<"all" | EntryStatus>("all");
  const [day, setDay] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const scoped = useMemo(() => entries.filter((e) => person === "all" || e.personId === person), [entries, person]);
  const total = scoped.reduce((s, e) => s + e.hours, 0);
  const productive = scoped.filter((e) => catMeta[e.category].productive).reduce((s, e) => s + e.hours, 0);
  const submitted = entries.filter((e) => e.status === "Submitted");
  const donut = CATEGORIES.map((c) => ({ name: c, value: scoped.filter((e) => e.category === c).reduce((s, e) => s + e.hours, 0) })).filter((d) => d.value > 0);
  const personWeek = (id: string) => entries.filter((e) => e.personId === id).reduce((s, e) => s + e.hours, 0);
  const over40 = TIME_PEOPLE.filter((id) => personWeek(id) > 40);

  const setStatusFor = (ids: string[], s: EntryStatus) => setEntries((es) => es.map((e) => (ids.includes(e.id) ? { ...e, status: s } : e)));

  const decide = (e: TimeEntry, s: "Approved" | "Rejected") => {
    setStatusFor([e.id], s);
    const who = personById(e.personId).name;
    if (s === "Approved") toast.success(`Approved ${h(e.hours)}h for ${who.split(" ")[0]}`, { description: `${e.category}${e.videoCode ? ` · ${e.videoCode}` : ""}` });
    else toast(`Rejected ${h(e.hours)}h for ${who.split(" ")[0]}`, { description: "Sent back with a note to re-classify." });
  };

  const approveAll = () => {
    const ids = submitted.map((e) => e.id);
    const hrs = submitted.reduce((s, e) => s + e.hours, 0);
    setStatusFor(ids, "Approved");
    toast.success(`Approved ${ids.length} entries · ${h(hrs)}h`, { description: "Costs posted to video budgets and payroll." });
    useDemo.getState().log(`Timesheets: ${ids.length} submitted entries approved (${h(hrs)}h, week of 21 Sep)`, "success");
  };

  const list = scoped
    .filter((e) => status === "all" || e.status === status)
    .filter((e) => !day || e.date === day)
    .sort((a, b) => b.date.localeCompare(a.date) || a.personId.localeCompare(b.personId));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="h-9 w-56"
            value={person}
            onValueChange={(v) => {
              setPerson(v);
              setDay(null);
            }}
            options={[{ value: "all", label: "Everyone (8 people)" }, ...TIME_PEOPLE.map((id) => ({ value: id, label: personById(id).name }))]}
          />
          <Badge tone="outline" className="h-9 px-3 text-body">
            Week 39 · 21 – 27 Sep 2026
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={approveAll} disabled={!submitted.length}>
            <CheckCheck /> Approve all submitted
            {submitted.length > 0 && <span className="tabular rounded-full bg-info-soft px-1.5 text-body text-info">{submitted.length}</span>}
          </Button>
          <Button variant="accent" onClick={() => setLogOpen(true)}>
            <Plus /> Log time
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Hours logged" value={`${h(total)}h`} icon={Clock} tone="accent" hint={person === "all" ? "8 people · Mon–Fri" : personById(person).name} />
        <StatCard label="Productive" value={`${total ? Math.round((productive / total) * 100) : 0}%`} icon={TrendingUp} tone="success" hint={`${h(productive)}h production + revision`} />
        <StatCard label="Awaiting approval" value={submitted.length} icon={Hourglass} tone="info" hint={`${h(submitted.reduce((s, e) => s + e.hours, 0))}h submitted`} />
        <StatCard label="Over 40h" value={over40.length} icon={AlertTriangle} tone="danger" hint={over40.map((id) => personById(id).name.split(" ")[0]).join(", ") || "nobody"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Weekly timesheet</CardTitle>
              <CardDescription>Click a cell to see that day&apos;s entries. Weekly totals over 40h are flagged.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-3">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[720px] text-body">
                <thead>
                  <tr className="border-b border-border">
                    <th className="h-10 pl-5 text-left text-body font-medium uppercase tracking-wider text-muted-foreground">Person</th>
                    {WEEK.map((d) => (
                      <th key={d} className={cn("text-center text-body font-medium uppercase tracking-wider text-muted-foreground", d === TODAY && "text-primary", d > TODAY && "opacity-50")}>
                        {dayLabel(d)}
                      </th>
                    ))}
                    <th className="pr-5 text-right text-body font-medium uppercase tracking-wider text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {TIME_PEOPLE.map((id) => {
                    const p = personById(id);
                    const wk = personWeek(id);
                    const dim = person !== "all" && person !== id;
                    return (
                      <tr key={id} className={cn("border-b border-border last:border-0", dim && "opacity-40")}>
                        <td className="py-2 pl-5">
                          <button className="flex cursor-pointer items-center gap-2 text-left" onClick={() => setPerson(person === id ? "all" : id)}>
                            <Avatar name={p.name} size="sm" />
                            <span className="font-medium">{p.name}</span>
                          </button>
                        </td>
                        {WEEK.map((d) => {
                          const v = entries.filter((e) => e.personId === id && e.date === d).reduce((s, e) => s + e.hours, 0);
                          const active = day === d && person === id;
                          return (
                            <td key={d} className="px-1 py-1.5 text-center">
                              <button
                                disabled={!v}
                                onClick={() => {
                                  setPerson(id);
                                  setDay(active ? null : d);
                                }}
                                className={cn(
                                  "tabular h-8 w-full min-w-12 rounded-md text-body transition enabled:cursor-pointer enabled:hover:ring-2 enabled:hover:ring-primary/30",
                                  !v ? "text-muted-foreground/50" : v > 9.5 ? "bg-warning-soft font-medium text-warning" : "bg-muted/70",
                                  d === TODAY && v > 0 && v <= 9.5 && "bg-primary-soft",
                                  active && "ring-2 ring-primary",
                                )}
                              >
                                {v ? h(v) : "—"}
                              </button>
                            </td>
                          );
                        })}
                        <td className="pr-5 text-right">
                          <span className={cn("tabular inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold", wk > 40 && "bg-danger-soft text-danger")}>
                            {wk > 40 && <AlertTriangle className="size-3.5" />}
                            {h(wk)}h
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-border bg-muted/40">
                    <td className="py-2 pl-5 text-body font-medium uppercase tracking-wider text-muted-foreground">Team</td>
                    {WEEK.map((d) => {
                      const v = entries.filter((e) => e.date === d).reduce((s, e) => s + e.hours, 0);
                      return (
                        <td key={d} className="tabular text-center font-semibold">
                          {v ? h(v) : "—"}
                        </td>
                      );
                    })}
                    <td className="tabular pr-5 text-right font-semibold">{h(entries.reduce((s, e) => s + e.hours, 0))}h</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Where the time went</CardTitle>
              <CardDescription>{person === "all" ? "Whole team" : personById(person).name} · this week</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="var(--color-card)" strokeWidth={2}>
                    {donut.map((d) => (
                      <Cell key={d.name} fill={catMeta[d.name as Category].color} />
                    ))}
                  </Pie>
                  <RTooltip {...tooltipStyle} formatter={(v) => [`${h(Number(v))}h`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="tabular text-heading font-semibold">{h(total)}h</span>
                <span className="text-body text-muted-foreground">logged</span>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5">
              {donut.map((d) => (
                <li key={d.name} className="flex items-center gap-2 text-body">
                  <span className="size-2.5 rounded-sm" style={{ background: catMeta[d.name as Category].color }} />
                  <span className="flex-1">{d.name}</span>
                  <span className="tabular text-muted-foreground">{h(d.value)}h</span>
                  <span className="tabular w-10 text-right font-medium">{Math.round((d.value / total) * 100)}%</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-border pt-4">
              <div className="mb-1.5 flex justify-between text-body">
                <span className="font-medium text-success">Productive {h(productive)}h</span>
                <span className="text-muted-foreground">Non-productive {h(total - productive)}h</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                <div className="bg-success transition-all duration-500" style={{ width: `${total ? (productive / total) * 100 : 0}%` }} />
              </div>
              <p className="mt-2 text-body text-muted-foreground">Target: 70% productive for editors, 50% for leads.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle>Entries</CardTitle>
            <CardDescription>
              {list.length} entries{day ? ` on ${dayLabel(day)} Sep` : ""}
              {day && (
                <button className="ml-2 cursor-pointer text-primary hover:underline" onClick={() => setDay(null)}>
                  Clear day
                </button>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-body">
            {(["all", "Draft", "Submitted", "Approved", "Rejected"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn("cursor-pointer rounded-md px-2.5 py-1 font-medium text-muted-foreground", status === s && "bg-card text-foreground shadow-sm")}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <div className="max-h-[520px] overflow-auto scrollbar-thin">
            <table className="w-full min-w-[860px] text-body">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border">
                  {["Date", "Person", "Category", "Video", "Description", "Hours", "Status", ""].map((c, i) => (
                    <th key={i} className={cn("h-10 px-3 text-left text-body font-medium uppercase tracking-wider text-muted-foreground", i === 0 && "pl-5", c === "Hours" && "text-right", i === 7 && "pr-5")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((e) => {
                  const p = personById(e.personId);
                  return (
                    <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="tabular whitespace-nowrap py-2.5 pl-5 pr-3 text-muted-foreground">{dayLabel(e.date)}</td>
                      <td className="px-3">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Avatar name={p.name} size="xs" />
                          {p.name.split(" ")[0]}
                        </div>
                      </td>
                      <td className="px-3">
                        <Badge tone={catMeta[e.category].tone}>{e.category}</Badge>
                      </td>
                      <td className="px-3">
                        {e.videoCode ? (
                          <span className="tabular inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border px-1.5 py-0.5 font-mono text-body">
                            <Film className="size-3 text-muted-foreground" />
                            {e.videoCode}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="max-w-[320px] truncate px-3 text-muted-foreground" title={e.note}>
                        {e.note}
                      </td>
                      <td className="tabular px-3 text-right font-medium">{h(e.hours)}h</td>
                      <td className="px-3">
                        <Badge tone={statusTone[e.status]} dot>
                          {e.status}
                        </Badge>
                      </td>
                      <td className="pr-5 text-right">
                        {e.status === "Submitted" ? (
                          <div className="flex justify-end gap-1">
                            <Button size="xs" variant="ghost" className="text-danger" onClick={() => decide(e, "Rejected")}>
                              <X className="size-3.5" /> Reject
                            </Button>
                            <Button size="xs" variant="soft" onClick={() => decide(e, "Approved")}>
                              <Check className="size-3.5" /> Approve
                            </Button>
                          </div>
                        ) : e.status === "Draft" ? (
                          <span className="text-body text-muted-foreground">Not submitted</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {!list.length && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-muted-foreground">
                      No entries match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <LogTimeDialog
        key={person}
        open={logOpen}
        onOpenChange={setLogOpen}
        defaultPerson={person}
        onAdd={(e) => setEntries((es) => [e, ...es])}
      />
    </div>
  );
}
