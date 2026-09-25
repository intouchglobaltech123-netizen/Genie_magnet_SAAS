"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import type { ClientComment, Video, VideoVersion } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { fmtTs, parseTs } from "./lib";
import { posterGradient } from "./poster";

const captions = [
  "My grandfather pressed his first oil here in 1968.",
  "Back then, everything was done by hand — and slowly.",
  "We still use the same wooden ghani today.",
  "Three generations. One promise: nothing added, nothing removed.",
  "From our farm in Bhavani to your kitchen.",
];

export function ReviewPlayer({
  video,
  version,
  time,
  duration,
  playing,
  speed,
  comments,
  activeCommentId,
  celebrate,
  onToggle,
  onSeek,
  onSpeed,
  onMarker,
}: {
  video: Video;
  version: VideoVersion;
  time: number;
  duration: number;
  playing: boolean;
  speed: number;
  comments: ClientComment[];
  activeCommentId: string | null;
  celebrate: boolean;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onSpeed: () => void;
  onMarker: (c: ClientComment) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const vertical = video.aspect === "9:16" || video.aspect === "4:5";
  const progress = duration ? time / duration : 0;
  const caption = captions[Math.min(captions.length - 1, Math.floor(progress * captions.length))];

  const ratioFromEvent = (clientX: number) => {
    const r = barRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-black shadow-pop ring-1 ring-black/10">
      {/* Frame */}
      <div className="relative aspect-video w-full cursor-pointer select-none bg-black" onClick={onToggle}>
        <div
          className={cn("absolute overflow-hidden", vertical ? "inset-y-0 left-1/2 aspect-[9/16] -translate-x-1/2" : "inset-0")}
          style={{ background: posterGradient(video.id) }}
        >
          {/* slow "camera move" while playing */}
          <motion.div
            className="absolute inset-[-10%] bg-[radial-gradient(40%_30%_at_30%_40%,rgba(255,255,255,0.18),transparent_70%)]"
            animate={playing ? { x: ["0%", "6%", "-3%"], y: ["0%", "-4%", "2%"] } : {}}
            transition={{ duration: 12, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_110%,rgba(0,0,0,0.7),transparent)]" />
          {time > 0.5 && (
            <div className="absolute inset-x-[8%] bottom-[9%] text-center">
              <span className="rounded-md bg-black/55 px-2 py-1 text-body font-medium leading-relaxed text-white md:text-subheading">{caption}</span>
            </div>
          )}
        </div>

        {/* Review watermark */}
        <div className="pointer-events-none absolute right-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-md bg-black/40 px-2 py-1 font-mono text-body tracking-wide text-white/70">
          {video.code} · {version.label} · REVIEW COPY
        </div>

        <AnimatePresence>
          {!playing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="flex size-16 items-center justify-center rounded-full bg-white/95 text-black shadow-2xl">
                {time >= duration && duration > 0 ? <RotateCcw className="size-6" /> : <Play className="ml-1 size-7 fill-current" />}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{celebrate && <Burst />}</AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-2.5 text-white sm:gap-3 sm:px-4">
        <button type="button" onClick={onToggle} className="shrink-0 cursor-pointer rounded-md p-1 text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80" aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
        </button>
        <span className="shrink-0 whitespace-nowrap font-mono text-body tabular-nums text-white/80">
          {fmtTs(time)} <span className="text-white/40">/ {fmtTs(duration)}</span>
        </span>

        <div
          ref={barRef}
          className="group relative h-7 min-w-0 flex-1 cursor-pointer"
          onClick={(e) => onSeek(ratioFromEvent(e.clientX) * duration)}
          onMouseMove={(e) => setHoverX(ratioFromEvent(e.clientX))}
          onMouseLeave={() => setHoverX(null)}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/15 transition-all group-hover:h-1.5">
            <div className="h-full rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
          </div>
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
            style={{ left: `${progress * 100}%` }}
          />
          {hoverX !== null && (
            <div
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md bg-white px-1.5 py-0.5 font-mono text-body leading-4 text-black"
              style={{ left: `${hoverX * 100}%` }}
            >
              {fmtTs(hoverX * duration)}
            </div>
          )}
          {comments
            .filter((c) => c.timestamp)
            .map((c) => {
              const left = Math.min(100, (parseTs(c.timestamp) / (duration || 1)) * 100);
              const active = c.id === activeCommentId;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`Comment at ${c.timestamp} by ${c.author}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarker(c);
                  }}
                  title={`${c.timestamp} · ${c.author}`}
                  className={cn(
                    "absolute -bottom-1.5 flex size-4 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full text-body font-bold leading-none ring-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
                    active ? "z-10 scale-125 bg-primary text-white ring-white" : c.resolved ? "bg-white/30 text-black ring-black/60" : "bg-warning text-black ring-black/60 hover:scale-110",
                  )}
                  style={{ left: `${left}%` }}
                >
                  {initials(c.author).slice(0, 1)}
                </button>
              );
            })}
        </div>

        <button type="button" onClick={onSpeed} aria-label={`Playback speed ${speed}×`} className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 font-mono text-body text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80">
          {speed}×
        </button>
        <Volume2 className="hidden size-4 shrink-0 text-white/60 sm:block" aria-hidden />
      </div>
    </div>
  );
}

function Burst() {
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  const colors = ["var(--color-success)", "var(--color-primary)", "var(--color-accent)", "white"];
  return (
    <motion.div className="pointer-events-none absolute inset-0" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {pieces.map((i) => {
        const angle = (i / pieces.length) * Math.PI * 2;
        const dist = 120 + (i % 5) * 28;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 block size-2 rounded-sm"
            style={{ background: colors[i % colors.length] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist + 40, opacity: 0, rotate: 180 + i * 20 }}
            transition={{ duration: 1.3, ease: "easeOut" }}
          />
        );
      })}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <span className="rounded-full bg-success px-4 py-2 text-body font-semibold text-white shadow-2xl">Approved</span>
      </motion.div>
    </motion.div>
  );
}
