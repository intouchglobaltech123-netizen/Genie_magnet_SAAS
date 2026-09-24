"use client";

import { PageHeader } from "@/components/shared/page-header";
import { AttendanceView } from "@/features/people/attendance/attendance-view";

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People & Resources"
        title="Attendance & Leave"
        description="Biometric punches from the Hikvision terminal, field attendance from shoot sheets, and leave approvals that check the production calendar before you say yes."
        depth="preview"
      />
      <AttendanceView />
    </div>
  );
}
