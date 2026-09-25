import { allNavItems } from "@/lib/nav";

export const FEEDBACK_TYPES = [
  { value: "change", label: "Change needed" },
  { value: "missing", label: "Missing feature" },
  { value: "bug", label: "Something is wrong" },
  { value: "question", label: "Question" },
  { value: "good", label: "Looks good" },
] as const;

export const FEEDBACK_PRIORITIES = [
  { value: "must", label: "Must have" },
  { value: "nice", label: "Nice to have" },
] as const;

export const FEEDBACK_STATUSES = [
  { value: "open", label: "Open" },
  { value: "planned", label: "Planned" },
  { value: "done", label: "Done" },
  { value: "wontdo", label: "Won't do" },
] as const;

export interface FeedbackRow {
  id: string;
  createdAt: string;
  name: string;
  page: string;
  module: string;
  role: string;
  type: string;
  priority: string;
  text: string;
  status: string;
}

export const labelOf = (list: readonly { value: string; label: string }[], v: string) => list.find((o) => o.value === v)?.label ?? v;

/** Module title for a pathname, using the same longest-prefix match as the breadcrumbs. */
export function moduleForPath(pathname: string) {
  if (pathname.startsWith("/portal")) return "Client Hub";
  if (pathname.startsWith("/feedback")) return "Feedback inbox";
  let best: { href: string; title: string } | undefined;
  for (const i of allNavItems)
    if ((i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(i.href + "/")) && (!best || i.href.length > best.href.length))
      best = i;
  return best?.title ?? "General";
}
