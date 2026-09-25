import { Play } from "lucide-react";
import type { Video } from "@/lib/types";
import { cn } from "@/lib/utils";

// Poster art is "image content" — fixed colours so it reads like a real frame in both themes.
const gradients = [
  ["#1f3b2c", "#5b7f3a", "#d8b45a"], // field green → harvest gold
  ["#2b1d14", "#8a4b1f", "#f0a64a"], // oil amber
  ["#172235", "#2e5a7a", "#9fc6d9"], // dawn blue
  ["#2a1830", "#7a3558", "#f08a6a"], // silk rose
  ["#141d1a", "#2f6b5c", "#c7e1a4"], // leaf
  ["#221a10", "#6b5a2a", "#e8d9a0"], // millet
];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function posterGradient(id: string) {
  const g = gradients[hash(id) % gradients.length]!;
  return `radial-gradient(120% 90% at 78% 18%, ${g[2]}55 0%, transparent 55%), linear-gradient(135deg, ${g[0]} 0%, ${g[1]} 62%, ${g[2]} 130%)`;
}

export function Poster({
  video,
  className,
  showPlay = true,
  showMeta = true,
  size = "md",
}: {
  video: Pick<Video, "id" | "title" | "format" | "aspect" | "code">;
  className?: string;
  showPlay?: boolean;
  showMeta?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const vertical = video.aspect === "9:16" || video.aspect === "4:5";
  return (
    <div className={cn("relative isolate overflow-hidden bg-black", className)}>
      <div className="absolute inset-0" style={{ background: posterGradient(video.id) }} />
      {/* soft light leak + vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_120%,rgba(0,0,0,0.65),transparent)]" />
      {vertical && (
        <div className="absolute inset-y-[10%] left-1/2 aspect-[9/16] -translate-x-1/2 rounded-md border border-white/15 bg-white/5 backdrop-blur-[1px]" />
      )}
      {showMeta && (
        <div className={cn("absolute left-3 top-3 flex gap-1.5", size === "sm" && "hidden")}>
          <span className="rounded-md bg-black/45 px-1.5 py-0.5 text-body font-medium text-white/90 backdrop-blur">{video.format}</span>
          <span className="rounded-md bg-black/45 px-1.5 py-0.5 font-mono text-body text-white/80 backdrop-blur">{video.aspect}</span>
        </div>
      )}
      {showPlay && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition group-hover:scale-105",
              size === "sm" ? "size-8" : size === "lg" ? "size-16" : "size-11",
            )}
          >
            <Play className={cn("fill-current", size === "sm" ? "size-3.5" : size === "lg" ? "size-6" : "size-4.5")} />
          </span>
        </div>
      )}
      {showMeta && size !== "sm" && (
        <div className="absolute inset-x-3 bottom-3 truncate text-body font-medium text-white/85 drop-shadow">{video.title}</div>
      )}
    </div>
  );
}
