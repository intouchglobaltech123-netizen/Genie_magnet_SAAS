"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, Clock, PenLine, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { clientById, personById, TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { EDIT_STEPS, type Video } from "@/lib/types";
import { cn, hoursLabel } from "@/lib/utils";
import { doneSteps, fmt } from "../lib";
import { defaultSignatures, defaultTimeLogs, minutesBetween, useProduction } from "../store";

export function EditingTab({ v }: { v: Video }) {
  const toggleEditStep = useDemo((s) => s.toggleEditStep);
  const updateVideo = useDemo((s) => s.updateVideo);
  const log = useDemo((s) => s.log);
  const storedLogs = useProduction((s) => s.timeLogs[v.id]);
  const addTimeLog = useProduction((s) => s.addTimeLog);
  const storedSigs = useProduction((s) => s.signatures[v.id]);
  const signVideo = useProduction((s) => s.signVideo);

  const baseLogs = useMemo(() => defaultTimeLogs(v), [v]);
  const logs = storedLogs ?? baseLogs;
  const sigs = storedSigs ?? defaultSignatures(v);
  const editor = personById(v.editorId);
  const steps = doneSteps(v);
  const complete = steps === EDIT_STEPS.length;
  const over = v.loggedMinutes > v.plannedMinutes;

  const [delay, setDelay] = useState(v.delayReason ?? "");
  const [row, setRow] = useState({ date: TODAY, start: "10:00", end: "12:30", note: "" });

  const toggle = (s: (typeof EDIT_STEPS)[number]) => {
    const willBeDone = !v.editSteps[s];
    toggleEditStep(v.id, s);
    if (willBeDone && steps + 1 === EDIT_STEPS.length) {
      log(`${editor.name} completed all 9 edit steps on ${v.code}`, "success");
      toast.success("All 9 steps complete", { description: "Editing sheet is ready — sign it and advance to Internal QC." });
    } else if (willBeDone) {
      log(`${editor.name} completed ${s} on ${v.code}`, "success");
    }
  };

  const addRow = () => {
    const mins = minutesBetween(row.start, row.end);
    if (!mins) {
      toast.error("End time must be after start time");
      return;
    }
    addTimeLog(v.id, baseLogs, { ...row, note: row.note || "Editing session" });
    updateVideo(v.id, { loggedMinutes: v.loggedMinutes + mins });
    toast.success(`Logged ${hoursLabel(mins)} on ${v.code}`);
    setRow((r) => ({ ...r, note: "" }));
  };

  const sign = (who: "editor" | "hr" | "gm") => {
    const by = who === "editor" ? editor.name : who === "hr" ? "Harini Selvam" : "Ashwin";
    signVideo(v.id, who, { by, at: new Date().toISOString() });
    log(`${by} signed the editing data sheet for ${v.code} (${who.toUpperCase()})`, "success");
    toast.success(`Signed by ${by}`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Video Editing Data Sheet</CardTitle>
            <CardDescription>The nine-step edit checklist, in the same order as the paper form.</CardDescription>
          </div>
          <Badge tone={complete ? "success" : "warning"} dot>
            {complete ? "Completed" : "Pending"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border text-body sm:grid-cols-4">
            {[
              ["Video ID", <span key="c" className="font-mono">{v.code}</span>],
              ["Client", clientById(v.clientId).name],
              ["Start", logs[0] ? `${fmt(logs[0].date)} · ${logs[0].start}` : "—"],
              ["End", logs.at(-1) && complete ? `${fmt(logs.at(-1)!.date)} · ${logs.at(-1)!.end}` : "—"],
            ].map(([k, val]) => (
              <div key={k as string} className="bg-card px-3 py-2">
                <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">{k}</div>
                <div className="mt-0.5 truncate font-medium">{val}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {EDIT_STEPS.map((s, i) => {
              const on = v.editSteps[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  aria-pressed={on}
                  className={cn(
                    "group flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                    on ? "border-primary/40 bg-primary-soft/60" : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-body font-semibold tabular transition",
                      on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-text-primary",
                    )}
                  >
                    {on ? <Check className="size-4" strokeWidth={3} /> : String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div className={cn("text-body font-medium", on && "text-primary")}>{s}</div>
                    <div className="text-body text-muted-foreground">{on ? "Done" : "Tap to mark done"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Time log</CardTitle>
            <CardDescription>Start / End / Total time per editing session</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-heading font-semibold tabular tracking-tight">{hoursLabel(v.loggedMinutes)}</div>
            <div className="text-body text-muted-foreground">of {hoursLabel(v.plannedMinutes)} planned</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="relative h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full transition-all", over ? "bg-danger" : "bg-primary")}
                style={{ width: `${Math.min(100, (v.loggedMinutes / Math.max(v.plannedMinutes, v.loggedMinutes)) * 100)}%` }}
              />
              {over && <div className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(v.plannedMinutes / v.loggedMinutes) * 100}%` }} />}
            </div>
            <div className="mt-1.5 flex justify-between text-body text-muted-foreground">
              <span>Logged {hoursLabel(v.loggedMinutes)}</span>
              <span className={cn(over && "font-medium text-danger")}>
                {over ? `+${hoursLabel(v.loggedMinutes - v.plannedMinutes)} over plan — reason required` : `${hoursLabel(v.plannedMinutes - v.loggedMinutes)} remaining`}
              </span>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Start</TH>
                  <TH>End</TH>
                  <TH numeric>Total</TH>
                  <TH>Work done</TH>
                </TR>
              </THead>
              <TBody>
                {logs.map((l) => (
                  <TR key={l.id}>
                    <TD className="tabular">{fmt(l.date, "EEE, d MMM")}</TD>
                    <TD className="font-mono text-body">{l.start}</TD>
                    <TD className="font-mono text-body">{l.end}</TD>
                    <TD numeric className="font-medium">{hoursLabel(minutesBetween(l.start, l.end))}</TD>
                    <TD className="text-muted-foreground">{l.note}</TD>
                  </TR>
                ))}
                {!logs.length && (
                  <TR>
                    <TD colSpan={5} className="py-4">
                      <EmptyState compact icon={Clock} title="No sessions logged yet" description="Add the first editing session in the row below." />
                    </TD>
                  </TR>
                )}
                <TR className="bg-muted/40 hover:bg-muted/40">
                  <TD>
                    <Input type="date" value={row.date} onChange={(e) => setRow({ ...row, date: e.target.value })} className="h-8 w-36 text-body" />
                  </TD>
                  <TD>
                    <Input type="time" value={row.start} onChange={(e) => setRow({ ...row, start: e.target.value })} className="h-8 w-24 text-body" />
                  </TD>
                  <TD>
                    <Input type="time" value={row.end} onChange={(e) => setRow({ ...row, end: e.target.value })} className="h-8 w-24 text-body" />
                  </TD>
                  <TD numeric className="text-muted-foreground">{hoursLabel(minutesBetween(row.start, row.end))}</TD>
                  <TD>
                    <div className="flex min-w-56 gap-2">
                      <Input value={row.note} onChange={(e) => setRow({ ...row, note: e.target.value })} placeholder="What was done?" className="h-8 text-body" />
                      <Button size="sm" variant="outline" onClick={addRow}>
                        <Plus /> Log
                      </Button>
                    </div>
                  </TD>
                </TR>
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Delay / extra time reason</CardTitle>
              <CardDescription>Required when logged time exceeds plan or the due date slips.</CardDescription>
            </div>
            {over && !v.delayReason && <Badge tone="danger">Required</Badge>}
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea value={delay} onChange={(e) => setDelay(e.target.value)} placeholder="e.g. Client changed product line-up after shoot; 2 pickup shots needed" rows={3} />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={delay === (v.delayReason ?? "")}
                onClick={() => {
                  updateVideo(v.id, { delayReason: delay || undefined });
                  log(`Delay reason updated on ${v.code}`, "warning");
                  toast.success("Reason saved to the data sheet");
                }}
              >
                <Save /> Save reason
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sign-off</CardTitle>
              <CardDescription>Editor signs when all steps are done; HR & GM countersign.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  ["editor", "Editor", editor.name, complete, "Complete all 9 steps first"],
                  ["hr", "HR", "Harini Selvam", !!sigs.editor, "Editor must sign first"],
                  ["gm", "GM", "Ashwin", !!sigs.editor, "Editor must sign first"],
                ] as const
              ).map(([key, label, who, enabled, why]) => {
                const s = sigs[key];
                return (
                  <div key={key} className={cn("rounded-xl border p-3", s ? "border-success/30 bg-success-soft/50" : "border-dashed border-border")}>
                    <div className="text-body font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
                    {s ? (
                      <>
                        <div className="mt-1.5 font-[cursive] text-subheading italic leading-none text-text-primary">{s.by === "Editor" ? who : s.by}</div>
                        <div className="mt-1.5 inline-flex items-center gap-1 text-body text-success">
                          <Check className="size-3" /> {format(parseISO(s.at), "d MMM · HH:mm")}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mt-1.5 truncate text-body text-muted-foreground">{who}</div>
                        <Button size="xs" variant={enabled ? "soft" : "outline"} className="mt-2 w-full" disabled={!enabled} onClick={() => sign(key)} title={enabled ? undefined : why}>
                          <PenLine /> Sign
                        </Button>
                        {!enabled && <div className="mt-1 text-body text-muted-foreground">{why}</div>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-body text-muted-foreground">
              <Clock className="size-3" /> Signatures are time-stamped and appear in the audit log.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
