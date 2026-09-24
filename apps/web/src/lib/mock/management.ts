// Management system mock — Janarthanan's STOP review system:
//   S = Strategic  (full day, every 45 days: Completion · Competence development · Celebration · Creation)  — mandatory
//   T = Tactical   (2 hours, every 14 days: Completion · Coaching)
//   O = Operational (daily 10–15 min: Clarity)
//   + 7-day weekly agency review (numbers, delivery, clients)
// BT / BD = Breakthrough / Breakdown marking of action steps. Structure kept data-driven so cadences, agendas
// and data blocks can be re-configured once the client explains the exact system.

export type CadenceId = "daily" | "weekly" | "tactical" | "strategic";

export interface AgendaItem {
  title: string;
  minutes: number;
  note?: string;
}

export interface Cadence {
  id: CadenceId;
  name: string;
  every: string; // "Daily", "7-day"
  stop: "Operational" | "Weekly" | "Tactical" | "Strategic";
  letter: "O" | "W" | "T" | "S";
  focus: string[];
  purpose: string;
  duration: string;
  schedule: string;
  mandatory: boolean;
  facilitatorId: string;
  participantIds: string[];
  agenda: AgendaItem[];
  dataBlocks: string[];
}

const ALL = ["p-jana", "p-ashwin", "p-priya", "p-karthik", "p-vignesh", "p-divya", "p-surya", "p-meena", "p-harini", "p-naveen"];
const LEADS = ["p-jana", "p-ashwin", "p-priya", "p-karthik", "p-meena", "p-harini"];

export const cadences: Cadence[] = [
  {
    id: "daily",
    name: "Daily operational stand-up",
    every: "Daily",
    stop: "Operational",
    letter: "O",
    focus: ["Clarity"],
    purpose: "Everyone leaves knowing today's top priorities, who is blocked and what must move before evening.",
    duration: "15 min",
    schedule: "Mon–Sat · 9:30 AM · studio floor / Google Meet",
    mandatory: false,
    facilitatorId: "p-ashwin",
    participantIds: ALL.filter((p) => p !== "p-jana"),
    agenda: [
      { title: "Yesterday — done / not done", minutes: 5 },
      { title: "Today — top 3 per person", minutes: 5 },
      { title: "Blockers & who unblocks", minutes: 5 },
    ],
    dataBlocks: ["Videos due in 48h", "Shoots today & tomorrow", "Leave today", "Overdue client approvals"],
  },
  {
    id: "weekly",
    name: "Weekly agency review",
    every: "7-day",
    stop: "Weekly",
    letter: "W",
    focus: ["Numbers", "Delivery", "Clients"],
    purpose: "Look at the week's numbers and delivery, fix slippages early and decide next week's priorities.",
    duration: "60 min",
    schedule: "Every Monday · 10:00 AM",
    mandatory: false,
    facilitatorId: "p-ashwin",
    participantIds: LEADS,
    agenda: [
      { title: "Last week's commitments", minutes: 10 },
      { title: "Numbers: revenue, collections, leads", minutes: 15 },
      { title: "Delivery: on-time %, QC, revisions", minutes: 15 },
      { title: "Client health & risks", minutes: 10 },
      { title: "Next week priorities & commitments", minutes: 10 },
    ],
    dataBlocks: ["Revenue vs goal (week)", "Collections & overdue", "Leads & proposals", "On-time delivery", "QC first-pass", "Client health changes"],
  },
  {
    id: "tactical",
    name: "Tactical review",
    every: "14-day",
    stop: "Tactical",
    letter: "T",
    focus: ["Completion", "Coaching"],
    purpose: "Close the loop on every action step (BT/BD) and coach owners through breakdowns before they become misses.",
    duration: "2 hours",
    schedule: "Alternate Saturdays · 10:00 AM – 12:00 PM",
    mandatory: false,
    facilitatorId: "p-jana",
    participantIds: LEADS.concat(["p-divya"]),
    agenda: [
      { title: "Completion — action steps BT / BD", minutes: 45, note: "Every open commitment gets a Breakthrough or Breakdown mark" },
      { title: "Coaching — breakdowns & root causes", minutes: 45 },
      { title: "Numbers check vs goals", minutes: 15 },
      { title: "New action steps (owner + due date)", minutes: 15 },
    ],
    dataBlocks: ["Open commitments", "Goal progress", "SOP failures", "Capacity & utilisation"],
  },
  {
    id: "strategic",
    name: "Strategic review",
    every: "45-day",
    stop: "Strategic",
    letter: "S",
    focus: ["Completion", "Competence development", "Celebration", "Creation"],
    purpose: "Full-day reset: complete the last 45 days, grow people's competence, celebrate wins and create the next 45-day plan.",
    duration: "Full day",
    schedule: "Every 45 days · 10:00 AM – 6:00 PM · mandatory",
    mandatory: true,
    facilitatorId: "p-jana",
    participantIds: ALL,
    agenda: [
      { title: "Completion — previous commitments, BT / BD", minutes: 90 },
      { title: "Numbers — business snapshot", minutes: 75 },
      { title: "Competence development", minutes: 90 },
      { title: "Celebration — recognitions", minutes: 45 },
      { title: "Creation — goals & strategies for next 45 days", minutes: 120 },
      { title: "Decisions & commitments", minutes: 60 },
    ],
    dataBlocks: [
      "Revenue vs Business Aspiration",
      "Collections & DSO",
      "Delivery on-time %",
      "QC first-pass",
      "Capacity & utilisation",
      "Client risks (A/B/C/D)",
      "SOP failures",
      "Profitability by client",
    ],
  },
];

export const cadenceById = (id: CadenceId) => cadences.find((c) => c.id === id)!;

// ───────────────────────────── Meetings ─────────────────────────────

export interface Meeting {
  id: string;
  cadence: CadenceId;
  number: number;
  title: string;
  date: string; // ISO date-time of start
  end: string; // "18:00"
  venue: string;
  facilitatorId: string;
  attendeeIds: string[];
  status: "scheduled" | "today" | "completed" | "locked";
  lockedAt?: string;
  lockedBy?: string;
  stats?: { attended: number; decisions: number; bt: number; bd: number };
}

export const meetings: Meeting[] = [
  { id: "rv-s7", cadence: "strategic", number: 7, title: "45-Day Strategic Review #7", date: "2026-10-10T10:00:00", end: "18:00", venue: "Genie Magnet studio, Appakudal", facilitatorId: "p-jana", attendeeIds: ALL, status: "scheduled" },
  { id: "rv-t20", cadence: "tactical", number: 20, title: "Tactical Review #20", date: "2026-10-03T10:00:00", end: "12:00", venue: "Conference room", facilitatorId: "p-jana", attendeeIds: LEADS.concat(["p-divya"]), status: "scheduled" },
  { id: "rv-w39", cadence: "weekly", number: 39, title: "Weekly Agency Review · W40", date: "2026-09-28T10:00:00", end: "11:00", venue: "Conference room", facilitatorId: "p-ashwin", attendeeIds: LEADS, status: "scheduled" },
  { id: "rv-d0925", cadence: "daily", number: 0, title: "Daily Stand-up · Fri 25 Sep", date: "2026-09-25T09:30:00", end: "09:45", venue: "Studio floor + Meet", facilitatorId: "p-ashwin", attendeeIds: ALL.filter((p) => p !== "p-jana"), status: "today" },
  // past
  { id: "rv-w38", cadence: "weekly", number: 38, title: "Weekly Agency Review · W39", date: "2026-09-21T10:00:00", end: "11:05", venue: "Conference room", facilitatorId: "p-ashwin", attendeeIds: LEADS, status: "locked", lockedAt: "2026-09-21T11:20:00", lockedBy: "p-ashwin", stats: { attended: 6, decisions: 4, bt: 5, bd: 2 } },
  { id: "rv-t19", cadence: "tactical", number: 19, title: "Tactical Review #19", date: "2026-09-19T10:00:00", end: "12:10", venue: "Conference room", facilitatorId: "p-jana", attendeeIds: LEADS.concat(["p-divya"]), status: "locked", lockedAt: "2026-09-19T12:30:00", lockedBy: "p-jana", stats: { attended: 7, decisions: 5, bt: 6, bd: 3 } },
  { id: "rv-w37", cadence: "weekly", number: 37, title: "Weekly Agency Review · W38", date: "2026-09-14T10:00:00", end: "10:55", venue: "Conference room", facilitatorId: "p-ashwin", attendeeIds: LEADS, status: "locked", lockedAt: "2026-09-14T11:10:00", lockedBy: "p-ashwin", stats: { attended: 5, decisions: 3, bt: 4, bd: 1 } },
  { id: "rv-t18", cadence: "tactical", number: 18, title: "Tactical Review #18", date: "2026-09-05T10:00:00", end: "12:00", venue: "Conference room", facilitatorId: "p-jana", attendeeIds: LEADS.concat(["p-divya"]), status: "locked", lockedAt: "2026-09-05T12:15:00", lockedBy: "p-jana", stats: { attended: 7, decisions: 4, bt: 5, bd: 2 } },
  { id: "rv-s6", cadence: "strategic", number: 6, title: "45-Day Strategic Review #6", date: "2026-08-26T10:00:00", end: "18:00", venue: "Genie Magnet studio, Appakudal", facilitatorId: "p-jana", attendeeIds: ALL, status: "locked", lockedAt: "2026-08-26T18:40:00", lockedBy: "p-jana", stats: { attended: 10, decisions: 9, bt: 7, bd: 4 } },
  { id: "rv-s5", cadence: "strategic", number: 5, title: "45-Day Strategic Review #5", date: "2026-07-12T10:00:00", end: "17:30", venue: "Hotel Sivaranjani, Erode (offsite)", facilitatorId: "p-jana", attendeeIds: ALL, status: "locked", lockedAt: "2026-07-12T18:05:00", lockedBy: "p-jana", stats: { attended: 9, decisions: 8, bt: 5, bd: 5 } },
];

export const meetingById = (id: string) => meetings.find((m) => m.id === id);

export const NEXT_STRATEGIC = "rv-s7";
/** The next strategic after #7 — where unresolved commitments get carried. */
export const FOLLOWING_STRATEGIC_LABEL = "Strategic Review #8 · 24 Nov 2026";

// ───────────────────────────── Commitments ─────────────────────────────

export interface Commitment {
  id: string;
  text: string;
  ownerId: string;
  due: string;
  sourceMeetingId: string;
  reviewInMeetingId: string; // meeting where it will be marked BT/BD
  reviewedIn?: string[]; // earlier meetings that already reviewed it (carry-forward history)
  status: "open" | "done";
  carried: number;
  mark?: "BT" | "BD";
  markNote?: string;
  taskCreated?: boolean;
  createdAt: string;
}

export const seedCommitments: Commitment[] = [
  // From Strategic #6 → reviewed in Strategic #7
  { id: "cm-601", text: "Close Revathi Jewellers & Chandran Hospitals proposals (₹2.7L/yr combined)", ownerId: "p-jana", due: "2026-09-30", sourceMeetingId: "rv-s6", reviewInMeetingId: "rv-s7", status: "open", carried: 0, createdAt: "2026-08-26" },
  { id: "cm-602", text: "Recover Urban Nest ₹1.2L overdue — or pause further shoots", ownerId: "p-ashwin", due: "2026-09-15", sourceMeetingId: "rv-s6", reviewInMeetingId: "rv-s7", status: "open", carried: 1, createdAt: "2026-07-12" },
  { id: "cm-603", text: "Hire one Reels editor to take load off Divya (utilisation 108%)", ownerId: "p-harini", due: "2026-09-30", sourceMeetingId: "rv-s6", reviewInMeetingId: "rv-s7", status: "open", carried: 1, createdAt: "2026-07-12" },
  { id: "cm-604", text: "Roll out QC checklist v2 to all editors; first-pass target 85%", ownerId: "p-karthik", due: "2026-09-10", sourceMeetingId: "rv-s6", reviewInMeetingId: "rv-s7", status: "done", carried: 0, mark: "BT", markNote: "Live since 8 Sep; first-pass up from 74% → 81%", createdAt: "2026-08-26" },
  { id: "cm-605", text: "Kit checklist on app — zero missing items across next 4 shoots", ownerId: "p-vignesh", due: "2026-09-20", sourceMeetingId: "rv-s6", reviewInMeetingId: "rv-s7", status: "done", carried: 0, createdAt: "2026-08-26" },
  { id: "cm-606", text: "Propose Sri Lakshmi Silks renewal with 8% price increase", ownerId: "p-priya", due: "2026-09-28", sourceMeetingId: "rv-s6", reviewInMeetingId: "rv-s7", status: "open", carried: 0, createdAt: "2026-08-26" },
  { id: "cm-607", text: "Automate nightly NAS backup of all raw footage (Video Protection)", ownerId: "p-naveen", due: "2026-09-05", sourceMeetingId: "rv-s6", reviewInMeetingId: "rv-s7", status: "open", carried: 2, createdAt: "2026-05-28" },
  { id: "cm-608", text: "Publish SOP: classify every revision as agency correction / included / out-of-scope", ownerId: "p-ashwin", due: "2026-09-12", sourceMeetingId: "rv-s6", reviewInMeetingId: "rv-s7", status: "done", carried: 0, createdAt: "2026-08-26" },
  { id: "cm-609", text: "Generate 60 qualified leads in September from Meta + Google ads", ownerId: "p-priya", due: "2026-09-30", sourceMeetingId: "rv-s6", reviewInMeetingId: "rv-s7", status: "open", carried: 0, createdAt: "2026-08-26" },
  // From Tactical #19 → reviewed in Tactical #20
  { id: "cm-1901", text: "Agree 48-hour approval SLA with Dr. Arvind (Nova Dental)", ownerId: "p-ashwin", due: "2026-09-26", sourceMeetingId: "rv-t19", reviewInMeetingId: "rv-t20", status: "open", carried: 0, createdAt: "2026-09-19" },
  { id: "cm-1902", text: "Bring average reel edit time to ≤ 4.5 hours (template library)", ownerId: "p-divya", due: "2026-10-03", sourceMeetingId: "rv-t19", reviewInMeetingId: "rv-t20", status: "open", carried: 0, createdAt: "2026-09-19" },
  { id: "cm-1903", text: "Instagram content calendar for Oct approved by all 3 social clients", ownerId: "p-meena", due: "2026-09-27", sourceMeetingId: "rv-t19", reviewInMeetingId: "rv-t20", status: "open", carried: 0, createdAt: "2026-09-19" },
  { id: "cm-1904", text: "Complete DaVinci Resolve colour module 3", ownerId: "p-surya", due: "2026-09-22", sourceMeetingId: "rv-t19", reviewInMeetingId: "rv-t20", status: "done", carried: 0, createdAt: "2026-09-19" },
  // From Weekly W39 → reviewed in weekly W40
  { id: "cm-3801", text: "Chase Nova Dental August invoice (₹48,000 + GST)", ownerId: "p-ashwin", due: "2026-09-24", sourceMeetingId: "rv-w38", reviewInMeetingId: "rv-w39", status: "open", carried: 0, createdAt: "2026-09-21" },
  { id: "cm-3802", text: "Lock Kaveri testimonial shoot logistics (Chennai, 27 Sep)", ownerId: "p-karthik", due: "2026-09-24", sourceMeetingId: "rv-w38", reviewInMeetingId: "rv-w39", status: "done", carried: 0, createdAt: "2026-09-21" },
  { id: "cm-3803", text: "Send Balaji Textiles revised proposal after discount decision", ownerId: "p-priya", due: "2026-09-26", sourceMeetingId: "rv-w38", reviewInMeetingId: "rv-w39", status: "open", carried: 0, createdAt: "2026-09-21" },
  // Strategic #6 reviewed #5's commitments (frozen)
  { id: "cm-501", text: "Launch Business Aspiration FY 26-27 with quarterly break-up", ownerId: "p-jana", due: "2026-08-01", sourceMeetingId: "rv-s5", reviewInMeetingId: "rv-s6", status: "done", carried: 0, mark: "BT", markNote: "Shared in all-hands 29 Jul", createdAt: "2026-07-12" },
  { id: "cm-502", text: "Daily data sheet adoption — 100% of team for 30 days", ownerId: "p-harini", due: "2026-08-20", sourceMeetingId: "rv-s5", reviewInMeetingId: "rv-s6", status: "done", carried: 0, mark: "BT", markNote: "96% compliance; 2 misses on leave days", createdAt: "2026-07-12" },
  { id: "cm-503", text: "Collect Urban Nest dues before next shoot", ownerId: "p-ashwin", due: "2026-08-15", sourceMeetingId: "rv-s5", reviewInMeetingId: "rv-s6", status: "done", carried: 0, mark: "BD", markNote: "Client promised payment by 10 Sep — carried forward to Strategic #7 with a pause-work condition", createdAt: "2026-07-12" },
  { id: "cm-504", text: "Hire Reels editor", ownerId: "p-harini", due: "2026-08-20", sourceMeetingId: "rv-s5", reviewInMeetingId: "rv-s6", status: "done", carried: 0, mark: "BD", markNote: "2 candidates failed the test edit — carried forward to Strategic #7", createdAt: "2026-07-12" },
  { id: "cm-505", text: "Raise Kaveri retainer to ₹85K with 2 ad creatives", ownerId: "p-jana", due: "2026-08-01", sourceMeetingId: "rv-s5", reviewInMeetingId: "rv-s6", status: "done", carried: 0, mark: "BT", markNote: "Signed 30 Jul", createdAt: "2026-07-12" },
];

// ───────────────────────────── Numbers snapshot ─────────────────────────────

export interface SnapshotMetric {
  key: string;
  label: string;
  value: string;
  target?: string;
  progress?: number; // 0..100
  tone: "success" | "warning" | "danger" | "accent" | "info";
  detail: string;
  source: string;
}

export const snapshotS7: SnapshotMetric[] = [
  { key: "rev", label: "Revenue vs Business Aspiration", value: "₹51.8L", target: "₹53.0L goal YTD", progress: 98, tone: "warning", detail: "Q1 ₹24.6L of ₹25L · Q2 ₹27.2L of ₹28L (Sep MTD)", source: "Billing · invoiced revenue" },
  { key: "col", label: "Collections & DSO", value: "38 days", target: "≤ 30 days", progress: 72, tone: "warning", detail: "₹2.96L outstanding · Urban Nest ₹1.2L 32 days overdue", source: "Billing · receipts" },
  { key: "otd", label: "Delivery on-time", value: "87%", target: "95%", progress: 87, tone: "warning", detail: "58 of 67 videos on time in last 45 days · 4 client-caused delays", source: "Production · due vs approved dates" },
  { key: "qc", label: "QC first-pass", value: "81%", target: "≥ 85%", progress: 81, tone: "warning", detail: "Up from 74% after QC checklist v2 · top fail: audio levels", source: "Internal QC" },
  { key: "cap", label: "Capacity & utilisation", value: "92%", target: "80–90%", progress: 92, tone: "danger", detail: "Divya 108% · Surya 86% · freelancers absorbing 22% of edits", source: "Time tracking" },
  { key: "risk", label: "Client risks", value: "2 at risk", tone: "danger", detail: "Urban Nest (D · payment) · Nova Dental (C · slow approvals)", source: "Client health" },
  { key: "sop", label: "SOP failures", value: "5", target: "≤ 3", tone: "warning", detail: "VP backup late ×2 · kit item missed ×1 · spelling in export ×2", source: "SOPs & checklists" },
  { key: "margin", label: "Profitability", value: "24%", target: "≥ 30% contribution", progress: 80, tone: "accent", detail: "Best: Nova explainers 36% · Weakest: Sri Lakshmi reels (rework)", source: "True costing" },
];

export const snapshotS6: SnapshotMetric[] = [
  { key: "rev", label: "Revenue vs Business Aspiration", value: "₹33.7L", target: "₹34.0L goal YTD", progress: 99, tone: "success", detail: "Q1 ₹24.6L of ₹25L · Jul ₹9.1L of ₹9.0L", source: "Billing · invoiced revenue" },
  { key: "col", label: "Collections & DSO", value: "41 days", target: "≤ 30 days", progress: 68, tone: "danger", detail: "₹3.4L outstanding · Urban Nest first reminder sent", source: "Billing · receipts" },
  { key: "otd", label: "Delivery on-time", value: "84%", target: "95%", progress: 84, tone: "warning", detail: "51 of 61 videos on time", source: "Production" },
  { key: "qc", label: "QC first-pass", value: "74%", target: "≥ 85%", progress: 74, tone: "danger", detail: "Spelling and captions the biggest misses", source: "Internal QC" },
  { key: "cap", label: "Capacity & utilisation", value: "89%", target: "80–90%", progress: 89, tone: "warning", detail: "Divya 104% · freelancers 18% of edits", source: "Time tracking" },
  { key: "risk", label: "Client risks", value: "1 at risk", tone: "warning", detail: "Urban Nest (payment delays)", source: "Client health" },
  { key: "sop", label: "SOP failures", value: "8", target: "≤ 3", tone: "danger", detail: "Kit missed ×3 · VP late ×3 · wrong logo ×2", source: "SOPs & checklists" },
  { key: "margin", label: "Profitability", value: "22%", target: "≥ 30% contribution", progress: 73, tone: "warning", detail: "Long-form under-priced across 3 clients", source: "True costing" },
];

// ───────────────────────────── Strategic content ─────────────────────────────

export interface CompetenceItem {
  id: string;
  personId: string;
  skill: string;
  plan: string;
  due: string;
  progress: number;
}
export interface Recognition {
  id: string;
  personId: string;
  title: string;
  story: string;
  by: string;
}
export interface CreationGoal {
  id: string;
  title: string;
  ownerId: string;
  measure: string;
  due: string;
  type: "financial" | "functional" | "learning" | "operational";
}

export const competenceSeed: Record<string, CompetenceItem[]> = {
  "rv-s7": [
    { id: "cd-1", personId: "p-divya", skill: "Colour grading (DaVinci Resolve)", plan: "Finish modules 4–6; grade 2 Kaveri long-forms without Ajay", due: "2026-11-20", progress: 60 },
    { id: "cd-2", personId: "p-priya", skill: "Discovery calls & proposal close", plan: "Shadow Janarthanan on 3 calls; use SPIN checklist", due: "2026-11-10", progress: 35 },
    { id: "cd-3", personId: "p-harini", skill: "STAR interviewing", plan: "Run 4 interviews with scorecards; calibrate with Ashwin", due: "2026-10-30", progress: 50 },
    { id: "cd-4", personId: "p-vignesh", skill: "Drone licence (DGCA small category)", plan: "Complete RPTO course in Coimbatore", due: "2026-12-15", progress: 10 },
  ],
  "rv-s6": [
    { id: "cd-61", personId: "p-surya", skill: "Sound design for reels", plan: "Sathish to coach 2 sessions", due: "2026-09-30", progress: 100 },
    { id: "cd-62", personId: "p-meena", skill: "Meta ads manager", plan: "Blueprint certification", due: "2026-10-05", progress: 70 },
  ],
};

export const recognitionSeed: Record<string, Recognition[]> = {
  "rv-s7": [
    { id: "rc-1", personId: "p-vignesh", title: "Zero kit misses", story: "6 shoots in a row with the full 21-item kit checklist signed off — including the 6 AM Tiruppur site shoot.", by: "Karthik Subramanian" },
    { id: "rc-2", personId: "p-surya", title: "QC first-pass champion", story: "9 of 10 reels passed internal QC first time in September.", by: "Ashwin" },
    { id: "rc-3", personId: "p-priya", title: "Nirmala Cooking Academy won", story: "Converted an Instagram lead to a ₹40K/month personal-branding retainer in 11 days.", by: "Janarthanan" },
  ],
  "rv-s6": [
    { id: "rc-61", personId: "p-divya", title: "Founder-story edit", story: "Kaveri's founder story approved in v1 with zero changes.", by: "Janarthanan" },
    { id: "rc-62", personId: "p-harini", title: "Daily data sheet rollout", story: "96% compliance in the first month.", by: "Ashwin" },
  ],
};

export const creationSeed: Record<string, CreationGoal[]> = {
  "rv-s7": [
    { id: "cg-1", title: "Sign 2 new retainers worth ₹1.2L/month combined", ownerId: "p-jana", measure: "Signed agreements", due: "2026-11-24", type: "financial" },
    { id: "cg-2", title: "DSO down to 30 days", ownerId: "p-ashwin", measure: "Billing · DSO", due: "2026-11-24", type: "financial" },
    { id: "cg-3", title: "QC first-pass ≥ 85% for 4 consecutive weeks", ownerId: "p-karthik", measure: "Internal QC", due: "2026-11-24", type: "operational" },
  ],
  "rv-s6": [
    { id: "cg-61", title: "Q2 revenue ₹28L", ownerId: "p-jana", measure: "Invoiced revenue", due: "2026-09-30", type: "financial" },
    { id: "cg-62", title: "QC checklist v2 live", ownerId: "p-karthik", measure: "SOP published + used on 100% videos", due: "2026-09-10", type: "operational" },
  ],
};

export const notesSeed: Record<string, Record<number, string>> = {
  "rv-s6": {
    0: "Urban Nest and editor hiring carried forward for the second time — Janarthanan asked for weekly updates in the Monday review.",
    1: "Revenue on track; collections the real problem. DSO 41 days.",
    4: "Next 45 days: finish Q2 at ₹28L, fix QC first-pass, get Urban Nest to pay or pause.",
  },
};

export const auditSeed: Record<string, { at: string; by: string; reason: string; text: string }[]> = {
  "rv-s6": [
    { at: "2026-08-28T11:05:00", by: "Janarthanan", reason: "Wrong owner recorded", text: "Commitment “Publish revision SOP” owner changed from Karthik to Ashwin" },
  ],
};

// ───────────────────────────── Daily stand-up ─────────────────────────────

export interface StandupEntry {
  personId: string;
  yesterday: string;
  today: string;
  blockers: string;
  submitted: boolean;
}

export const standupSeed: StandupEntry[] = [
  { personId: "p-ashwin", yesterday: "Nova Dental SLA call scheduled; reviewed Sept cycle reconciliation", today: "Urban Nest payment call 11 AM · approve Oct shoot plan", blockers: "", submitted: true },
  { personId: "p-divya", yesterday: "Colour corrections on KVR-0926-05 (Diwali ad)", today: "BGM + text on KVR-0926-05 · send to QC by 5 PM", blockers: "Need 2 re-shot hamper product shots from Vignesh", submitted: true },
  { personId: "p-surya", yesterday: "KVR-0926-06 export for QC; SLS-0926-04 script read", today: "Fix QC notes on KVR-0926-06 (audio levels) · start UNR-0926-02 rough cut", blockers: "", submitted: true },
  { personId: "p-vignesh", yesterday: "Checked in Kaveri batch B kit (14/21 items at the time)", today: "Re-shoot 2 hamper product shots · pack single-cam kit for Chennai", blockers: "Remaining 7 kit items still with freelancer Gokul", submitted: true },
  { personId: "p-karthik", yesterday: "Chennai testimonial script locked; consent form sent", today: "Brief Vignesh on re-shoot · review SLS-0926-01 v2", blockers: "", submitted: true },
  { personId: "p-priya", yesterday: "Revathi Jewellers discovery call; Balaji discount note to founder", today: "Send LN Constructions proposal follow-up · 3 Meta leads to qualify", blockers: "Waiting on founder decision for Balaji 12% discount", submitted: true },
  { personId: "p-meena", yesterday: "Scheduled 6 Sri Lakshmi posts; Oct calendar draft", today: "Oct calendar review with Nova + BrightPath", blockers: "", submitted: false },
  { personId: "p-harini", yesterday: "Shortlisted 4 editor candidates", today: "Test edits to 2 candidates · attendance import from Hikvision", blockers: "", submitted: false },
  { personId: "p-naveen", yesterday: "On sick leave", today: "On sick leave (back 27 Sep)", blockers: "NAS backup automation paused", submitted: true },
];

// ───────────────────────────── Weekly review template ─────────────────────────────

export const weeklyTemplate = [
  {
    title: "Numbers",
    items: [
      { label: "Revenue invoiced (week)", value: "₹2.1L", sub: "Goal ₹2.3L", tone: "warning" as const },
      { label: "Collections (week)", value: "₹1.48L", sub: "4 receipts", tone: "success" as const },
      { label: "New qualified leads", value: "11", sub: "Goal 14", tone: "warning" as const },
      { label: "Proposals sent", value: "3", sub: "₹2.95L annual value", tone: "accent" as const },
    ],
  },
  {
    title: "Delivery",
    items: [
      { label: "Videos delivered", value: "14", sub: "of 16 due", tone: "success" as const },
      { label: "On-time", value: "88%", sub: "Goal 95%", tone: "warning" as const },
      { label: "QC first-pass", value: "83%", sub: "Goal 85%", tone: "warning" as const },
      { label: "Agency corrections", value: "2", sub: "Rework ₹1,380", tone: "danger" as const },
    ],
  },
  {
    title: "Clients",
    items: [
      { label: "Health changes", value: "Nova ↓ 64", sub: "Slow approvals", tone: "danger" as const },
      { label: "Renewals due (60 days)", value: "1", sub: "Sri Lakshmi · 31 Oct", tone: "accent" as const },
      { label: "Out-of-scope CRs", value: "1", sub: "₹18,000 awaiting client", tone: "info" as const },
      { label: "Overdue invoices", value: "2", sub: "₹1.68L", tone: "danger" as const },
    ],
  },
];
