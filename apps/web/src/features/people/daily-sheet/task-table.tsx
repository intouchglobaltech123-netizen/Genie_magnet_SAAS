"use client";

import { AlertTriangle, Check, CircleDashed, Film, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { StageBadge } from "@/components/shared/video-bits";
import { clientById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { EDIT_STEPS, type EditStep } from "@/lib/types";
import { cn, hoursLabel } from "@/lib/utils";
import { useDaily } from "../daily-store";
import type { SheetKind } from "./config";
import type { SheetRow } from "./seed";
import { spanMinutes } from "./time";

const timeCls =
  "h-8 w-full rounded-md border border-input bg-card px-2 text-body tabular focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60 disabled:cursor-not-allowed";
const textCls =
  "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-body hover:border-input focus:border-input focus:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 placeholder:text-muted-foreground/60 disabled:hover:border-transparent disabled:cursor-not-allowed";

export function TaskTable({
  personId,
  date,
  kind,
  rows,
  locked,
  issueRows,
  placeholder,
}: {
  personId: string;
  date: string;
  kind: SheetKind;
  rows: SheetRow[];
  locked: boolean;
  issueRows: Set<string>;
  placeholder: string;
}) {
  const { addRow, updateRow, removeRow } = useDaily();
  const videos = useDemo((s) => s.videos);
  const toggleEditStep = useDemo((s) => s.toggleEditStep);
  const isEditor = kind === "editor";

  const videoOptions = [
    { value: "__none", label: "— Not a video task —" },
    ...[...videos]
      .sort((a, b) => Number(b.editorId === personId) - Number(a.editorId === personId))
      .map((v) => ({ value: v.id, label: `${v.code} · ${v.title.length > 34 ? v.title.slice(0, 34) + "…" : v.title}` })),
  ];

  const cols = isEditor
    ? "grid-cols-[28px_minmax(210px,1.7fr)_minmax(110px,0.9fr)_74px_96px_96px_70px_150px_32px]"
    : "grid-cols-[28px_minmax(170px,1.1fr)_minmax(200px,1.6fr)_96px_96px_70px_150px_32px]";

  const upd = (id: string, patch: Partial<SheetRow>) => updateRow(personId, date, id, patch);

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <div className={cn("min-w-[960px]")}>
        {/* header */}
        <div className={cn("grid items-center gap-2 border-b border-border px-4 pb-2 text-body font-medium uppercase tracking-wider text-muted-foreground", cols)}>
          <span>#</span>
          {isEditor ? (
            <>
              <span>Video ID</span>
              <span>Client</span>
              <span>Duration</span>
            </>
          ) : (
            <>
              <span>Task</span>
              <span>Details</span>
            </>
          )}
          <span>Start</span>
          <span>End</span>
          <span className="text-right">Total</span>
          <span className="pl-1">Status</span>
          <span />
        </div>

        <AnimatePresence initial={false}>
          {rows.map((row, i) => {
            const mins = spanMinutes(row.start, row.end);
            const video = row.videoId ? videos.find((v) => v.id === row.videoId) : undefined;
            const client = video ? clientById(video.clientId) : undefined;
            const done = video ? EDIT_STEPS.filter((s) => video.editSteps[s]).length : 0;
            const flagged = issueRows.has(row.id);
            return (
              <motion.div
                key={row.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className={cn("group border-b border-border px-4 py-2.5 last:border-b-0", flagged && "bg-warning-soft/40")}
              >
                <div className={cn("grid items-center gap-2", cols)}>
                  <span className="text-body font-medium text-muted-foreground tabular">{String(i + 1).padStart(2, "0")}</span>
                  {isEditor ? (
                    <>
                      <div className="min-w-0">
                        {locked ? (
                          <div className="truncate px-1 text-body font-medium">
                            {video ? (
                              <span className="font-mono text-body">{video.code}</span>
                            ) : (
                              row.task || "—"
                            )}
                          </div>
                        ) : (
                          <Select
                            value={row.videoId ?? "__none"}
                            onValueChange={(v) => upd(row.id, { videoId: v === "__none" ? undefined : v })}
                            options={videoOptions}
                            className="h-8 text-body"
                          />
                        )}
                        {!video && !locked && (
                          <input className={cn(textCls, "mt-1")} placeholder={placeholder} value={row.task} onChange={(e) => upd(row.id, { task: e.target.value })} />
                        )}
                      </div>
                      <div className="min-w-0 truncate text-body">
                        {client ? client.name : <span className="text-muted-foreground">Internal</span>}
                      </div>
                      <input
                        className={cn(timeCls, "px-1.5 text-center")}
                        placeholder="mm:ss"
                        value={row.duration}
                        disabled={locked}
                        onChange={(e) => upd(row.id, { duration: e.target.value })}
                      />
                    </>
                  ) : (
                    <>
                      <input disabled={locked} className={cn(textCls, "font-medium")} placeholder={placeholder} value={row.task} onChange={(e) => upd(row.id, { task: e.target.value })} />
                      <input disabled={locked} className={textCls} placeholder="Details" value={row.details} onChange={(e) => upd(row.id, { details: e.target.value })} />
                    </>
                  )}
                  <input type="time" disabled={locked} className={timeCls} value={row.start} onChange={(e) => upd(row.id, { start: e.target.value })} />
                  <input type="time" disabled={locked} className={timeCls} value={row.end} onChange={(e) => upd(row.id, { end: e.target.value })} />
                  <span className={cn("text-right text-body font-semibold tabular", mins === null && "text-muted-foreground font-normal")}>
                    {mins === null ? (row.start && row.end ? <span className="text-danger">invalid</span> : "—") : hoursLabel(mins)}
                  </span>
                  <StatusToggle
                    value={row.status}
                    disabled={locked}
                    onChange={(status) => {
                      upd(row.id, { status });
                      if (status === "Completed") toast.success(`Row ${i + 1} marked completed`);
                    }}
                  />
                  <div className="flex justify-end">
                    {!locked && (
                      <Tooltip content="Remove row">
                        <button
                          onClick={() => removeRow(personId, date, row.id)}
                          className="cursor-pointer rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {/* sub-row */}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-[36px]">
                  {isEditor && (
                    <input
                      disabled={locked}
                      className={cn(textCls, "h-7 max-w-md flex-1 text-body text-muted-foreground")}
                      placeholder="What did you do on this video?"
                      value={row.details}
                      onChange={(e) => upd(row.id, { details: e.target.value })}
                    />
                  )}
                  <button
                    disabled={locked}
                    onClick={() => upd(row.id, { productive: !row.productive })}
                    className={cn(
                      "inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-2 text-body font-medium transition disabled:cursor-default",
                      row.productive ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {row.productive ? "Productive" : "Non-productive"}
                  </button>
                  {video && <StageBadge stage={video.stage} />}
                  {(row.status === "Pending" || row.delayReason) && (
                    <div className="flex min-w-[260px] flex-1 items-center gap-1.5">
                      <AlertTriangle className={cn("size-3.5 shrink-0", row.delayReason ? "text-warning" : "text-danger")} />
                      <input
                        disabled={locked}
                        className={cn(textCls, "h-7 text-body", !row.delayReason && "border-danger/40 bg-danger-soft/40")}
                        placeholder="Delay / extra time reason (required for pending)"
                        value={row.delayReason}
                        onChange={(e) => upd(row.id, { delayReason: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                {/* editing steps */}
                {isEditor && video && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[36px]">
                    <span className="mr-1 inline-flex items-center gap-1 text-body font-medium text-muted-foreground">
                      <Film className="size-3" /> Edit steps <span className="tabular text-foreground">{done}/9</span>
                    </span>
                    {EDIT_STEPS.map((s: EditStep) => {
                      const on = video.editSteps[s];
                      return (
                        <button
                          key={s}
                          disabled={locked}
                          onClick={() => {
                            toggleEditStep(video.id, s);
                            toast(`${s} ${on ? "unticked" : "done"} on ${video.code}`, { description: "Synced to Video Production board" });
                          }}
                          className={cn(
                            "inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border px-2 text-body font-medium transition disabled:cursor-default",
                            on ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                          )}
                        >
                          {on ? <Check className="size-3" strokeWidth={3} /> : <CircleDashed className="size-3" />}
                          {s}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-body text-muted-foreground">No tasks logged yet for this day.</div>
        )}
      </div>
      {!locked && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <Button size="sm" variant="outline" onClick={() => addRow(personId, date)}>
            <Plus /> Add row
          </Button>
          <span className="text-body text-muted-foreground">Start time auto-continues from the previous row’s end.</span>
          {rows.length > 0 && (
            <Badge tone="outline" className="ml-auto">
              {rows.length} rows
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function StatusToggle({ value, onChange, disabled }: { value: SheetRow["status"]; onChange: (v: SheetRow["status"]) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex h-8 items-center rounded-md bg-muted p-0.5 text-body font-medium">
      {(["Pending", "Completed"] as const).map((s) => (
        <button
          key={s}
          disabled={disabled}
          onClick={() => onChange(s)}
          className={cn(
            "h-7 cursor-pointer rounded-[5px] px-2 transition disabled:cursor-default",
            value === s
              ? s === "Completed"
                ? "bg-success text-white shadow-sm"
                : "bg-warning text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
