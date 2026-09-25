"use client";

import { PageHeader } from "@/components/shared/page-header";
import { TimeView } from "@/features/people/time/time-view";

export default function TimePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People & Resources"
        title="Time Tracking"
        description="Every hour classified and linked to a video code, so you can see what each reel really costs and where the week leaked into meetings and waiting."
        depth="preview"
        className="mb-0"
      />
      <TimeView />
    </div>
  );
}
