"use client";

import { PageHeader } from "@/components/shared/page-header";
import { LearningView } from "@/features/people/learning/learning-view";

export default function LearningPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People & Resources"
        title="Learning"
        description="Role-based training paths hosted on the Genie Magnet LMS, assignments with due dates, and a live skill matrix to spot single points of failure."
        depth="preview"
      />
      <LearningView />
    </div>
  );
}
