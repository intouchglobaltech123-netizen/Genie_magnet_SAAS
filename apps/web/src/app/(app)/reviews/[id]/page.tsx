"use client";

import { useParams } from "next/navigation";
import { MeetingWorkspace } from "@/features/management/reviews/workspace";

export default function ReviewWorkspacePage() {
  const params = useParams<{ id: string }>();
  return <MeetingWorkspace id={params.id} />;
}
