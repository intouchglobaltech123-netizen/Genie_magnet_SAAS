"use client";

import { useParams } from "next/navigation";
import { VideoDetail } from "@/features/production/detail/video-detail";

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <VideoDetail key={id} id={id} />;
}
