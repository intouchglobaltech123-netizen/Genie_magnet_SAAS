"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, Copy, ExternalLink, ImageIcon, Info, Send, ShieldCheck, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, Input, Label } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemo } from "@/lib/store";
import { clientById, personById } from "@/lib/mock/core";
import { scheduleSlots } from "@/lib/mock/delivery";
import type { Video } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { Poster } from "@/features/portal/poster";
import { usePublishing } from "./publish-store";

/** Platforms are labels, not statuses — one neutral chip style for all of them. */
function PlatformChip({ p }: { p: string }) {
  return <Badge tone="outline">{p}</Badge>;
}

function defaultSlot(v: Video) {
  return `${fmtDate(v.publishDate, { weekday: "short", day: "numeric", month: "short" })} · 6:30 PM`;
}

export function PublishingPage() {
  const videos = useDemo((s) => s.videos);
  const { proofs, slots, setSlot } = usePublishing();
  const [target, setTarget] = useState<Video | null>(null);

  const queue = videos.filter((v) => v.stage === "Approved");
  const published = videos.filter((v) => v.stage === "Published");

  return (
    <div>
      <PageHeader
        eyebrow="Client Delivery · Module 20"
        depth="preview"
        title="Publishing"
        description="Only the client-approved version goes live. Every post is closed with its URL, timestamp and a proof screenshot."
      />

      <Alert tone="info" icon={Info} title="Phase 1 · manual posting with proof" className="mb-6">
        The social team posts manually and records proof here. <span className="font-medium">Phase 2:</span> direct scheduling &amp; publishing via Meta Graph and YouTube
        Data APIs, with the URL and timestamp captured automatically.
      </Alert>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ready to publish" value={queue.length} icon={Send} tone="accent" hint="approved by client" />
        <StatCard label="Published · Sep" value={published.length} icon={CheckCircle2} tone="success" hint="across all clients" />
        <StatCard label="With proof" value={`${proofs.filter((p) => published.some((v) => v.id === p.videoId)).length} / ${published.length}`} icon={ShieldCheck} tone="info" hint="URL + screenshot" />
        <StatCard label="Version mismatches" value="0" icon={ShieldCheck} tone="success" hint="posted file = approved file" />
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Queue · {queue.length}</TabsTrigger>
          <TabsTrigger value="published">Published · {published.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-3">
          {queue.length === 0 && <EmptyState icon={Send} title="Queue is clear" description="Nothing approved and waiting. Videos land here as soon as the client approves a version." />}
          {queue.map((v) => {
            const ver = v.versions.find((x) => x.status === "approved") ?? v.versions.at(-1);
            const client = clientById(v.clientId);
            const slot = slots[v.id] ?? defaultSlot(v);
            return (
              <Card key={v.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                <Poster video={v} className="aspect-video w-full shrink-0 rounded-lg md:w-40" size="sm" showMeta={false} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2 text-body text-muted-foreground">
                    <span className="shrink-0 font-mono">{v.code}</span>·<span className="truncate">{client.name}</span>
                  </div>
                  <div className="mt-0.5 truncate text-subheading font-semibold">{v.title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {v.platform.map((p) => (
                      <PlatformChip key={p} p={p} />
                    ))}
                    <Badge tone="success">
                      <CheckCircle2 /> {ver?.label} approved
                    </Badge>
                    <Badge tone="outline">
                      <CalendarClock /> {slot}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toast("Caption copied", { description: `${v.title} — caption & hashtags from the approved brief` })}
                  >
                    <Copy /> Caption
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <CalendarClock /> Reschedule
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Move to</DropdownMenuLabel>
                      {scheduleSlots.map((s) => (
                        <DropdownMenuItem
                          key={s}
                          onSelect={() => {
                            setSlot(v.id, s);
                            toast.success("Rescheduled", { description: `${v.code} → ${s}. ${client.name} will see the new date in their calendar.` });
                          }}
                        >
                          {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" variant="accent" onClick={() => setTarget(v)}>
                    <Send /> Mark published
                  </Button>
                </div>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="published">
          {published.length === 0 && <EmptyState icon={CheckCircle2} title="Nothing published yet" description="Mark a queued video as published to record its live URL and proof." />}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {published.map((v) => {
              const proof = proofs.find((p) => p.videoId === v.id);
              const ver = v.versions.find((x) => x.status === "approved") ?? v.versions.at(-1);
              return (
                <Card key={v.id} className="overflow-hidden">
                  <div className="relative">
                    <Poster video={v} className="aspect-video" showPlay={false} />
                    <span className="absolute right-3 top-3 rounded-md bg-success px-1.5 py-0.5 text-body font-semibold text-white">LIVE</span>
                  </div>
                  <div className="space-y-2.5 p-4">
                    <div>
                      <div className="truncate font-mono text-body text-muted-foreground">
                        {v.code} · {clientById(v.clientId).name}
                      </div>
                      <div className="mt-0.5 truncate text-body font-semibold">{v.title}</div>
                    </div>
                    <dl className="grid grid-cols-[88px_1fr] gap-y-1 text-body">
                      <dt className="text-muted-foreground">Version</dt>
                      <dd>{ver?.label ?? "—"} (client-approved)</dd>
                      <dt className="text-muted-foreground">Published</dt>
                      <dd>
                        {proof
                          ? fmtDate(proof.publishedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
                          : fmtDate(v.publishDate)}
                      </dd>
                      <dt className="text-muted-foreground">By</dt>
                      <dd>{proof?.by ?? personById("p-meena").name}</dd>
                      <dt className="text-muted-foreground">Proof</dt>
                      <dd className="flex min-w-0 items-center gap-1">
                        {proof ? (
                          <button
                            type="button"
                            className="inline-flex min-w-0 cursor-pointer items-center gap-1 rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                            onClick={() => toast("Proof screenshot", { description: `${proof.proofFile} · captured ${fmtDate(proof.publishedAt)}` })}
                          >
                            <ImageIcon className="size-3 shrink-0" /> <span className="truncate">{proof.proofFile}</span>
                          </button>
                        ) : (
                          <Badge tone="warning">Missing</Badge>
                        )}
                      </dd>
                    </dl>
                    {v.publishedUrl && (
                      <a href={v.publishedUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate rounded-sm text-body text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
                        <ExternalLink className="size-3 shrink-0" /> {v.publishedUrl}
                      </a>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <MarkPublishedDialog video={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function MarkPublishedDialog({ video, onClose }: { video: Video | null; onClose: () => void }) {
  const setStage = useDemo((s) => s.setStage);
  const updateVideo = useDemo((s) => s.updateVideo);
  const addProof = usePublishing((s) => s.addProof);
  const [url, setUrl] = useState("");
  const [at, setAt] = useState("2026-09-25T18:30");
  const [proof, setProof] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const ver = video ? (video.versions.find((x) => x.status === "approved") ?? video.versions.at(-1)) : undefined;
  const urlOk = /^https?:\/\/\S+\.\S+/.test(url);
  const valid = urlOk && !!proof && confirmed;

  const close = () => {
    setUrl("");
    setProof(null);
    setConfirmed(false);
    onClose();
  };

  const submit = () => {
    if (!video || !valid) return;
    updateVideo(video.id, { publishedUrl: url });
    setStage(video.id, "Published");
    addProof({ videoId: video.id, url, publishedAt: at, proofFile: proof!, by: "Meena Ravi" });
    toast.success(`${video.code} marked published`, { description: "URL, timestamp and proof saved · client library updated" });
    close();
  };

  return (
    <Dialog open={!!video} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as published</DialogTitle>
          <DialogDescription>
            {video?.code} · {video?.title}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Live post URL" required error={url && !urlOk ? "Enter the full link, starting with https://" : undefined}>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://instagram.com/reel/…" autoFocus />
          </Field>
          <Field label="Published at" required>
            <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </Field>
          <div className="space-y-1.5">
            <Label>
              Proof screenshot
              <span className="ml-0.5 text-danger" aria-hidden>
                *
              </span>
            </Label>
            {proof ? (
              <div className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                {video && <Poster video={video} className="h-12 w-20 shrink-0 rounded-md" size="sm" showMeta={false} showPlay={false} />}
                <div className="min-w-0 flex-1 text-body">
                  <div className="truncate font-medium">{proof}</div>
                  <div className="text-muted-foreground">412 KB · uploaded</div>
                </div>
                <Button size="icon-sm" variant="ghost" onClick={() => setProof(null)} aria-label="Remove screenshot">
                  <X />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setProof(`proof_${video?.code}.png`)}
                className="flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface-secondary p-5 text-center text-body text-muted-foreground transition hover:border-primary hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                <Upload className="size-5" />
                <span>
                  <span className="font-medium text-primary">Click to upload</span> a screenshot of the live post
                </span>
              </button>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-body">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            I posted the client-approved {ver?.label} file, unchanged
          </label>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button variant="accent" disabled={!valid} onClick={submit}>
            <CheckCircle2 /> Confirm published
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
