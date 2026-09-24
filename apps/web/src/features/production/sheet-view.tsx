"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { StageBadge, urgencyMeta } from "@/components/shared/video-bits";
import { personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import type { Urgency, Video } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DueLabel } from "./bits";

const PER_SHEET = 20;
const URGENCIES: Urgency[] = ["rush", "priority", "standard"];

export function SheetView({ videos }: { videos: Video[] }) {
  const updateVideo = useDemo((s) => s.updateVideo);
  const log = useDemo((s) => s.log);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(videos.length / PER_SHEET));
  const cur = Math.min(page, pages - 1);
  const rows = videos.slice(cur * PER_SHEET, cur * PER_SHEET + PER_SHEET);
  const blanks = Math.min(6, PER_SHEET - rows.length);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Genie Magnet · Video list sheet</div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            Digital copy of the paper sheet — tick urgency and VP right here. Changes sync to the board and calendar.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] tabular text-muted-foreground">
            Sheet {cur + 1} of {pages}
          </span>
          <Button variant="ghost" size="icon-sm" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous sheet">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next sheet">
            <ChevronRight />
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.success("Sheet exported", { description: `video-list-sheet-${cur + 1}.pdf ready (A4, 20 rows)` })}>
            <Printer /> Print sheet
          </Button>
        </div>
      </div>
      <Table>
        <THead>
          <TR>
            <TH className="w-10 text-center">S.No</TH>
            <TH>Video Code</TH>
            <TH className="text-center">
              <div>Urgency</div>
              <div className="mt-0.5 flex justify-center gap-3 text-[9.5px] normal-case tracking-normal">
                {URGENCIES.map((u) => (
                  <span key={u}>{urgencyMeta[u].label}</span>
                ))}
              </div>
            </TH>
            <TH className="min-w-[260px]">Video Name</TH>
            <TH>Clip No.</TH>
            <TH className="text-center">VP</TH>
            <TH>Editor Name</TH>
            <TH>Stage</TH>
            <TH>Due</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((v, i) => {
            const editor = personById(v.editorId);
            return (
              <TR key={v.id}>
                <TD className="text-center text-[12px] tabular text-muted-foreground">{cur * PER_SHEET + i + 1}</TD>
                <TD className="font-mono text-[12px] font-medium">{v.code}</TD>
                <TD>
                  <div className="flex justify-center gap-1.5">
                    {URGENCIES.map((u) => {
                      const m = urgencyMeta[u];
                      const Icon = m.icon;
                      const on = v.urgency === u;
                      return (
                        <Tooltip key={u} content={m.desc}>
                          <button
                            type="button"
                            onClick={() => {
                              if (on) return;
                              updateVideo(v.id, { urgency: u });
                              log(`${v.code} urgency set to ${m.label}`, u === "rush" ? "warning" : "accent");
                              toast.success(`${v.code} marked ${m.label}`);
                            }}
                            className={cn(
                              "inline-flex size-7 cursor-pointer items-center justify-center rounded-md border transition",
                              on ? cn(m.cls, "border-transparent") : "border-border text-muted-foreground/40 hover:border-muted-foreground/40 hover:text-muted-foreground",
                            )}
                          >
                            <Icon className="size-3.5" strokeWidth={2.4} />
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                </TD>
                <TD>
                  <Link href={`/production/${v.id}`} className="font-medium hover:text-accent">
                    {v.title}
                  </Link>
                </TD>
                <TD>
                  <input
                    value={v.clipNo}
                    onChange={(e) => updateVideo(v.id, { clipNo: e.target.value })}
                    className="w-36 rounded-md border border-transparent bg-transparent px-1.5 py-1 font-mono text-[12px] outline-none transition hover:border-border focus:border-ring focus:bg-card"
                  />
                </TD>
                <TD className="text-center">
                  <Tooltip content={v.videoProtection ? "Footage protected on NAS" : "Tick once raw footage is backed up"}>
                    <span className="inline-flex">
                      <Checkbox
                        checked={v.videoProtection}
                        className="data-[state=checked]:border-success data-[state=checked]:bg-success"
                        onCheckedChange={(c) => {
                          updateVideo(v.id, { videoProtection: !!c });
                          log(`${v.code} VP ${c ? "ticked — footage protected" : "un-ticked"}`, c ? "success" : "warning");
                          toast(c ? `${v.code} footage protected` : `${v.code} VP removed`);
                        }}
                      />
                    </span>
                  </Tooltip>
                </TD>
                <TD>
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={editor.name} size="xs" />
                    {editor.name}
                  </span>
                </TD>
                <TD>
                  <StageBadge stage={v.stage} />
                </TD>
                <TD>
                  <DueLabel v={v} />
                </TD>
              </TR>
            );
          })}
          {Array.from({ length: blanks }).map((_, i) => (
            <TR key={`blank-${i}`} className="hover:bg-transparent">
              <TD className="h-11 text-center text-[12px] tabular text-muted-foreground/40">{cur * PER_SHEET + rows.length + i + 1}</TD>
              <TD colSpan={8} />
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
