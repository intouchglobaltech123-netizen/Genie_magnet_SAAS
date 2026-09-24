"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { urgencyMeta } from "@/components/shared/video-bits";
import { agreements, clients, editors, TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { EDIT_STEPS, QC_CHECKS, type Urgency, type Video } from "@/lib/types";
import { cn } from "@/lib/utils";
import { cycleFor, nextVideoCode, PLANNED_MIN, shiftIso } from "./lib";
import { addVideoToDemo } from "./store";

const FORMATS: Video["format"][] = ["Reel", "Long-form", "Ad", "Testimonial", "Explainer", "Podcast clip"];
const ASPECTS: Video["aspect"][] = ["9:16", "16:9", "1:1", "4:5"];
const defaultAspect = (f: Video["format"]): Video["aspect"] => (f === "Long-form" ? "16:9" : f === "Ad" ? "4:5" : "9:16");

export function NewVideoDialog({ open, onOpenChange, defaultDue }: { open: boolean; onOpenChange: (o: boolean) => void; defaultDue?: string }) {
  const router = useRouter();
  const videos = useDemo((s) => s.videos);
  const [clientId, setClientId] = useState("c-kaveri");
  const [agreementId, setAgreementId] = useState("a-kvr-01");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<Video["format"]>("Reel");
  const [aspect, setAspect] = useState<Video["aspect"]>("9:16");
  const [urgency, setUrgency] = useState<Urgency>("standard");
  const [editorId, setEditorId] = useState("p-surya");
  const [due, setDue] = useState(defaultDue ?? shiftIso(TODAY, 7));

  const clientAgreements = agreements.filter((a) => a.clientId === clientId);
  const code = useMemo(() => nextVideoCode(videos, clientId, due || TODAY), [videos, clientId, due]);
  const cycle = cycleFor(agreementId, due || TODAY);

  const create = () => {
    if (!title.trim()) {
      toast.error("Give the video a name", { description: "Video Name is required on the video list sheet." });
      return;
    }
    const v: Video = {
      id: `v-new-${Math.random().toString(36).slice(2, 7)}`,
      code,
      title: title.trim(),
      clientId,
      agreementId,
      cycleId: cycle.id,
      format,
      aspect,
      urgency,
      stage: "Planned",
      clipNo: "—",
      videoProtection: false,
      editorId,
      directorId: "p-karthik",
      cameraId: clientId === "c-urban" ? "f-gokul" : "p-vignesh",
      dueDate: due,
      publishDate: due,
      plannedMinutes: PLANNED_MIN[format],
      loggedMinutes: 0,
      editSteps: Object.fromEntries(EDIT_STEPS.map((s) => [s, false])) as Video["editSteps"],
      qc: Object.fromEntries(QC_CHECKS.map((c) => [c, "pending"])),
      revisionsUsed: 0,
      versions: [],
      comments: [],
      platform: format === "Long-form" ? ["YouTube"] : ["Instagram", "YouTube Shorts"],
    };
    addVideoToDemo(v);
    onOpenChange(false);
    setTitle("");
    toast.success(`${code} created`, {
      description: `Added to ${cycle.label} cycle · planned edit ${PLANNED_MIN[format] / 60}h`,
      action: { label: "Open", onClick: () => router.push(`/production/${v.id}`) },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New video</DialogTitle>
          <DialogDescription>Adds a row to the video list sheet and the production calendar.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/50 px-4 py-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Video code (auto)</div>
              <div className="mt-0.5 font-mono text-lg font-semibold tracking-wide">{code}</div>
            </div>
            <div className="text-right text-[12px] text-muted-foreground">
              <div className="inline-flex items-center gap-1">
                <Sparkles className="size-3.5 text-accent" /> Client · MMYY · sequence
              </div>
              <div className="mt-0.5">Cycle: {cycle.label}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <Select
                value={clientId}
                onValueChange={(c) => {
                  setClientId(c);
                  setAgreementId(agreements.find((a) => a.clientId === c)!.id);
                }}
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>
            <Field label="Agreement">
              <Select value={agreementId} onValueChange={setAgreementId} options={clientAgreements.map((a) => ({ value: a.id, label: a.packageName }))} />
            </Field>
          </div>
          <Field label="Video name">
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sesame oil — why wood-pressed matters" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Format">
              <Select
                value={format}
                onValueChange={(f) => {
                  setFormat(f as Video["format"]);
                  setAspect(defaultAspect(f as Video["format"]));
                }}
                options={FORMATS.map((f) => ({ value: f, label: f }))}
              />
            </Field>
            <Field label="Aspect ratio">
              <Select value={aspect} onValueChange={(a) => setAspect(a as Video["aspect"])} options={ASPECTS.map((a) => ({ value: a, label: a }))} />
            </Field>
          </div>
          <Field label="Urgency">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(urgencyMeta) as Urgency[]).map((u) => {
                const m = urgencyMeta[u];
                const Icon = m.icon;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgency(u)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition",
                      urgency === u ? "border-accent bg-accent-soft/60 ring-2 ring-accent/20" : "border-border hover:bg-muted",
                    )}
                  >
                    <span className={cn("inline-flex size-6 items-center justify-center rounded-md", m.cls)}>
                      <Icon className="size-3.5" />
                    </span>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Editor">
              <Select value={editorId} onValueChange={setEditorId} options={editors.map((e) => ({ value: e.id, label: `${e.name}${e.type === "freelancer" ? " (freelance)" : ""}` }))} />
            </Field>
            <Field label="Due / publish date">
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="accent" onClick={create}>
            <Plus /> Create video
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
