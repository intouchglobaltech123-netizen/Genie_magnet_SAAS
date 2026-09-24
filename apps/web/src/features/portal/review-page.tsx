"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Info, MessageSquareWarning, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { useDemo } from "@/lib/store";
import { agreementById, TODAY } from "@/lib/mock/core";
import { PORTAL_CLIENT_ID, PORTAL_USER, publishTimes } from "@/lib/mock/portal";
import type { ClientComment } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { allowanceFor, parseTs } from "./lib";
import { ReviewComments } from "./review-comments";
import { ReviewPlayer } from "./review-player";

const SPEEDS = [1, 1.5, 2];

export function ReviewPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const video = useDemo((s) => s.videos.find((v) => v.id === videoId));
  const addComment = useDemo((s) => s.addComment);
  const approveVersion = useDemo((s) => s.approveVersion);
  const requestChanges = useDemo((s) => s.requestChanges);

  const [versionId, setVersionId] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [watched, setWatched] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const timeRef = useRef(0);

  const version = video ? (video.versions.find((v) => v.id === versionId) ?? video.versions.at(-1)) : undefined;
  const duration = parseTs(version?.duration ?? "00:45");

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = Math.min(duration, timeRef.current + 0.25 * speed);
      timeRef.current = next;
      setTime(next);
      if (next >= duration) setPlaying(false);
    }, 250);
    return () => clearInterval(id);
  }, [playing, duration, speed]);

  if (!video || video.clientId !== PORTAL_CLIENT_ID || !version) {
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <div className="text-[16px] font-semibold">This video isn&apos;t available</div>
        <p className="mt-1 text-[13px] text-muted-foreground">It may not be shared with your account yet.</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/portal">Back to overview</Link>
        </Button>
      </Card>
    );
  }

  const agreement = agreementById(video.agreementId);
  const allowance = allowanceFor(video);
  const latest = video.versions.at(-1)!;
  const isLatest = version.id === latest.id;
  const reviewable = isLatest && video.stage === "Client Review" && version.status === "sent";
  const versionComments = video.comments.filter((c) => c.versionId === version.id);
  const openNotes = versionComments.filter((c) => !c.resolved);
  const approvedVersion = video.versions.find((v) => v.status === "approved");

  const seek = (t: number) => {
    const clamped = Math.max(0, Math.min(duration, t));
    timeRef.current = clamped;
    setTime(clamped);
  };

  const toggle = () => {
    if (!playing && timeRef.current >= duration) seek(0);
    setPlaying((p) => !p);
  };

  const selectComment = (c: ClientComment) => {
    setActiveId(c.id);
    setPlaying(false);
    if (c.timestamp) seek(parseTs(c.timestamp));
  };

  const switchVersion = (id: string) => {
    setVersionId(id);
    setPlaying(false);
    setActiveId(null);
    seek(0);
  };

  const post = (c: { text: string; kind: "text" | "voice"; timestamp?: string }) => {
    addComment(video.id, { versionId: version.id, author: PORTAL_USER.name, ...c });
    setPlaying(false);
    toast.success(c.timestamp ? `Comment pinned at ${c.timestamp}` : "Comment added", { description: "Your team sees this instantly." });
  };

  const approve = () => {
    approveVersion(video.id, version.id);
    setApproveOpen(false);
    setPlaying(false);
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 1800);
    toast.success(`${version.label} approved`, { description: `Recorded with timestamp. Scheduled to go live ${fmtDate(video.publishDate)}.` });
  };

  const sendChanges = () => {
    requestChanges(video.id, version.id);
    setChangesOpen(false);
    toast.success("Changes sent to your team", {
      description: `${openNotes.length} note${openNotes.length === 1 ? "" : "s"} · next version within ${agreement.turnaroundDays} working days`,
    });
  };

  const usedAfter = video.revisionsUsed + 1;
  const exceeds = usedAfter > allowance;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <Link href="/portal" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Overview
          </Link>
          <h1 className="mt-2 truncate text-[24px] font-semibold tracking-tight">{video.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
            <span className="font-mono">{video.code}</span>·<span>{video.format}</span>·<span>{video.aspect}</span>·
            <span>{video.platform.join(", ")}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {video.versions.map((v) => (
            <button
              key={v.id}
              onClick={() => switchVersion(v.id)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition",
                v.id === version.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {v.label}
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  v.status === "approved" ? "bg-success" : v.status === "changes-requested" ? "bg-warning" : v.status === "sent" ? "bg-accent" : "bg-muted-foreground",
                )}
              />
              <span className="hidden text-[11px] font-normal opacity-70 sm:inline">{fmtDate(v.createdAt)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <ReviewPlayer
            video={video}
            version={version}
            time={time}
            duration={duration}
            playing={playing}
            speed={speed}
            comments={versionComments}
            activeCommentId={activeId}
            celebrate={celebrate}
            onToggle={toggle}
            onSeek={seek}
            onSpeed={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]!)}
            onMarker={selectComment}
          />

          {/* Decision bar */}
          <Card className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="font-medium">
                    Revisions used {video.revisionsUsed} of {allowance}
                  </span>
                  <span className="flex gap-1">
                    {Array.from({ length: allowance }).map((_, i) => (
                      <span key={i} className={cn("h-1.5 w-6 rounded-full", i < video.revisionsUsed ? "bg-accent" : "bg-muted")} />
                    ))}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-success" /> Corrections of our own mistakes never count against your allowance.
                </p>
              </div>

              {reviewable ? (
                <div className="flex shrink-0 gap-2">
                  <Tooltip content={openNotes.length ? `Send ${openNotes.length} note(s) to the team` : "Add at least one comment describing what to change"}>
                    <span>
                      <Button variant="outline" onClick={() => setChangesOpen(true)} disabled={openNotes.length === 0}>
                        <MessageSquareWarning /> Request changes
                      </Button>
                    </span>
                  </Tooltip>
                  <Button variant="success" onClick={() => setApproveOpen(true)}>
                    <CheckCircle2 /> Approve this version
                  </Button>
                </div>
              ) : (
                <StatusPill
                  tone={version.status === "approved" ? "success" : version.status === "changes-requested" ? "warning" : "neutral"}
                  text={
                    version.status === "approved"
                      ? `You approved ${version.label} · goes live ${fmtDate(video.publishDate)} at ${publishTimes[video.id] ?? "18:30"}`
                      : version.status === "changes-requested"
                        ? isLatest
                          ? "Changes requested — your team is preparing the next version"
                          : `Changes requested on ${version.label} · see ${latest.label}`
                        : approvedVersion
                          ? `${approvedVersion.label} is the approved version`
                          : "This version is not open for review"
                  }
                />
              )}
            </div>
          </Card>

          {version.status === "approved" && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="flex items-start gap-3 border-success/30 bg-success-soft p-4">
                <Sparkles className="mt-0.5 size-4 text-success" />
                <div className="text-[13px]">
                  <div className="font-medium text-success">Approval recorded</div>
                  <div className="mt-0.5 text-muted-foreground">
                    {PORTAL_USER.name} approved {version.label} ({version.duration}) exactly as shown. This exact file is locked for publishing — any later change needs a new
                    version and a new approval.
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          <div className="flex gap-2 rounded-xl bg-muted/60 p-3 text-[12.5px] text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {version.notes} · uploaded {fmtDate(version.createdAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}. Click the timeline to jump, or click a
              comment to see its exact frame.
            </span>
          </div>
        </div>

        <ReviewComments
          comments={versionComments}
          activeId={activeId}
          canComment={reviewable}
          currentTime={time}
          versionLabel={version.label}
          onSelect={selectComment}
          onPost={post}
        />
      </div>

      {/* Approve dialog */}
      <Dialog
        open={approveOpen}
        onOpenChange={(o) => {
          setApproveOpen(o);
          if (!o) setWatched(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {version.label}?</DialogTitle>
            <DialogDescription>{video.title}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/50 p-4 text-[13.5px] leading-relaxed">
              You are approving <span className="font-semibold">{version.label}</span> exactly as shown.{" "}
              <span className="font-semibold">Silence is not approval</span> — only this action publishes the video.
            </div>
            <ul className="space-y-1.5 text-[13px] text-muted-foreground">
              <li>• Duration {version.duration} · {video.aspect} · {video.platform.join(", ")}</li>
              <li>
                • Scheduled to go live {fmtDate(video.publishDate, { day: "numeric", month: "long" })} ({daysLabel(video.publishDate)})
              </li>
              {openNotes.length > 0 && <li className="text-warning">• {openNotes.length} open comment(s) on this version — approving means you accept it without those changes.</li>}
            </ul>
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
              <Checkbox checked={watched} onCheckedChange={(v) => setWatched(v === true)} />I have watched the full video
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveOpen(false)}>
              Not yet
            </Button>
            <Button variant="success" onClick={approve} disabled={!watched}>
              <CheckCircle2 /> Approve {version.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request changes dialog */}
      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send changes to your team</DialogTitle>
            <DialogDescription>
              {openNotes.length} note{openNotes.length === 1 ? "" : "s"} on {version.label} will be sent together as one revision round.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border p-3 text-[13px] scrollbar-thin">
              {openNotes.map((c) => (
                <li key={c.id} className="flex gap-2">
                  <span className="shrink-0 font-mono text-[11.5px] text-accent">{c.timestamp ?? "—"}</span>
                  <span className="text-muted-foreground">{c.text}</span>
                </li>
              ))}
            </ul>
            <div className={cn("rounded-xl p-3 text-[12.5px]", exceeds ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent")}>
              {exceeds ? (
                <>You&apos;ve used all {allowance} included rounds. We&apos;ll check your notes and send an estimate before doing any billable work.</>
              ) : (
                <>
                  If these are new preferences, this uses round {usedAfter} of {allowance}. If anything is our mistake, we fix it free and it won&apos;t count.
                </>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangesOpen(false)}>
              Keep reviewing
            </Button>
            <Button variant="default" onClick={sendChanges}>
              Send {openNotes.length} note{openNotes.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function daysLabel(date: string) {
  const d = Math.round((new Date(date).getTime() - new Date(TODAY).getTime()) / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 0) return "as soon as possible — original date has passed";
  return `in ${d} days`;
}

function StatusPill({ tone, text }: { tone: "success" | "warning" | "neutral"; text: string }) {
  return (
    <Badge tone={tone} className="h-8 shrink-0 px-3 text-[12.5px]" dot>
      {text}
    </Badge>
  );
}
