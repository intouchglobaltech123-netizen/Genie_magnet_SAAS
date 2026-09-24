import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { SubmissionStatus } from "./compute";

export const statusTone: Record<SubmissionStatus, BadgeTone> = {
  Submitted: "success",
  Late: "danger",
  Pending: "warning",
  Missed: "danger",
  "On leave": "info",
  Holiday: "neutral",
  Upcoming: "outline",
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <Badge tone={statusTone[status]} dot>
      {status}
    </Badge>
  );
}
