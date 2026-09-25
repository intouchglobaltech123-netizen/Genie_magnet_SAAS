"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, FileImage, Mic, Paperclip, Pause, Play, Send, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { ClientComment } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { fmtTs } from "./lib";

const ATTACH_OPTIONS = ["reference-shot_mill.jpg", "brand-colours_v3.pdf", "hamper-packshot.png"];

export function ReviewComments({
  comments,
  activeId,
  canComment,
  currentTime,
  versionLabel,
  onSelect,
  onPost,
}: {
  comments: ClientComment[];
  activeId: string | null;
  canComment: boolean;
  currentTime: number;
  versionLabel: string;
  onSelect: (c: ClientComment) => void;
  onPost: (c: { text: string; kind: "text" | "voice"; timestamp?: string }) => void;
}) {
  const [text, setText] = useState("");
  const [pinTime, setPinTime] = useState(true);
  const [recording, setRecording] = useState<number | null>(null); // seconds elapsed
  const [voice, setVoice] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    listRef.current?.querySelector(`[data-comment="${activeId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  const startRecording = () => {
    setRecording(0);
    let elapsed = 0;
    timer.current = setInterval(() => {
      elapsed += 1;
      if (elapsed >= 3) {
        if (timer.current) clearInterval(timer.current);
        setRecording(null);
        setVoice("0:03");
        toast.success("Voice note recorded", { description: "Add a line of text if you like, then post." });
      } else setRecording(elapsed);
    }, 1000);
  };

  const cancelRecording = () => {
    if (timer.current) clearInterval(timer.current);
    setRecording(null);
  };

  const attach = () => {
    const file = ATTACH_OPTIONS[comments.length % ATTACH_OPTIONS.length]!;
    setAttachment(file);
    toast("File attached", { description: file });
  };

  const post = () => {
    if (!text.trim() && !voice) return;
    let body = text.trim();
    if (voice) body = `Voice note (${voice})${body ? ` — ${body}` : ""}`;
    if (attachment) body = `${body} [Attached: ${attachment}]`;
    onPost({ text: body, kind: voice ? "voice" : "text", timestamp: pinTime ? fmtTs(currentTime) : undefined });
    setText("");
    setVoice(null);
    setAttachment(null);
  };

  const sorted = [...comments].sort((a, b) => (a.timestamp ?? "99").localeCompare(b.timestamp ?? "99"));
  const open = comments.filter((c) => !c.resolved).length;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-body font-semibold">Comments on {versionLabel}</div>
          <div className="text-body text-muted-foreground">
            {comments.length} total · {open} open
          </div>
        </div>
        <Badge tone="outline">
          <Clock /> Timecoded
        </Badge>
      </div>

      <div ref={listRef} className="scrollbar-thin min-h-[220px] flex-1 space-y-1 overflow-y-auto p-2 lg:max-h-[440px]">
        {sorted.length === 0 && (
          <div className="px-4 py-10 text-center text-body text-muted-foreground">
            No comments yet. Pause anywhere and leave a note — it will be pinned to that exact moment.
          </div>
        )}
        <AnimatePresence initial={false}>
          {sorted.map((c) => (
            <motion.button
              layout
              key={c.id}
              data-comment={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onSelect(c)}
              className={cn(
                "flex w-full cursor-pointer gap-3 rounded-xl p-3 text-left transition",
                c.id === activeId ? "bg-primary-soft ring-1 ring-primary/30" : "hover:bg-muted/70",
                c.resolved && "opacity-70",
              )}
            >
              <Avatar name={c.author} size="sm" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-body font-medium">{c.author}</span>
                  {c.timestamp && (
                    <span className="rounded bg-muted px-1.5 font-mono text-body text-primary">{c.timestamp}</span>
                  )}
                  <span className="ml-auto text-body text-muted-foreground">{fmtDate(c.at)}</span>
                </div>
                {c.kind === "voice" ? <VoiceNote text={c.text} /> : <p className="mt-1 text-body leading-relaxed">{c.text}</p>}
                {c.resolved && (
                  <Badge tone="success" className="mt-1.5">
                    Addressed in next version
                  </Badge>
                )}
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <div className="border-t border-border p-3">
        {!canComment ? (
          <p className="px-1 py-2 text-body text-muted-foreground">Commenting is closed for this version. Switch to the latest version to add notes.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPinTime((p) => !p)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 font-mono text-body transition",
                  pinTime ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground line-through",
                )}
              >
                <Clock className="size-3" /> {fmtTs(currentTime)}
              </button>
              <span className="text-body text-muted-foreground">{pinTime ? "Pinned to current frame" : "General comment"}</span>
            </div>

            {recording !== null ? (
              <div className="flex h-[76px] items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft px-3">
                <span className="relative flex size-3">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" />
                  <span className="relative inline-flex size-3 rounded-full bg-danger" />
                </span>
                <span className="font-mono text-body text-danger">0:0{recording}</span>
                <Bars active className="text-danger" />
                <Button size="xs" variant="ghost" className="ml-auto" onClick={cancelRecording}>
                  <Square className="!size-3" /> Cancel
                </Button>
              </div>
            ) : (
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post();
                }}
                placeholder="What should change at this moment?"
                className="min-h-[76px] resize-none"
              />
            )}

            {(voice || attachment) && (
              <div className="flex flex-wrap gap-1.5">
                {voice && (
                  <Chip onRemove={() => setVoice(null)}>
                    <Mic className="size-3" /> Voice note · {voice}
                  </Chip>
                )}
                {attachment && (
                  <Chip onRemove={() => setAttachment(null)}>
                    <FileImage className="size-3" /> {attachment}
                  </Chip>
                )}
              </div>
            )}

            <div className="flex items-center gap-1">
              <Button size="xs" variant="ghost" onClick={startRecording} disabled={recording !== null || !!voice}>
                <Mic className="!size-3.5" /> Record voice note
              </Button>
              <Button size="xs" variant="ghost" onClick={attach} disabled={!!attachment}>
                <Paperclip className="!size-3.5" /> Attach
              </Button>
              <Button size="sm" variant="accent" className="ml-auto" onClick={post} disabled={!text.trim() && !voice}>
                <Send /> Post
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-body">
      {children}
      <button onClick={onRemove} className="cursor-pointer text-muted-foreground hover:text-foreground" aria-label="Remove">
        <X className="size-3" />
      </button>
    </span>
  );
}

function Bars({ active, className }: { active: boolean; className?: string }) {
  const heights = [6, 12, 18, 10, 16, 8, 14, 20, 9, 15, 7, 12, 17, 10];
  return (
    <span className={cn("flex h-5 items-center gap-[2px]", className)}>
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className="w-[2.5px] rounded-full bg-current"
          initial={{ height: h * 0.6 }}
          animate={active ? { height: [h * 0.4, h, h * 0.5] } : { height: h * 0.6 }}
          transition={active ? { duration: 0.6 + (i % 4) * 0.1, repeat: Infinity, repeatType: "mirror" } : {}}
        />
      ))}
    </span>
  );
}

function VoiceNote({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);
  const m = text.match(/^Voice note(?: \(([\d:]+)\))?(?::| —)?\s*(.*)$/);
  const duration = m?.[1] ?? "0:08";
  const rest = m?.[2] ?? text;
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playing) return setPlaying(false);
    setPlaying(true);
    setTimeout(() => setPlaying(false), 3000);
  };
  return (
    <div className="mt-1.5 space-y-1.5">
      <span
        role="button"
        tabIndex={0}
        onClick={toggle}
        className="inline-flex items-center gap-2 rounded-full bg-muted py-1 pl-1 pr-3 text-primary"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-white">
          {playing ? <Pause className="size-3 fill-current" /> : <Play className="ml-0.5 size-3 fill-current" />}
        </span>
        <Bars active={playing} />
        <span className="font-mono text-body text-muted-foreground">{duration}</span>
      </span>
      {rest && <p className="text-body leading-relaxed text-muted-foreground">{rest}</p>}
    </div>
  );
}
