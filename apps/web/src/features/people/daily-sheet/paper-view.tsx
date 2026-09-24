"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clientById, personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { EDIT_STEPS } from "@/lib/types";
import { hoursLabel } from "@/lib/utils";
import { GM_NAME, HR_NAME, type SheetTemplate } from "./config";
import type { DaySheet } from "./seed";
import { dayLabel, spanMinutes, stampLabel } from "./time";

export function PaperView({
  open,
  onOpenChange,
  personId,
  date,
  sheet,
  template,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
  date: string;
  sheet: DaySheet | undefined;
  template: SheetTemplate;
}) {
  const videos = useDemo((s) => s.videos);
  const person = personById(personId);
  const isEditor = template.kind === "editor";
  const rows = sheet?.rows ?? [];
  const sigFor = (label: string) => {
    if (label === "GM") return { name: GM_NAME, at: sheet?.gmSignedAt };
    if (label === "HR" && template.kind !== "hr") return { name: HR_NAME, at: sheet?.hrSignedAt };
    if (label === "HR") return { name: HR_NAME, at: sheet?.hrSignedAt ?? sheet?.submittedAt };
    return { name: person.name, at: sheet?.submittedAt };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Paper view</DialogTitle>
          <DialogDescription>The same sheet in the familiar paper layout — printable for the physical file if ever needed.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="rounded-lg border border-border bg-card p-6 text-foreground shadow-card">
            <div className="flex items-start justify-between border-b-2 border-foreground/80 pb-3">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">GENIE MAGNET</div>
                <div className="text-[18px] font-bold uppercase tracking-wide">{template.title}</div>
              </div>
              <div className="text-right text-[12px] leading-5">
                <div>
                  Name: <span className="font-serif text-[14px] italic">{person.name}</span>
                </div>
                <div>
                  Date: <span className="font-serif text-[14px] italic">{dayLabel(date, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                </div>
              </div>
            </div>

            <table className="mt-4 w-full border-collapse text-[12px]">
              <thead>
                <tr className="[&>th]:border [&>th]:border-foreground/40 [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-semibold">
                  <th className="w-10">S.No</th>
                  {isEditor ? (
                    <>
                      <th>Video ID</th>
                      <th>Start</th>
                      <th>Duration</th>
                      <th>End</th>
                      <th>Total Time</th>
                      <th>Status</th>
                      <th>Client</th>
                    </>
                  ) : (
                    <>
                      <th>Task</th>
                      <th>Details</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Total Time</th>
                      <th>Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="font-serif italic">
                {rows.map((r, i) => {
                  const v = r.videoId ? videos.find((x) => x.id === r.videoId) : undefined;
                  const m = spanMinutes(r.start, r.end);
                  return (
                    <tr key={r.id} className="[&>td]:border [&>td]:border-foreground/30 [&>td]:px-2 [&>td]:py-1.5">
                      <td className="not-italic font-sans">{i + 1}</td>
                      {isEditor ? (
                        <>
                          <td>
                            {v?.code ?? r.task}
                            {v && (
                              <div className="mt-0.5 flex flex-wrap gap-x-2 font-sans text-[10px] not-italic text-muted-foreground">
                                {EDIT_STEPS.map((s) => (
                                  <span key={s}>
                                    {v.editSteps[s] ? "☑" : "☐"} {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td>{r.start}</td>
                          <td>{r.duration}</td>
                          <td>{r.end}</td>
                          <td>{m !== null ? hoursLabel(m) : ""}</td>
                          <td>{r.status}</td>
                          <td>{v ? clientById(v.clientId).name : "Internal"}</td>
                        </>
                      ) : (
                        <>
                          <td>{r.task}</td>
                          <td>{r.details}</td>
                          <td>{r.start}</td>
                          <td>{r.end}</td>
                          <td>{m !== null ? hoursLabel(m) : ""}</td>
                          <td>{r.status}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {template.counters.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px]">
                {template.counters.map((c) => (
                  <div key={c.key} className="flex items-baseline justify-between border-b border-dotted border-foreground/40 py-0.5">
                    <span>Total No. of {c.label}</span>
                    <span className="font-serif text-[14px] italic">
                      {sheet?.counters[c.key] ?? 0}
                      {c.unit}
                    </span>
                  </div>
                ))}
                <div className="col-span-2 flex items-baseline gap-2 border-b border-dotted border-foreground/40 py-0.5">
                  <span>Other works:</span>
                  <span className="font-serif text-[14px] italic">{sheet?.otherWorks}</span>
                </div>
              </div>
            )}

            <div className="mt-4 text-[12px]">
              <div className="font-semibold">{isEditor ? "Delay / Extra Time Reason" : "Reason for the delay"}:</div>
              <div className="min-h-10 border-b border-dotted border-foreground/40 font-serif text-[14px] italic">
                {[sheet?.dayReason, ...rows.filter((r) => r.delayReason).map((r, i) => `(${i + 1}) ${r.delayReason}`)].filter(Boolean).join(" · ")}
              </div>
            </div>

            <div className="mt-8 grid gap-6" style={{ gridTemplateColumns: `repeat(${template.paperSignatures.length}, minmax(0, 1fr))` }}>
              {template.paperSignatures.map((label) => {
                const sig = sigFor(label);
                return (
                  <div key={label} className="text-center">
                    <div className="flex h-10 items-end justify-center font-serif text-[18px] italic">{sig.at ? sig.name : ""}</div>
                    <div className="border-t border-foreground/60 pt-1 text-[11px] font-semibold">{label} Sign</div>
                    <div className="text-[10px] text-muted-foreground">{sig.at ? stampLabel(sig.at) : "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
