// Importing from Excel or CSV (P1-31). The file is read in the browser; only checked rows reach the API,
// which checks them again with these same rules before saving anything.
import { z } from "zod";
import { agreementInput } from "./clients.js";
import { PLATFORMS, type Platform } from "./enums.js";
import { leadInput } from "./pipeline.js";
import { URGENCIES, VIDEO_STAGE_KEYS, VIDEO_STAGE_LABEL, type VideoStageKey } from "./production.js";
import { clientInput, type DeliverableInput, type DeliverableKind } from "./schemas.js";

export const IMPORT_KINDS = ["clients", "team", "leads", "videos", "agreements"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

const fileName = z.string().trim().min(1).max(200);

/** Sent with every import for its check report (P3-12): each row's line in the file, and the rows left out and why. */
const meta = {
  fileName,
  /** The line in the file of each row sent (the heading is line 1). */
  lines: z.array(z.number().int().min(1)).max(5000).optional(),
  /** Rows the importer left out because they need fixing. */
  leftOut: z
    .array(z.object({ line: z.number().int().min(1), problems: z.array(z.string().max(300)).max(30) }))
    .max(5000)
    .default([]),
};

/**
 * What an import brought in, to compare with the sheet (P3-12): the rows, the figures to check against the sheet's
 * own totals, the rows left out and why, and things worth a look that did not stop the import.
 */
export interface ImportReport {
  /** Rows in the file: those imported plus those left out. */
  rows: number;
  imported: number;
  leftOut: { line: number; problems: string[] }[];
  totals: { label: string; value: string }[];
  notes: { line: number | null; text: string }[];
}

/** One client from a sheet: the client with one contact, and optionally who looks after it. */
export const clientImportRow = clientInput.extend({
  accountOwnerEmail: z
    .email("Enter a valid email address")
    .transform((e) => e.toLowerCase())
    .optional(),
});
export type ClientImportRow = z.infer<typeof clientImportRow>;

export const clientImport = z.object({
  ...meta,
  rows: z.array(clientImportRow).min(1, "There are no rows to import").max(1000, "Import at most 1,000 rows at a time"),
});
export type ClientImport = z.infer<typeof clientImport>;

/** One person to invite: their email and the role key (the importer turns role names into keys). */
export const teamImportRow = z.object({
  email: z.email("Enter a valid email address").transform((e) => e.toLowerCase()),
  role: z.string().min(1, "Choose a role").max(60),
});
export const teamImport = z.object({
  ...meta,
  rows: z.array(teamImportRow).min(1, "There are no rows to import").max(500, "Import at most 500 people at a time"),
});
export type TeamImport = z.infer<typeof teamImport>;

/** One lead from a sheet: the follow-up owner by email instead of id; the stage is a key (the importer matches names). */
export const leadImportRow = leadInput.omit({ ownerId: true }).extend({
  ownerEmail: z
    .email("Enter a valid email address")
    .transform((e) => e.toLowerCase())
    .optional(),
});
export type LeadImportRow = z.input<typeof leadImportRow>;
export const leadImport = z.object({
  ...meta,
  rows: z.array(leadImportRow).min(1, "There are no rows to import").max(2000, "Import at most 2,000 rows at a time"),
});
export type LeadImport = z.output<typeof leadImport>;

/**
 * One video in progress from the agency's tracking sheet (P2-16). The client is its code (the importer matches names
 * too), the editor an email (the importer matches names), the stage a key (the importer matches the words people use).
 */
export const videoImportRow = z.object({
  clientCode: z.string().regex(/^[A-Z]{2,4}$/, "Use one of your clients' codes or names"),
  /** Their own code is kept; the next code in the agency's format otherwise. */
  code: z.string().trim().max(40).optional(),
  title: z.string().trim().min(2, "Name the video").max(200),
  format: z.string().trim().min(1, "Choose the format").max(40),
  stage: z.enum(VIDEO_STAGE_KEYS).default("planned"),
  dueDate: z.iso.date("Use a date like 2026-10-05 or 05/10/2026"),
  publishDate: z.iso.date("Use a date like 2026-10-05 or 05/10/2026").optional(),
  editorEmail: z
    .email("Use the editor's email or name as in your team")
    .transform((e) => e.toLowerCase())
    .optional(),
  urgency: z.enum(URGENCIES).default("standard"),
  clipNo: z.string().trim().max(120).optional(),
  /** Footage backed up and verified (VP). */
  footageProtected: z.boolean().default(false),
  notes: z.string().trim().max(4000).optional(),
});
export type VideoImportRow = z.input<typeof videoImportRow>;
export const videoImport = z.object({
  ...meta,
  rows: z.array(videoImportRow).min(1, "There are no rows to import").max(2000, "Import at most 2,000 rows at a time"),
});
export type VideoImport = z.output<typeof videoImport>;

/** How an imported agreement stands: running (signed off), paused, ended, or a draft to sign off. */
export const AGREEMENT_IMPORT_STATUSES = ["active", "paused", "ended", "draft"] as const;
export type AgreementImportStatus = (typeof AGREEMENT_IMPORT_STATUSES)[number];
export const AGREEMENT_IMPORT_STATUS_LABEL: Record<AgreementImportStatus, string> = {
  active: "Running",
  paused: "Paused",
  ended: "Ended",
  draft: "Draft",
};

/**
 * One agreement the agency already has (P3-12). The client is its code and the package an id (the importer matches
 * names); the end date is exact (the importer works it out from the months when the sheet has no end date).
 */
export const agreementImportRow = agreementInput
  .omit({ months: true })
  .extend({
    clientCode: z.string().regex(/^[A-Z]{2,4}$/, "Use one of your clients' codes or names"),
    endDate: z.iso.date("Give the end date or the months"),
    status: z.enum(AGREEMENT_IMPORT_STATUSES).default("active"),
  })
  .refine((r) => r.endDate >= r.startDate, { path: ["endDate"], message: "Ends before it starts" });
export type AgreementImportRow = z.input<typeof agreementImportRow>;
export const agreementImport = z.object({
  ...meta,
  rows: z.array(agreementImportRow).min(1, "There are no rows to import").max(1000, "Import at most 1,000 rows at a time"),
});
export type AgreementImport = z.output<typeof agreementImport>;

/** A template column: the field it fills, its heading, and other headings people use for the same thing. */
export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
  hint?: string;
  example: string;
}

export const CLIENT_IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: "name",
    label: "Client name",
    required: true,
    aliases: ["client", "client name", "company", "company name", "business", "business name", "brand", "brand name", "customer", "customer name", "name"],
    example: "Kaveri Organics",
  },
  {
    key: "code",
    label: "Code",
    aliases: ["code", "client code", "short code", "short name"],
    hint: "2–4 capital letters for video codes; made up from the name when empty",
    example: "KVR",
  },
  { key: "industry", label: "Industry", aliases: ["industry", "sector", "category", "business type", "type of business"], example: "FMCG · Organic foods" },
  { key: "city", label: "City", aliases: ["city", "town", "location", "place", "area"], example: "Erode" },
  {
    key: "contactName",
    label: "Contact name",
    required: true,
    aliases: ["contact", "contact name", "contact person", "person", "approver name", "owner name"],
    example: "Ramesh Gounder",
  },
  {
    key: "contactPhone",
    label: "Contact phone",
    required: true,
    aliases: ["phone", "mobile", "contact phone", "whatsapp", "whatsapp number", "phone number", "mobile number", "contact number", "number"],
    example: "+91 94430 55101",
  },
  { key: "contactEmail", label: "Contact email", aliases: ["email", "contact email", "mail", "email id", "e mail"], example: "ramesh@kaveri.example" },
  { key: "contactTitle", label: "Contact title", aliases: ["title", "designation", "position", "contact title"], example: "Managing Partner" },
  {
    key: "approver",
    label: "Approves work",
    aliases: ["approver", "approves", "approves work", "can approve"],
    hint: "yes or no; yes when empty",
    example: "yes",
  },
  {
    key: "accountOwnerEmail",
    label: "Account owner email",
    aliases: ["account owner", "account owner email", "account manager", "handled by", "owner email", "managed by"],
    hint: "Someone in your team who looks after this client",
    example: "ashwin@youragency.example",
  },
];

export const LEAD_IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: "name",
    label: "Name",
    required: true,
    aliases: ["name", "lead", "lead name", "contact", "contact name", "person", "customer name"],
    example: "Anand Raj",
  },
  { key: "company", label: "Company", aliases: ["company", "business", "business name", "brand", "organisation", "organization"], example: "Anand Sweets" },
  {
    key: "phone",
    label: "Phone",
    aliases: ["phone", "mobile", "whatsapp", "phone number", "mobile number", "contact number", "number"],
    example: "+91 98941 30001",
  },
  { key: "email", label: "Email", aliases: ["email", "email id", "mail", "e mail"], example: "anand@anandsweets.example" },
  {
    key: "source",
    label: "Source",
    required: true,
    aliases: ["source", "lead source", "channel", "came from", "how they found us"],
    hint: "e.g. Referral, Instagram, Meta Ads",
    example: "Referral",
  },
  {
    key: "stage",
    label: "Stage",
    aliases: ["stage", "status", "pipeline stage"],
    hint: "One of your pipeline stages; the first one when empty",
    example: "Contacted",
  },
  { key: "value", label: "Value a month (₹)", aliases: ["value", "amount", "deal value", "budget", "monthly value", "expected value"], example: "60000" },
  {
    key: "ownerEmail",
    label: "Follow-up owner email",
    aliases: ["owner", "owner email", "assigned to", "handled by", "sales person", "salesperson"],
    hint: "Someone in your team",
    example: "priya@youragency.example",
  },
  {
    key: "nextFollowUp",
    label: "Next follow-up",
    aliases: ["next follow up", "follow up", "follow up date", "next call", "callback"],
    hint: "A date, e.g. 2026-10-05 or 05/10/2026",
    example: "2026-10-05",
  },
  { key: "notes", label: "Notes", aliases: ["notes", "remarks", "comments", "comment", "details"], example: "Wants festive reels" },
];

export const VIDEO_IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: "client",
    label: "Client",
    required: true,
    aliases: ["client", "client code", "client name", "brand", "customer", "account"],
    hint: "The client's code or name, as in your clients",
    example: "KVR",
  },
  {
    key: "code",
    label: "Video code",
    aliases: ["code", "video code", "video id", "id", "ref", "reference"],
    hint: "Kept as it is; the next code in your format when empty",
    example: "KVR-0926-05",
  },
  {
    key: "title",
    label: "Video",
    required: true,
    aliases: ["video", "title", "video title", "topic", "content", "idea", "subject", "video name"],
    example: "Millet dosa in 60 seconds",
  },
  { key: "format", label: "Format", aliases: ["format", "type", "video type", "kind"], hint: "One of your formats; the first when empty", example: "Reel" },
  {
    key: "stage",
    label: "Stage",
    aliases: ["stage", "status", "current stage", "where it is", "progress"],
    hint: "e.g. Planned, Shot, Editing, QC, With client, Approved, Published",
    example: "Editing",
  },
  {
    key: "dueDate",
    label: "Due",
    required: true,
    aliases: ["due", "due date", "deadline", "delivery date", "target date", "date"],
    hint: "A date, e.g. 2026-10-25 or 25/10/2026",
    example: "2026-10-25",
  },
  { key: "publishDate", label: "Publish on", aliases: ["publish", "publish date", "posting date", "post date", "go live", "live date"], example: "2026-10-28" },
  {
    key: "editor",
    label: "Editor",
    aliases: ["editor", "edited by", "editor name", "assigned to", "editor email"],
    hint: "Their name or email, as in your team",
    example: "Divya Lakshmi",
  },
  { key: "urgency", label: "Urgency", aliases: ["urgency", "priority", "urgent"], hint: "Rush, Priority or Standard", example: "Standard" },
  { key: "clipNo", label: "Clip no.", aliases: ["clip no", "clip no.", "clip number", "clip numbers", "clips", "file no"], example: "C0012–C0019" },
  {
    key: "footageProtected",
    label: "VP",
    aliases: ["vp", "footage protected", "backed up", "backup", "video protected", "footage backup"],
    hint: "yes when the raw footage is backed up and verified",
    example: "yes",
  },
  { key: "notes", label: "Notes", aliases: ["notes", "remarks", "comments", "brief", "details"], example: "Client wants the logo bigger" },
];

export const AGREEMENT_IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: "client",
    label: "Client",
    required: true,
    aliases: ["client", "client code", "client name", "brand", "customer", "account", "company"],
    hint: "The client's code or name, as in your clients",
    example: "KVR",
  },
  {
    key: "title",
    label: "Agreement",
    aliases: ["agreement", "title", "agreement title", "contract", "contract name", "name"],
    hint: "Made from the client and package when empty",
    example: "Kaveri · Growth retainer",
  },
  {
    key: "package",
    label: "Package",
    aliases: ["package", "plan", "package name", "plan name", "tier"],
    hint: "One of your packages; fills the fee and deliverables when those are empty",
    example: "Growth",
  },
  {
    key: "startDate",
    label: "Start date",
    required: true,
    aliases: ["start", "start date", "from", "starts", "starts on", "start on", "effective date", "commencement date"],
    example: "2026-07-01",
  },
  {
    key: "months",
    label: "Months",
    aliases: ["months", "duration", "term", "tenure", "period", "length", "no of months", "number of months"],
    hint: "Or give the end date",
    example: "12",
  },
  {
    key: "endDate",
    label: "End date",
    aliases: ["end", "end date", "to", "ends", "ends on", "until", "till", "valid till", "expiry", "expiry date", "expires on"],
    hint: "Or give the months",
    example: "2027-06-30",
  },
  {
    key: "monthlyFee",
    label: "Monthly fee (₹)",
    aliases: ["monthly fee", "fee", "retainer", "amount", "monthly amount", "price", "monthly value", "value", "fees"],
    hint: "Before GST; the package's fee when empty",
    example: "60000",
  },
  {
    key: "deliverables",
    label: "Deliverables",
    aliases: ["deliverables", "scope", "monthly deliverables", "what we deliver", "includes", "deliverables a month", "scope of work"],
    hint: "e.g. 8 Reels, 4 Posts, 10 Stories; the package's when empty",
    example: "8 Reels, 4 Posts, 10 Stories",
  },
  {
    key: "billing",
    label: "Billing",
    aliases: ["billing", "billing terms", "payment terms", "terms", "billed"],
    hint: "Monthly advance when empty",
    example: "Monthly advance",
  },
  { key: "shootDays", label: "Shoot days", aliases: ["shoot days", "shoots", "shoot days a month", "shoot", "shooting days"], example: "2" },
  {
    key: "revisions",
    label: "Revisions",
    aliases: ["revisions", "revisions per deliverable", "changes allowed", "corrections", "revision rounds"],
    hint: "Per deliverable; 2 when empty",
    example: "2",
  },
  {
    key: "platforms",
    label: "Platforms",
    aliases: ["platforms", "channels", "social media", "accounts", "platform"],
    hint: "e.g. Instagram, YouTube, Facebook",
    example: "Instagram, YouTube",
  },
  {
    key: "status",
    label: "Status",
    aliases: ["status", "state", "agreement status", "contract status"],
    hint: "Running, Paused, Ended or Draft; Running when empty",
    example: "Running",
  },
  { key: "notes", label: "Notes", aliases: ["notes", "remarks", "comments", "details"], example: "Festive month: 2 extra reels in October" },
];

export const TEAM_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "email", label: "Email", required: true, aliases: ["email", "email id", "mail", "e mail", "email address"], example: "priya@youragency.example" },
  { key: "role", label: "Role", required: true, aliases: ["role", "position", "designation", "access", "job"], example: "Editor" },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Which sheet column (index) fills each field, or null: first an exact heading, then a heading people often use.
 * Each sheet column is used once.
 */
export function matchColumns(headers: string[], columns: ImportColumn[]): Record<string, number | null> {
  const used = new Set<number>();
  const result: Record<string, number | null> = Object.fromEntries(columns.map((c) => [c.key, null]));
  const take = (key: string, test: (h: string) => boolean) => {
    const i = headers.findIndex((h, idx) => !used.has(idx) && test(norm(h)));
    if (i !== -1) {
      result[key] = i;
      used.add(i);
    }
  };
  for (const c of columns) take(c.key, (h) => h === norm(c.label));
  for (const c of columns) if (result[c.key] === null) take(c.key, (h) => c.aliases.some((a) => norm(a) === h));
  return result;
}

/** A date as people write it in India — 2026-10-05, 05/10/2026, 5-10-2026 — as YYYY-MM-DD, or undefined. */
export function parseDateText(v: string): string | undefined {
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  let [y, mo, d] = m ? [m[1], m[2], m[3]] : [];
  if (!m) {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
    if (!m) return undefined;
    [d, mo, y] = [m[1], m[2], m[3]!.length === 2 ? `20${m[3]}` : m[3]];
  }
  const iso = `${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? undefined : iso;
}

/** "₹60,000" or "60000.00" as whole rupees; undefined when empty or not a number. */
export function parseRupees(v: string): number | undefined {
  const s = v.replace(/[₹,\s]|rs\.?|inr/gi, "");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

/** "yes" / "no" in the ways people write it; undefined when empty or unclear. */
export function parseYesNo(v: string): boolean | undefined {
  const s = norm(v);
  if (["yes", "y", "true", "1", "approver", "ok"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return undefined;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** A 2–4 letter client code made from the name and not already taken: "Kaveri Organics" → KO, then KOA, KOB… */
export function suggestCode(name: string, taken: Set<string>): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  let base =
    words.length >= 2
      ? words
          .slice(0, 3)
          .map((w) => w[0])
          .join("")
      : (words[0] ?? "").slice(0, 3);
  if (base.length < 2) base = `${base}CL`.slice(0, 2);
  if (!taken.has(base)) return base;
  const stem = base.slice(0, 3);
  for (const c of words.join("").slice(1) + LETTERS) if (!taken.has(stem + c)) return stem + c;
  for (const a of LETTERS) for (const b of LETTERS) if (!taken.has(base.slice(0, 2) + a + b)) return base.slice(0, 2) + a + b;
  return base;
}

const STAGE_WORDS: Record<string, VideoStageKey> = {
  idea: "planned",
  "not started": "planned",
  todo: "planned",
  "to do": "planned",
  pending: "planned",
  script: "scripting",
  "script writing": "scripting",
  writing: "scripting",
  "to shoot": "shoot_scheduled",
  "shoot pending": "shoot_scheduled",
  scheduled: "shoot_scheduled",
  "shoot scheduled": "shoot_scheduled",
  shooting: "shoot_scheduled",
  "shoot done": "shot",
  "shooting done": "shot",
  "editing pending": "shot",
  "in editing": "editing",
  edit: "editing",
  "edit in progress": "editing",
  qc: "internal_qc",
  "quality check": "internal_qc",
  "internal review": "internal_qc",
  review: "client_review",
  "with client": "client_review",
  "sent to client": "client_review",
  "client approval": "client_review",
  "waiting for approval": "client_review",
  changes: "revision",
  "changes requested": "revision",
  correction: "revision",
  corrections: "revision",
  rework: "revision",
  "client approved": "approved",
  "ready to post": "approved",
  "ready to publish": "approved",
  done: "approved",
  completed: "approved",
  posted: "published",
  live: "published",
  uploaded: "published",
};

/** A stage as people write it in a tracking sheet — "QC", "With client", "Posted" — or undefined when unclear. */
export function parseVideoStage(v: string): VideoStageKey | undefined {
  const s = norm(v);
  if (!s) return undefined;
  const byLabel = VIDEO_STAGE_KEYS.find((k) => norm(VIDEO_STAGE_LABEL[k]) === s || norm(k) === s);
  return byLabel ?? STAGE_WORDS[s];
}

/** What kind of deliverable a name sounds like, so quotas count videos and posts apart. */
export function deliverableKind(name: string): DeliverableKind {
  const s = norm(name);
  if (/\bstor(y|ies)\b/.test(s)) return "story";
  if (/\b(reels?|videos?|shorts?|youtube|films?|vlogs?|podcasts?|testimonials?|interviews?)\b/.test(s)) return "video";
  if (/\b(posts?|carousels?|statics?|creatives?|posters?|banners?|graphics?|designs?)\b/.test(s)) return "post";
  return "other";
}

/**
 * Deliverables as people write them in a sheet — "8 Reels, 4 Posts + 10 stories", "Reels x 8; Posts: 4" — or
 * undefined when a part has no number.
 */
export function parseDeliverables(v: string): DeliverableInput[] | undefined {
  const parts = v
    .split(/[,;+\n/&]|\band\b/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return undefined;
  const out: DeliverableInput[] = [];
  for (const p of parts) {
    const before = /^(\d+)\s*(?:x\b|×)?\s*(.+)$/i.exec(p);
    const after = before ? null : /^(.+?)\s*(?:[:×=-]|\bx\b|\bnos?\b\.?)?\s*(\d+)$/i.exec(p);
    const [count, label] = before ? [Number(before[1]), before[2]!] : after ? [Number(after[2]), after[1]!] : [0, ""];
    const name = label.trim().replace(/^\w/, (c) => c.toUpperCase());
    if (!name || !Number.isInteger(count) || count < 1) return undefined;
    out.push({ name: name.slice(0, 60), perMonth: count, kind: deliverableKind(name) });
  }
  return out;
}

const PLATFORM_WORDS: Record<string, Platform> = {
  insta: "instagram",
  ig: "instagram",
  fb: "facebook",
  meta: "facebook",
  yt: "youtube",
  "you tube": "youtube",
  "linked in": "linkedin",
  twitter: "x",
  "x twitter": "x",
  "google business": "gbp",
  "google business profile": "gbp",
  "google my business": "gbp",
  gmb: "gbp",
};

/** Platforms as people write them — "Instagram, YT, FB" — as keys; undefined when one is not known. */
export function parsePlatforms(v: string): Platform[] | undefined {
  const out = new Set<Platform>();
  for (const part of v.split(/[,;+/&\n]|\band\b/i)) {
    const s = norm(part);
    if (!s) continue;
    const p = (PLATFORMS as readonly string[]).includes(s) ? (s as Platform) : PLATFORM_WORDS[s];
    if (!p) return undefined;
    out.add(p);
  }
  return [...out];
}

const AGREEMENT_STATUS_WORDS: Record<string, AgreementImportStatus> = {
  running: "active",
  active: "active",
  live: "active",
  ongoing: "active",
  signed: "active",
  current: "active",
  paused: "paused",
  "on hold": "paused",
  hold: "paused",
  ended: "ended",
  closed: "ended",
  expired: "ended",
  completed: "ended",
  finished: "ended",
  stopped: "ended",
  terminated: "ended",
  cancelled: "ended",
  draft: "draft",
  pending: "draft",
  "to sign": "draft",
  "not signed": "draft",
  unsigned: "draft",
};

/** An agreement's status as people write it — "Running", "On hold", "Expired" — or undefined when unclear. */
export function parseAgreementStatus(v: string): AgreementImportStatus | undefined {
  return AGREEMENT_STATUS_WORDS[norm(v)];
}
