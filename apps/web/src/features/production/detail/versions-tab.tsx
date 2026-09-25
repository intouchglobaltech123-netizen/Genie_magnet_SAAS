"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, CheckCircle2, MessageSquarePlus, Mic, Pause, Play, RotateCcw, Upload, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { agreementById, clientById } from "@/lib/mock/core";
import { roleLabels } from "@/lib/nav";
import { useDemo } from "@/lib/store";
import type { Video, VideoVersion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CLIENT_COLOR } from "../lib";

const verTone: Record<VideoVersion["status"], BadgeTone> = {
  internal: "neutral",
  sent: "info",
  "changes-requested": "danger",
  approved: "success",
};
const verLabel: Record<VideoVersion["status"], string> = {
  internal: "Internal",
  sent: "With client",
  "changes-requested": "Changes requested",
  approved: "Approved",
};

const toSec = (mmss?: string) => {
  if (!mmss) return 0;
  const [m, s] = mmss.split(":").map(Number);
  return (m ?? 0) * 60 + (s ?? 0);
};
const toMmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

const frameCls: Record<Video["aspect"], string> = {
  "9:16": "aspect-[9/16] w-full max-w-[260px]",
  "16:9": "aspect-video w-full",
  "1:1": "aspect-square w-full max-w-[380px]",
  "4:5": "aspect-[4/5] w-full max-w-[320px]",
};

export function VersionsTab({ v }: { v: Video }) {
  const role = useDemo((s) => s.role);
  const addComment = useDemo((s) => s.addComment);
  const updateVideo = useDemo((s) => s.updateVideo);
  const approveVersion = useDemo((s) => s.approveVersion);
  const requestChanges = useDemo((s) => s.requestChanges);
  const publishNewVersion = useDemo((s) => s.publishNewVersion);
  const allowed = agreementById(v.agreementId).revisionsPerDeliverable;

  const [selId, setSelId] = useState<string | undefined>(v.versions.at(-1)?.id);
  const sel = v.versions.find((x) => x.id === selId) ?? v.versions.at(-1);
  const duration = Math.max(1, toSec(sel?.duration ?? "00:45"));
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const active = playing && pos < duration;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setPos((p) => Math.min(duration, p + 0.25)), 250);
    return () => clearInterval(t);
  }, [active, duration]);

  const togglePlay = () => {
    if (pos >= duration) {
      setPos(0);
      setPlaying(true);
    } else setPlaying(!active);
    setActiveComment(null);
  };

  const comments = v.comments.filter((c) => !sel || c.versionId === sel.id);
  const c = clientById(v.clientId);
  const color = CLIENT_COLOR[v.clientId] ?? "var(--color-primary)";

  if (!v.versions.length) {
    return (
      <EmptyState
        icon={Upload}
        title="No versions yet"
        description={`The first cut is shared with ${c.contacts[0]!.name} after it passes internal QC. Versions, frame comments and voice notes will appear here.`}
      />
    );
  }

  const submitComment = () => {
    if (!sel || !draft.trim()) return;
    addComment(v.id, { versionId: sel.id, author: roleLabels[role].person.split(" · ")[0]!, timestamp: toMmss(pos), text: draft.trim(), kind: "text" });
    setDraft("");
    toast.success(`Comment pinned at ${toMmss(pos)}`);
  };

  const seek = (sec: number, commentId?: string) => {
    setPos(Math.min(duration, sec));
    setPlaying(false);
    setActiveComment(commentId ?? null);
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr]">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-center bg-sidebar p-5">
            <div
              className={cn("relative overflow-hidden rounded-xl shadow-pop", frameCls[v.aspect])}
              style={{
                background: `radial-gradient(120% 80% at 30% 20%, color-mix(in srgb, ${color} 55%, transparent), transparent 60%), radial-gradient(100% 70% at 80% 90%, color-mix(in srgb, var(--color-chart-3) 35%, transparent), transparent 65%), var(--color-sidebar)`,
              }}
            >
              <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3 text-body text-white/70">
                <span className="truncate rounded-md bg-black/40 px-1.5 py-0.5 font-mono backdrop-blur">{v.code} · {sel?.label}</span>
                <span className="shrink-0 rounded-md bg-black/40 px-1.5 py-0.5 backdrop-blur">{v.aspect}</span>
              </div>
              <button
                type="button"
                onClick={togglePlay}
                className="absolute left-1/2 top-1/2 inline-flex size-16 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-md transition hover:scale-105 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                aria-label={active ? "Pause" : "Play"}
              >
                {active ? <Pause className="size-6" fill="currentColor" /> : <Play className="ml-1 size-6" fill="currentColor" />}
              </button>
              {activeComment && (
                <div className="absolute inset-x-3 bottom-14 rounded-lg bg-black/60 p-2.5 text-body text-white backdrop-blur">
                  {v.comments.find((x) => x.id === activeComment)?.text}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10">
                <div className="line-clamp-1 text-body font-medium text-white">{v.title}</div>
                <div className="text-body text-white/60">{c.name}</div>
              </div>
            </div>
          </div>
          <div className="border-t border-border bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={togglePlay}
                aria-label={active ? "Pause" : "Play"}
              >
                {active ? <Pause /> : <Play />}
              </Button>
              <span className="shrink-0 whitespace-nowrap font-mono text-body tabular text-muted-foreground">
                {toMmss(pos)} / {toMmss(duration)}
              </span>
              <div
                className="relative h-8 min-w-0 flex-1 cursor-pointer"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  seek(((e.clientX - r.left) / r.width) * duration);
                }}
              >
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(pos / duration) * 100}%` }} />
                </div>
                <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow" style={{ left: `${(pos / duration) * 100}%` }} />
                {comments
                  .filter((cm) => cm.timestamp)
                  .map((cm) => (
                    <Tooltip key={cm.id} content={`${cm.timestamp} — ${cm.text}`}>
                      <button
                        type="button"
                        aria-label={`Jump to comment at ${cm.timestamp}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          seek(toSec(cm.timestamp), cm.id);
                        }}
                        className={cn(
                          "absolute top-0 size-2.5 -translate-x-1/2 cursor-pointer rounded-full ring-2 ring-card transition hover:scale-125 focus-visible:outline-none focus-visible:ring-primary",
                          cm.resolved ? "bg-success" : "bg-warning",
                        )}
                        style={{ left: `${Math.min(100, (toSec(cm.timestamp) / duration) * 100)}%` }}
                      />
                    </Tooltip>
                  ))}
              </div>
              <Volume2 className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Versions</CardTitle>
              <CardDescription>
                Revisions used {v.revisionsUsed} of {allowed} included in the agreement
              </CardDescription>
            </div>
            <Button size="sm" variant="accent" onClick={() => setUploadOpen(true)}>
              <Upload /> Upload new version
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={(v.revisionsUsed / allowed) * 100} tone={v.revisionsUsed >= allowed ? "danger" : "accent"} className="mb-3" />
            {[...v.versions].reverse().map((ver) => (
              <button
                key={ver.id}
                type="button"
                aria-pressed={sel?.id === ver.id}
                onClick={() => {
                  setSelId(ver.id);
                  setPos(0);
                  setPlaying(false);
                  setActiveComment(null);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                  sel?.id === ver.id ? "border-primary/50 bg-primary-soft/40" : "border-border hover:bg-muted/50",
                )}
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-body font-semibold">{ver.label}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body font-medium">{ver.notes}</div>
                  <div className="text-body text-muted-foreground">
                    {ver.by} · {format(parseISO(ver.createdAt), "d MMM, HH:mm")} · {ver.duration}
                  </div>
                </div>
                <Badge tone={verTone[ver.status]}>{verLabel[ver.status]}</Badge>
              </button>
            ))}
            {sel && (sel.status === "sent" || sel.status === "internal") && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <span className="mr-auto text-body text-muted-foreground">Record client decision on {sel.label}:</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    requestChanges(v.id, sel.id);
                    toast.warning(`Changes requested on ${sel.label}`, { description: v.revisionsUsed >= allowed ? "Revision allowance used up — log as out-of-scope CR." : "Counts against included revisions." });
                  }}
                >
                  <RotateCcw /> Changes requested
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => {
                    approveVersion(v.id, sel.id);
                    toast.success(`${sel.label} approved by ${c.contacts[0]!.name}`);
                  }}
                >
                  <Check /> Approved
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="flex flex-col">
        <CardHeader>
          <div>
            <CardTitle>Feedback on {sel?.label}</CardTitle>
            <CardDescription>
              {comments.length} comments · {comments.filter((x) => !x.resolved).length} open
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-2.5">
          {!comments.length && <EmptyState compact icon={MessageSquarePlus} title="No feedback yet" description="Comments pinned to a timestamp on this version will appear here." />}
          {comments.map((cm) => (
            <div
              key={cm.id}
              className={cn(
                "rounded-xl border p-3 transition",
                activeComment === cm.id ? "border-primary/50 bg-primary-soft/30" : "border-border",
                cm.resolved && "opacity-70",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Avatar name={cm.author} size="sm" />
                <span className="text-body font-medium">{cm.author}</span>
                <span className="text-body text-muted-foreground">{format(parseISO(cm.at), "d MMM, HH:mm")}</span>
                {cm.timestamp && (
                  <button
                    type="button"
                    onClick={() => seek(toSec(cm.timestamp), cm.id)}
                    aria-label={`Jump to ${cm.timestamp}`}
                    className="ml-auto cursor-pointer rounded-md bg-warning-soft px-1.5 py-0.5 font-mono text-body font-medium text-warning hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                  >
                    {cm.timestamp}
                  </button>
                )}
              </div>
              {cm.kind === "voice" ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted px-2.5 py-2">
                  <button type="button" aria-label="Play voice note" onClick={() => toast("Playing voice note · 0:18")} className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
                    <Mic className="size-3.5" />
                  </button>
                  <div className="flex h-6 min-w-0 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden>
                    {Array.from({ length: 36 }).map((_, i) => (
                      <span key={i} className="w-[3px] shrink-0 rounded-full bg-primary/60" style={{ height: `${25 + Math.abs(Math.sin(i * 1.7) * 75)}%` }} />
                    ))}
                  </div>
                  <span className="font-mono text-body text-muted-foreground">0:18</span>
                </div>
              ) : null}
              <p className="mt-2 text-body leading-relaxed text-text-primary">{cm.kind === "voice" ? <span className="text-muted-foreground">Transcript: </span> : null}{cm.text.replace(/^Voice note: /, "")}</p>
              <div className="mt-2 flex justify-end">
                <Button
                  size="xs"
                  variant={cm.resolved ? "ghost" : "outline"}
                  onClick={() => {
                    updateVideo(v.id, { comments: v.comments.map((x) => (x.id === cm.id ? { ...x, resolved: !x.resolved } : x)) });
                    toast(cm.resolved ? "Comment reopened" : "Marked resolved");
                  }}
                >
                  {cm.resolved ? <><RotateCcw /> Reopen</> : <><CheckCircle2 /> Resolve</>}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Input
              aria-label="Add a timestamped comment"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Comment at ${toMmss(pos)}…`}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitComment();
              }}
            />
            <Button
              variant="outline"
              disabled={!draft.trim() || !sel}
              onClick={submitComment}
            >
              <MessageSquarePlus /> Add
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload v{v.versions.length + 1}</DialogTitle>
            <DialogDescription>The new cut is sent to {c.contacts[0]!.name} for review in the client portal.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-secondary px-4 py-8 text-center">
              <Upload className="size-5 text-muted-foreground" />
              <div className="break-all text-body font-medium">{v.code}_v{v.versions.length + 1}_final.mp4</div>
              <div className="text-body text-muted-foreground">{v.aspect === "16:9" ? "1920 × 1080" : v.aspect === "9:16" ? "1080 × 1920" : v.aspect === "4:5" ? "1080 × 1350" : "1080 × 1080"} · H.264 · 184 MB (demo)</div>
            </div>
            {v.revisionsUsed >= allowed && v.versions.length >= 1 && (
              <div className="rounded-lg bg-warning-soft px-3 py-2 text-body text-warning">
                All {allowed} included revisions are used — this version will be flagged for an out-of-scope change request.
              </div>
            )}
            <Field label="Version notes" hint="Shown to the client alongside the new cut.">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What changed in this version?" rows={3} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                publishNewVersion(v.id, notes.trim() || "Addressed client feedback");
                setUploadOpen(false);
                setNotes("");
                setSelId(undefined);
                toast.success(`v${v.versions.length + 1} sent to client`, { description: "Stage moved to Client Review" });
              }}
            >
              <Upload /> Send to client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
