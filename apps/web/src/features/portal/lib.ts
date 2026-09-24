import { agreementById } from "@/lib/mock/core";
import { PORTAL_CLIENT_ID } from "@/lib/mock/portal";
import type { Video } from "@/lib/types";

/** "01:23" → 83 */
export function parseTs(ts?: string) {
  if (!ts) return 0;
  const [m, s] = ts.split(":").map(Number);
  return (m ?? 0) * 60 + (s ?? 0);
}

/** 83 → "01:23" */
export function fmtTs(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function allowanceFor(video: Pick<Video, "agreementId">) {
  return agreementById(video.agreementId)?.revisionsPerDeliverable ?? 2;
}

export function portalVideos(videos: Video[]) {
  return videos.filter((v) => v.clientId === PORTAL_CLIENT_ID);
}

export function latestVersion(video: Video) {
  return video.versions.at(-1);
}

export const firstName = (name: string) => name.split(" ")[0] ?? name;
