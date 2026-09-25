"use client";

import { Check, CircleDashed, ShieldAlert, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { QC_CHECKS, type Video } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Segmented } from "./bits";
import { qcCounts } from "./lib";
import { useProduction } from "./store";

type QcVal = "pass" | "fail" | "pending";

const QC_HINT: Record<string, string> = {
  "Matches brief": "Hook, message and CTA match the approved brief",
  "Script / content accuracy": "Names, prices, claims verified against script",
  "Captions & subtitles": "Tamil + English captions synced, no overflow",
  "Audio levels & clarity": "Dialogue −12 to −6 dB, BGM ducked, no clipping",
  "Branding (logo, colours, fonts)": "Logo corner, brand colours & fonts per guide",
  "Framing & composition": "Headroom, safe zones for platform UI",
  "Spelling": "All on-screen text proof-read",
  "Call-to-action present": "End card with CTA and contact",
  "Format & aspect ratio": "Correct ratio for each platform",
  "Resolution & export quality": "1080p+ / correct bitrate, no banding",
  "Full playback check": "Watched end-to-end at 1× on mobile",
};

export function useQcSetter() {
  const setQc = useDemo((s) => s.setQc);
  const log = useDemo((s) => s.log);
  const addCorrective = useProduction((s) => s.addCorrective);
  const resolveCorrective = useProduction((s) => s.resolveCorrective);
  return (v: Video, check: string, value: QcVal) => {
    const prev = v.qc[check] ?? "pending";
    if (prev === value) return;
    setQc(v.id, check, value);
    if (value === "fail") {
      const owner = personById(v.editorId);
      addCorrective({ videoId: v.id, check, note: "", ownerId: v.editorId });
      log(`QC failed on ${v.code}: ${check} — stage held, corrective task assigned to ${owner.name}`, "danger");
      toast.error(`Mandatory check failed — stage held`, { description: `Corrective task created for ${owner.name}: “${check}”` });
    } else if (prev === "fail") {
      resolveCorrective(v.id, check);
      if (value === "pass") toast.success(`“${check}” re-checked and passed`);
    }
  };
}

export function QcChecklist({ v, dense }: { v: Video; dense?: boolean }) {
  const set = useQcSetter();
  const notes = useProduction((s) => s.qcNotes[v.id]);
  const setNote = useProduction((s) => s.setQcNote);
  const allCorrective = useProduction((s) => s.corrective);
  const corrective = allCorrective.filter((c) => c.videoId === v.id && !c.done);
  const setQc = useDemo((s) => s.setQc);
  const log = useDemo((s) => s.log);
  const counts = qcCounts(v);

  const passAll = () => {
    QC_CHECKS.forEach((c) => {
      if (v.qc[c] !== "pass") setQc(v.id, c, "pass");
    });
    corrective.forEach((c) => useProduction.getState().resolveCorrective(v.id, c.check));
    log(`All ${QC_CHECKS.length} QC checks passed on ${v.code}`, "success");
    toast.success("All checks passed", { description: `${v.code} is clear for client review.` });
  };

  return (
    <div>
      <div className={cn("flex flex-wrap items-center justify-between gap-3", dense ? "mb-3" : "mb-4")}>
        <div className="flex min-w-[220px] flex-1 items-center gap-3">
          <Progress value={(counts.pass / QC_CHECKS.length) * 100} tone={counts.fail ? "danger" : counts.pass === QC_CHECKS.length ? "success" : "accent"} className="max-w-56" />
          <span className="text-body tabular text-muted-foreground">
            <b className="text-success">{counts.pass}</b> pass · <b className={counts.fail ? "text-danger" : ""}>{counts.fail}</b> fail · {counts.pending} pending
          </span>
        </div>
        <Button size="sm" variant="success" onClick={passAll} disabled={counts.pass === QC_CHECKS.length}>
          <Check /> Pass all
        </Button>
      </div>

      {corrective.length > 0 && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-3 text-body">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
          <div>
            <div className="font-semibold text-danger">Mandatory check failed — stage held, corrective task created</div>
            <ul className="mt-1 space-y-0.5 text-foreground/80">
              {corrective.map((c) => (
                <li key={c.id} className="flex items-center gap-1.5">
                  <Wrench className="size-3 text-muted-foreground" /> Fix “{c.check}” — owner {personById(c.ownerId).name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {QC_CHECKS.map((c, i) => {
          const val = (v.qc[c] ?? "pending") as QcVal;
          return (
            <div key={c} className={cn("px-3.5", dense ? "py-2" : "py-2.5", val === "fail" && "bg-danger-soft/50")}>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-body font-semibold tabular",
                    val === "pass" ? "bg-success-soft text-success" : val === "fail" ? "bg-danger-soft text-danger" : "bg-muted text-muted-foreground",
                  )}
                >
                  {val === "pass" ? <Check className="size-3.5" /> : val === "fail" ? <X className="size-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-body font-medium">{c}</div>
                  {!dense && <div className="text-body text-muted-foreground">{QC_HINT[c]}</div>}
                </div>
                <Segmented<QcVal>
                  value={val}
                  onChange={(nv) => set(v, c, nv)}
                  options={[
                    { value: "pass", label: <><Check /> Pass</>, activeCls: "bg-success text-white shadow-sm" },
                    { value: "fail", label: <><X /> Fail</>, activeCls: "bg-danger text-white shadow-sm" },
                    { value: "pending", label: <><CircleDashed /> Pending</> },
                  ]}
                />
              </div>
              {val === "fail" && (
                <div className="mt-2 flex items-center gap-2 pl-9">
                  <Wrench className="size-3.5 shrink-0 text-danger" />
                  <Input
                    value={notes?.[c] ?? ""}
                    onChange={(e) => setNote(v.id, c, e.target.value)}
                    placeholder="Corrective action — what must be fixed, by whom?"
                    className="h-8 text-body"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
