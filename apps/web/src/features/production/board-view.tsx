"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { stageTone, UrgencyIcon, VPBadge } from "@/components/shared/video-bits";
import { personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { VIDEO_STAGES, type Video, type VideoStage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClientChip, DueLabel, EditStepsBar } from "./bits";
import { canMoveTo, doneSteps, qcCounts } from "./lib";

const toneDot: Record<string, string> = {
  neutral: "bg-muted-foreground/50",
  outline: "bg-muted-foreground",
  info: "bg-info",
  accent: "bg-accent",
  gold: "bg-gold",
  warning: "bg-warning",
  danger: "bg-danger",
  success: "bg-success",
};

export function useMoveVideo() {
  const setStage = useDemo((s) => s.setStage);
  return (v: Video, to: VideoStage) => {
    if (v.stage === to) return false;
    const gate = canMoveTo(v, to);
    if (!gate.ok) {
      toast.error(gate.title, { description: `${v.code}: ${gate.reason}` });
      return false;
    }
    setStage(v.id, to);
    toast.success(`${v.code} → ${to}`);
    return true;
  };
}

export function BoardView({ videos }: { videos: Video[] }) {
  const move = useMoveVideo();
  const [over, setOver] = useState<VideoStage | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 scrollbar-thin lg:-mx-8 lg:px-8">
      <div className="flex min-w-max gap-3">
        {VIDEO_STAGES.map((stage) => {
          const items = videos.filter((v) => v.stage === stage);
          const dragged = dragId ? videos.find((v) => v.id === dragId) : undefined;
          const blocked = dragged ? !canMoveTo(dragged, stage).ok : false;
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/video-id");
                const v = videos.find((x) => x.id === id);
                if (v) move(v, stage);
                setOver(null);
                setDragId(null);
              }}
              className={cn(
                "flex w-[272px] shrink-0 flex-col rounded-2xl border border-transparent bg-muted/60 p-2 transition-colors",
                over === stage && (blocked ? "border-danger/40 bg-danger-soft/60" : "border-accent/40 bg-accent-soft/50"),
              )}
            >
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <div className="flex items-center gap-2 text-[13px] font-semibold">
                  <span className={cn("size-2 rounded-full", toneDot[stageTone[stage]])} />
                  {stage}
                </div>
                <span className="rounded-md bg-card px-1.5 text-[11px] font-medium tabular text-muted-foreground">{items.length}</span>
              </div>
              <div className="flex min-h-24 flex-col gap-2">
                {items.map((v) => (
                  <BoardCard key={v.id} v={v} onDragStart={() => setDragId(v.id)} onDragEnd={() => setDragId(null)} />
                ))}
                {!items.length && (
                  <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-border text-[12px] text-muted-foreground">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({ v, onDragStart, onDragEnd }: { v: Video; onDragStart: () => void; onDragEnd: () => void }) {
  const router = useRouter();
  const editor = personById(v.editorId);
  const steps = doneSteps(v);
  const qc = qcCounts(v);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/video-id", v.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => router.push(`/production/${v.id}`)}
      className="group relative cursor-pointer rounded-xl border border-border bg-card p-3 shadow-card transition hover:-translate-y-px hover:border-accent/40 hover:shadow-pop active:cursor-grabbing"
    >
      <GripVertical className="absolute right-1.5 top-3 size-3.5 text-muted-foreground/0 transition group-hover:text-muted-foreground/60" />
      <div className="flex items-center justify-between gap-2 pr-3">
        <span className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground">{v.code}</span>
        <div className="flex items-center gap-1">
          <UrgencyIcon urgency={v.urgency} />
          <VPBadge on={v.videoProtection} />
        </div>
      </div>
      <div className="mt-1.5 line-clamp-2 text-[13.5px] font-medium leading-snug">{v.title}</div>
      <ClientChip clientId={v.clientId} className="mt-1.5" />
      {(v.stage === "Editing" || v.stage === "Shot") && (
        <div className="mt-2.5">
          <div className="mb-1 flex justify-between text-[10.5px] text-muted-foreground">
            <span>Edit steps</span>
            <span className="tabular">{steps}/9</span>
          </div>
          <EditStepsBar v={v} />
        </div>
      )}
      {v.stage === "Internal QC" && (
        <div className="mt-2.5 flex items-center gap-2 text-[11px]">
          <span className="text-success">{qc.pass} pass</span>
          {qc.fail > 0 && <span className="font-medium text-danger">{qc.fail} fail</span>}
          <span className="text-muted-foreground">{qc.pending} pending</span>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Avatar name={editor.name} size="xs" />
          {editor.name.split(" ")[0]}
        </span>
        <DueLabel v={v} />
      </div>
    </div>
  );
}
