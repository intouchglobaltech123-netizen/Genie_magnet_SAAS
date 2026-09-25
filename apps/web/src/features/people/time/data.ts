export const CATEGORIES = ["Production", "Meeting", "Revision", "Travel", "Training", "Client waiting", "Internal"] as const;
export type Category = (typeof CATEGORIES)[number];

export const catMeta: Record<Category, { tone: "accent" | "info" | "gold" | "warning" | "success" | "danger" | "neutral"; color: string; productive: boolean }> = {
  Production: { tone: "accent", color: "var(--color-primary)", productive: true },
  Revision: { tone: "gold", color: "var(--color-chart-3)", productive: true },
  Meeting: { tone: "info", color: "var(--color-info)", productive: false },
  Travel: { tone: "warning", color: "var(--color-warning)", productive: false },
  Training: { tone: "success", color: "var(--color-success)", productive: false },
  "Client waiting": { tone: "danger", color: "var(--color-danger)", productive: false },
  Internal: { tone: "neutral", color: "var(--color-chart-5)", productive: false },
};

export type EntryStatus = "Draft" | "Submitted" | "Approved" | "Rejected";

export interface TimeEntry {
  id: string;
  personId: string;
  date: string;
  category: Category;
  hours: number;
  videoCode?: string;
  note: string;
  status: EntryStatus;
}

export const WEEK = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"];

export const TIME_PEOPLE = ["p-divya", "p-surya", "f-rahul", "p-karthik", "p-vignesh", "p-meena", "p-priya", "p-ashwin"];

export const VIDEO_CODES = [
  "KVR-0926-04", "KVR-0926-05", "KVR-0926-06", "KVR-0926-07", "KVR-0926-08",
  "SLS-0926-01", "SLS-0926-03", "SLS-0926-04",
  "NVD-0926-01", "NVD-0926-02", "NVD-0926-03",
  "BPA-0926-02", "UNR-0926-01", "UNR-0926-02",
];

type Row = [Category, number, string | null, string];

/** Hand-written week, Mon 21 → Fri 25 (index 0..4). */
const plan: Record<string, Row[][]> = {
  "p-divya": [
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 5, "KVR-0926-04", "Founder story — fine cut, interview trims"], ["Revision", 3, "SLS-0926-01", "Navaratri drop — client v1 notes"], ["Internal", 0.75, null, "Project folder cleanup"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 6.5, "KVR-0926-04", "B-rolls + archival photo pans"], ["Revision", 2.5, "SLS-0926-01", "Swap BGM, tighten intro"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 6, "KVR-0926-05", "Diwali hamper ad — rough cut"], ["Client waiting", 1.5, "KVR-0926-04", "Waiting for Ramesh's approval on archival photos"], ["Production", 1.5, "KVR-0926-04", "Colour pass v1"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 6.5, "KVR-0926-05", "Colour corrections + product supers"], ["Revision", 2.5, "SLS-0926-01", "v2 caption fixes"], ["Training", 0.5, null, "Reviewed Surya's DaVinci module"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Revision", 4, "SLS-0926-01", "Final Navaratri master — due today"], ["Production", 4.5, "KVR-0926-05", "Transitions, BGM, spelling pass"]],
  ],
  "p-surya": [
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 5.5, "KVR-0926-06", "Myth-buster reel edit"], ["Production", 2, "NVD-0926-01", "Root canal explainer — caption pass"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 4, "KVR-0926-06", "Motion text + Tamil subtitles"], ["Training", 2, null, "LMS: DaVinci colour basics (module 2)"], ["Client waiting", 1.5, "NVD-0926-01", "Doctor approval pending"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 6, "UNR-0926-02", "Drone reel — selects + rough cut"], ["Internal", 1.5, null, "Proxy generation for Kaveri batch B"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 5, "UNR-0926-02", "Speed ramps + sound design"], ["Revision", 2.5, "KVR-0926-06", "QC fixes — audio levels"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 6, "KVR-0926-06", "Final export + QC handoff"]],
  ],
  "f-rahul": [
    [["Production", 7, "UNR-0926-01", "Green Meadows walkthrough — revision edit"]],
    [["Revision", 6, "UNR-0926-01", "Floor-plan graphics placeholders (CR pending)"], ["Client waiting", 2, "UNR-0926-01", "Waiting for CR approval from Vikram"]],
    [["Production", 7.5, "SLS-0926-03", "Bridal trousseau — assembly cut"]],
    [["Production", 8, "SLS-0926-03", "Trousseau — B-roll and music"]],
    [["Production", 6, "NVD-0926-02", "Aligners vs braces — first cut"], ["Production", 2, "BPA-0926-02", "Faculty long-form QC fixes"]],
  ],
  "p-karthik": [
    [["Meeting", 1.25, null, "Standup + weekly review"], ["Production", 4, "KVR-0926-08", "Testimonial script + question bank"], ["Internal", 2, null, "October content plan — Kaveri & Nova"], ["Meeting", 1, null, "Weekly review prep"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 3, "SLS-0926-04", "Weaver spotlight — scripting"], ["Revision", 2, "SLS-0926-01", "Director review of v2"], ["Internal", 2.5, null, "Freelancer briefing — Rahul, Sneha"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 5, "NVD-0926-03", "Smile makeover — shot list"], ["Meeting", 2, null, "Nova Dental monthly call"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 4, "KVR-0926-05", "Director QC — Diwali ad"], ["Training", 1.5, null, "Coached Surya on pacing"], ["Internal", 2, null, "Shoot call-sheet for Chennai"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 5, "KVR-0926-04", "Founder story — final director pass"], ["Internal", 2, null, "Hiring: editor trial task review"]],
  ],
  "p-vignesh": [
    [["Meeting", 0.25, null, "Daily standup"], ["Internal", 3, null, "Kit maintenance — sensor cleaning, battery cycle"], ["Production", 3, "KVR-0926-07", "Offload + VP backup, sunrise B-roll"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 4, "KVR-0926-05", "Pick-up product shots (re-shoot)"], ["Training", 2, null, "LMS: Drone safety & DGCA rules"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Internal", 2, null, "Studio lighting reset"], ["Production", 4, "NVD-0926-03", "Recce photos — Nova clinic"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Travel", 3, "KVR-0926-08", "Appakudal → Erode, client handover"], ["Production", 3, "KVR-0926-08", "Consent forms + kit pack for Chennai"]],
    [["Travel", 4.5, "KVR-0926-08", "Travel to Chennai (Anna Nagar recce)"], ["Production", 4, "KVR-0926-08", "Location recce + lighting test"]],
  ],
  "p-meena": [
    [["Meeting", 1.25, null, "Standup + weekly review"], ["Production", 4, null, "Kaveri Oct calendar — 24 posts"], ["Internal", 2, null, "Instagram insights export"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 5, "KVR-0926-03", "Millet reel — captions, hashtags, schedule"], ["Client waiting", 1.5, null, "Sri Lakshmi — waiting for Navaratri offer copy"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 4, null, "Sri Lakshmi — carousel brief to Lavanya"], ["Training", 2.5, null, "LMS: Meta Ads — boosting reels"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 5.5, null, "Nova Dental — community replies + DMs"], ["Internal", 1.5, null, "Monthly report template"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Production", 6, "SLS-0926-01", "Navaratri drop — publish + boost setup"]],
  ],
  "p-priya": [
    [["Meeting", 1.25, null, "Standup + weekly review"], ["Internal", 5, null, "Lead follow-ups — 11 calls"], ["Travel", 1.5, null, "Visit — Balaji Textiles, Erode"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Meeting", 2, null, "Proposal walk-through — Balaji Textiles"], ["Internal", 5, null, "Proposal + pricing for 2 leads"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Internal", 4, null, "CRM hygiene, BNI referrals"], ["Travel", 3, null, "BNI chapter meeting, Tiruppur"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Internal", 6, null, "Discount approval note, lead scoring"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Internal", 5, null, "BrightPath renewal deck"], ["Training", 1, null, "LMS: Handling discount requests"]],
  ],
  "p-ashwin": [
    [["Meeting", 2.25, null, "Standup + weekly review + prep"], ["Internal", 5, null, "Capacity plan — Oct shoots"]],
    [["Meeting", 1.25, null, "Standup + Urban Nest escalation call"], ["Internal", 4, null, "Invoice follow-ups (Urban Nest, Nova)"], ["Revision", 2, "UNR-0926-01", "CR scoping — floor-plan graphics"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Internal", 6, null, "Vendor payments, freelancer POs"]],
    [["Meeting", 1.25, null, "Standup + leave conflict review"], ["Internal", 5.5, null, "Tactical review pack (29 Sep)"]],
    [["Meeting", 0.25, null, "Daily standup"], ["Internal", 6, null, "Month-end reconciliation — Kaveri cycle"]],
  ],
};

function statusFor(personId: string, dayIdx: number, i: number): EntryStatus {
  if (dayIdx <= 2) {
    if (personId === "f-rahul" && dayIdx === 1 && i === 1) return "Rejected"; // client waiting logged against revision budget
    return "Approved";
  }
  if (dayIdx === 3) return "Submitted";
  if (personId === "p-divya" || personId === "p-karthik") return "Draft";
  return "Submitted";
}

export const seedEntries: TimeEntry[] = Object.entries(plan).flatMap(([personId, days]) =>
  days.flatMap((rows, dayIdx) =>
    rows.map(([category, hours, videoCode, note], i) => ({
      id: `te-${personId}-${dayIdx}-${i}`,
      personId,
      date: WEEK[dayIdx]!,
      category,
      hours,
      videoCode: videoCode ?? undefined,
      note,
      status: statusFor(personId, dayIdx, i),
    })),
  ),
);
