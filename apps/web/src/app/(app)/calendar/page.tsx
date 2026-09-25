"use client";

import { PageHeader } from "@/components/shared/page-header";
import { CalendarView } from "@/features/people/calendar/calendar-view";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People & Resources"
        title="Company calendar"
        description="Shoots, reviews, leave, publish dates and holidays in one place. Locked events can't be moved — leave that collides with them needs a founder exception."
        depth="preview"
        className="mb-0"
      />
      <CalendarView />
    </div>
  );
}
