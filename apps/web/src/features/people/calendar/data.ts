import { addDays, format, parseISO } from "date-fns";
import { clientById, personById, shoots, videos } from "@/lib/mock/core";
import { holidayByDate, holidays, leaveRequests } from "@/lib/mock/people";

export type EventType = "shoot" | "meeting" | "leave" | "publish" | "holiday";

export interface CalEvent {
  id: string;
  type: EventType;
  title: string;
  date: string; // yyyy-MM-dd
  start?: string; // HH:mm — omitted = all-day
  end?: string;
  location?: string;
  people?: string[];
  notes?: string;
  locked?: boolean;
  status?: string;
}

export const typeMeta: Record<EventType, { label: string; color: string }> = {
  shoot: { label: "Shoots", color: "var(--chart-1)" },
  meeting: { label: "Meetings", color: "var(--chart-2)" },
  leave: { label: "Leave", color: "var(--chart-4)" },
  publish: { label: "Publish dates", color: "var(--chart-3)" },
  holiday: { label: "Holidays", color: "var(--gold)" },
};

export const EVENT_TYPES = Object.keys(typeMeta) as EventType[];

const addHours = (t: string, h: number) => {
  const [hh, mm] = t.split(":").map(Number);
  const total = hh! * 60 + mm! + h * 60;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

function buildEvents(): CalEvent[] {
  const out: CalEvent[] = [];

  for (const s of shoots) {
    const locked = s.id === "sh-09" || s.status === "packed";
    out.push({
      id: `ev-${s.id}`,
      type: "shoot",
      title: s.projectName,
      date: s.date,
      start: s.callTime,
      end: addHours(s.callTime, s.kit === "dual" ? 6 : 4),
      location: s.location,
      people: [personById(s.cameraId).name, personById(s.directorId).name],
      notes: `Batch ${s.batchNo} · ${s.kit === "dual" ? "Dual-camera" : "Single-camera"} kit · ${s.videoIds.length} video${s.videoIds.length > 1 ? "s" : ""}${s.notes ? ` · ${s.notes}` : ""}`,
      locked,
      status: s.status,
    });
  }

  // Recurring meetings, Sep – Dec 2026
  let d = parseISO("2026-08-31");
  const endD = parseISO("2026-12-31");
  while (d <= endD) {
    const iso = format(d, "yyyy-MM-dd");
    const dow = d.getDay();
    if (dow !== 0 && !holidayByDate(iso)) {
      out.push({
        id: `ev-standup-${iso}`,
        type: "meeting",
        title: "Daily standup",
        date: iso,
        start: "09:30",
        end: "09:45",
        location: "Studio floor, Appakudal",
        people: ["Whole team"],
        notes: "Yesterday / today / blockers. Hard stop at 9:45.",
      });
    }
    if (dow === 1 && !holidayByDate(iso)) {
      out.push({
        id: `ev-weekly-${iso}`,
        type: "meeting",
        title: "Weekly review",
        date: iso,
        start: "17:00",
        end: "18:00",
        location: "Conference room",
        people: ["Janarthanan", "Ashwin", "Karthik Subramanian", "Priya Venkatesh", "Meena Ravi"],
        notes: "Deliveries vs promise, client health, next week's shoots.",
      });
    }
    d = addDays(d, 1);
  }

  for (const t of ["2026-09-15", "2026-09-29", "2026-10-13", "2026-10-27", "2026-11-10", "2026-11-24"]) {
    out.push({
      id: `ev-tactical-${t}`,
      type: "meeting",
      title: "14-day tactical review",
      date: t,
      start: "15:00",
      end: "16:30",
      location: "Conference room",
      people: ["Janarthanan", "Ashwin", "Karthik Subramanian", "Priya Venkatesh"],
      notes: "Sprint scorecard, capacity, overdue videos and receivables.",
    });
  }

  out.push({
    id: "ev-strategic-2026-10-10",
    type: "meeting",
    title: "45-day strategic review",
    date: "2026-10-10",
    start: "10:00",
    end: "13:00",
    location: "Offsite — Hotel Sakthi, Erode",
    people: ["Janarthanan", "Ashwin", "Karthik Subramanian", "Priya Venkatesh", "Harini Selvam"],
    notes: "Q3 goals, pricing, hiring plan. Founder-locked: this date cannot be moved.",
    locked: true,
  });

  for (const r of leaveRequests.filter((x) => x.status !== "rejected")) {
    let ld = parseISO(r.from);
    const le = parseISO(r.to);
    while (ld <= le) {
      const iso = format(ld, "yyyy-MM-dd");
      out.push({
        id: `ev-${r.id}-${iso}`,
        type: "leave",
        title: `${personById(r.personId).name.split(" ")[0]} — ${r.type}${r.status === "pending" ? " (pending)" : ""}`,
        date: iso,
        people: [personById(r.personId).name],
        notes: r.reason,
        status: r.status,
      });
      ld = addDays(ld, 1);
    }
  }

  for (const v of videos) {
    out.push({
      id: `ev-pub-${v.id}`,
      type: "publish",
      title: `${v.code} publish`,
      date: v.publishDate,
      people: [personById(v.editorId).name],
      notes: `${v.title} · ${clientById(v.clientId).name} · ${v.platform.join(", ")} · stage: ${v.stage}`,
      status: v.stage,
    });
  }

  for (const h of holidays) {
    out.push({ id: `ev-hol-${h.date}`, type: "holiday", title: h.name, date: h.date, notes: `${h.kind} holiday — office closed` });
  }

  return out;
}

export const seedEvents = buildEvents();
