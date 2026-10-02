// The production pipeline (Phase 2): content, videos and their stages, editing, quality checks, revisions, shoots and
// publishing. Every checklist is the agency's own (Settings → Production), starting from these Growth OS defaults.
import { z } from "zod";
import { EDIT_STEPS, PLATFORMS } from "./enums.js";

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);
const optional = (max: number) =>
  text(max)
    .transform((v) => v || undefined)
    .optional();
const clearable = (max: number) =>
  text(max)
    .transform((v) => v || null)
    .nullish();
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick the month");
const date = z.iso.date("Pick a date");
const person = z.string().max(64).nullish();

// ─── Stages ───────────────────────────────────────────────────────────

export const VIDEO_STAGE_KEYS = [
  "planned",
  "scripting",
  "shoot_scheduled",
  "shot",
  "editing",
  "internal_qc",
  "client_review",
  "revision",
  "approved",
  "published",
] as const;
export type VideoStageKey = (typeof VIDEO_STAGE_KEYS)[number];

export const VIDEO_STAGE_LABEL: Record<VideoStageKey, string> = {
  planned: "Planned",
  scripting: "Scripting",
  shoot_scheduled: "Shoot scheduled",
  shot: "Shot",
  editing: "Editing",
  internal_qc: "Internal QC",
  client_review: "Client review",
  revision: "Revision",
  approved: "Approved",
  published: "Published",
};

/** The usual next stage (Revision goes back to the quality check). */
export const NEXT_STAGE: Partial<Record<VideoStageKey, VideoStageKey>> = {
  planned: "scripting",
  scripting: "shoot_scheduled",
  shoot_scheduled: "shot",
  shot: "editing",
  editing: "internal_qc",
  internal_qc: "client_review",
  client_review: "approved",
  revision: "internal_qc",
  approved: "published",
};

export const ACTIVE_STAGES: VideoStageKey[] = ["scripting", "shoot_scheduled", "shot", "editing", "internal_qc", "client_review", "revision"];
export const DONE_STAGES: VideoStageKey[] = ["approved", "published"];
const order = (s: VideoStageKey) => VIDEO_STAGE_KEYS.indexOf(s);

export interface VideoFacts {
  stage: VideoStageKey;
  /** Footage backed up and verified (VP). */
  protectedAt: string | Date | null;
  editSteps: Record<string, unknown>;
  qc: Record<string, { result: "pass" | "fail" }>;
  /** The latest version's status, if any. */
  latestVersion: "internal" | "sent" | "changes_requested" | "approved" | null;
}

/**
 * Why a video cannot move to `to`, or null when it can (P2-08). Moving back is always allowed (except out of
 * Published); moving forward checks every stage it passes: footage protected before leaving Shot, every edit step done
 * before leaving Editing, every quality check passed before leaving Internal QC. Client review needs a version sent,
 * Approved needs the client's approval, and Published is set by publishing it.
 */
export function moveBlock(v: VideoFacts, to: VideoStageKey, settings: { editSteps: string[]; qcChecks: { key: string; label: string }[] }): string | null {
  if (to === v.stage) return "It is already there.";
  if (v.stage === "published") return "A published video stays published.";
  if (to === "published") return "Mark it as published from Publishing, with the link and proof.";
  if (to === "revision") return v.stage === "client_review" ? null : "Revision follows the client's review.";
  // After a revision the video is edited and checked again before the client sees it.
  if (v.stage === "revision") return order(to) <= order("internal_qc") ? null : "After a revision the video goes through the quality check again.";
  if (order(to) < order(v.stage)) return null;
  for (let i = order(v.stage); i < order(to); i++) {
    const leaving = VIDEO_STAGE_KEYS[i]!;
    if (leaving === "shot" && !v.protectedAt) return "The footage is not backed up and verified (VP) yet.";
    if (leaving === "editing") {
      const open = settings.editSteps.filter((s) => !v.editSteps[s]).length;
      if (open) return `${open} of ${settings.editSteps.length} edit steps are still open.`;
    }
    if (leaving === "internal_qc") {
      const failed = settings.qcChecks.filter((c) => v.qc[c.key]?.result === "fail");
      if (failed.length) return `Failed quality check: ${failed.map((c) => c.label).join(", ")}.`;
      const open = settings.qcChecks.filter((c) => !v.qc[c.key]).length;
      if (open) return `${open} quality checks are not done yet.`;
    }
    if (leaving === "client_review" && v.latestVersion !== "approved") return "The client has not approved a version yet.";
  }
  if (to === "client_review" && v.latestVersion !== "sent") return "Send a version to the client first.";
  if (to === "approved" && v.latestVersion !== "approved") return "The client has not approved a version yet.";
  return null;
}

// ─── Settings (codes and checklists) ──────────────────────────────────

export const URGENCIES = ["rush", "priority", "standard"] as const;
export type Urgency = (typeof URGENCIES)[number];
export const URGENCY_LABEL: Record<Urgency, string> = { rush: "Rush", priority: "Priority", standard: "Standard" };
export const ASPECTS = ["9:16", "16:9", "1:1", "4:5"] as const;

export const DEFAULT_QC_CHECKS = [
  { key: "brief", label: "Matches brief", hint: "Hook, message and CTA match the approved brief" },
  { key: "accuracy", label: "Script / content accuracy", hint: "Names, prices, claims verified against script" },
  { key: "captions", label: "Captions & subtitles", hint: "Captions synced, no overflow" },
  { key: "audio", label: "Audio levels & clarity", hint: "Dialogue −12 to −6 dB, BGM ducked, no clipping" },
  { key: "branding", label: "Branding (logo, colours, fonts)", hint: "Logo corner, brand colours & fonts per guide" },
  { key: "framing", label: "Framing & composition", hint: "Headroom, safe zones for platform UI" },
  { key: "spelling", label: "Spelling", hint: "All on-screen text proof-read" },
  { key: "cta", label: "Call-to-action present", hint: "End card with CTA and contact" },
  { key: "format", label: "Format & aspect ratio", hint: "Correct ratio for each platform" },
  { key: "export", label: "Resolution & export quality", hint: "1080p+ / correct bitrate, no banding" },
  { key: "playback", label: "Full playback check", hint: "Watched end-to-end at 1× on mobile" },
];

const DUAL_KIT = [
  "Camera (2)",
  "Camera Stand (2)",
  "Lights (3)",
  "Light Stand (3)",
  "Light Cables (3)",
  "Soft Box (2)",
  "Light Reflection Cap (1)",
  "Mic Box",
  "Mic Cable",
  "Camera Charger for both cameras",
  "Batteries (2)",
  "USB Charger",
  "USB Cable",
  "50mm 1.8F",
  "35mm 1.4F",
  "Variable 2.8F lenses",
  "Camera Stand Base",
  "Extension Box (2)",
  "Camera Memory Card — empty (3)",
  "Headset",
  "Pen",
  "Paper Pad",
  "Video Data Sheet",
];

export const DEFAULT_PRODUCTION_SETTINGS = {
  videoCodeFormat: "{CLIENT}-{MM}{YY}-{00}",
  formats: [
    { name: "Reel", minutes: 300 },
    { name: "Long-form", minutes: 960 },
    { name: "Ad", minutes: 540 },
    { name: "Testimonial", minutes: 420 },
    { name: "Podcast clip", minutes: 240 },
    { name: "Explainer", minutes: 300 },
  ],
  editSteps: [...EDIT_STEPS] as string[],
  qcChecks: DEFAULT_QC_CHECKS,
  kits: [
    { key: "dual", name: "Dual camera", items: DUAL_KIT },
    {
      key: "single",
      name: "Single camera",
      items: DUAL_KIT.map((i) =>
        i === "Camera (2)" ? "Camera (1)" : i === "Camera Stand (2)" ? "Camera Stand (1)" : i === "Camera Charger for both cameras" ? "Camera Charger" : i,
      ),
    },
  ],
  preShoot: [
    "AC switched on",
    "Water bottles (2)",
    "Chair",
    "Chair positioning",
    "Content paper (2)",
    "Script paper (2)",
    "Camera cap",
    "Grooming kit",
    "Refreshment",
  ],
};
export type ProductionSettings = typeof DEFAULT_PRODUCTION_SETTINGS;

const key = z.string().regex(/^[a-z0-9_]{1,40}$/, "Lower-case letters, digits and _ only");
const list = (label: string) =>
  z
    .array(text(120).min(1, `Name the ${label}`))
    .min(1, `Keep at least one ${label}`)
    .max(60)
    .refine((l) => new Set(l).size === l.length, `Two ${label}s have the same name`);

export const productionSettingsInput = z.object({
  videoCodeFormat: text(40)
    .min(3)
    .refine((f) => f.includes("{CLIENT}") && /\{0+\}/.test(f), "Include {CLIENT} and the running number, e.g. {00}"),
  formats: z
    .array(z.object({ name: text(40).min(1, "Name the format"), minutes: z.number().int().min(0).max(10_000) }))
    .min(1, "Keep at least one format")
    .max(30),
  editSteps: list("edit step"),
  qcChecks: z
    .array(z.object({ key, label: text(80).min(1, "Name the check"), hint: text(200).default("") }))
    .min(1, "Keep at least one check")
    .max(40),
  kits: z
    .array(z.object({ key, name: text(60).min(1, "Name the kit"), items: list("kit item") }))
    .min(1, "Keep at least one kit list")
    .max(10),
  preShoot: z.array(text(120).min(1)).max(40),
});
export type ProductionSettingsInput = z.input<typeof productionSettingsInput>;

/** A video code from the agency's format: {CLIENT} the client's code, {MM} {YY} {YYYY} the month, {00} the running number. */
export function formatVideoCode(format: string, clientCode: string, ym: string, seq: number) {
  const [y, m] = ym.split("-") as [string, string];
  return format
    .replace(/\{CLIENT\}/g, clientCode)
    .replace(/\{YYYY\}/g, y)
    .replace(/\{YY\}/g, y.slice(2))
    .replace(/\{MM\}/g, m)
    .replace(/\{(0+)\}/g, (_, zeros: string) => String(seq).padStart(zeros.length, "0"));
}

// ─── Content (P2-02 to P2-05) ─────────────────────────────────────────

export const CONTENT_SOURCES = ["Team", "Client", "Genie Assistant"] as const;

export const contentInput = z.object({
  clientId: z.uuid("Choose the client"),
  title: text(200).min(3, "Give the idea a title"),
  pillar: text(80).default(""),
  format: text(40).min(1, "Choose the format"),
  source: z.enum(CONTENT_SOURCES).default("Team"),
  /** The month it is for. */
  month,
  notes: optional(4000),
  ownerId: person,
});
export type ContentInput = z.input<typeof contentInput>;

export const contentUpdate = z
  .object({
    title: text(200).min(3),
    pillar: text(80),
    format: text(40).min(1),
    month,
    notes: text(4000),
    research: text(20_000),
    links: z
      .array(
        z.object({
          label: text(120).min(1, "Name the link"),
          url: z.url("Paste the full address").refine((u) => u.startsWith("https://"), "Use an https:// link"),
        }),
      )
      .max(30),
    ownerId: person,
    due: date.nullable(),
  })
  .partial();
export type ContentUpdate = z.input<typeof contentUpdate>;

export const pillarsInput = z.object({ pillars: z.array(text(60).min(1)).max(12) });

export const topicListInput = z.object({ clientId: z.uuid(), month, needed: z.number().int().min(1, "At least 1").max(200) });

export const scriptInput = z.object({
  hook: text(1000).min(1, "Write the hook"),
  body: text(20_000).min(1, "Write the script"),
  cta: text(1000).default(""),
  onScreen: text(4000).default(""),
});
export type ScriptInput = z.input<typeof scriptInput>;

/** The client's answer to a script or a video version, recorded by the team (by the client in the portal later). */
export const clientDecision = z.discriminatedUnion("approved", [
  z.object({ approved: z.literal(true), note: optional(2000) }),
  z.object({ approved: z.literal(false), note: text(2000).min(2, "Write what the client wants changed") }),
]);
export type ClientDecision = z.input<typeof clientDecision>;

// ─── Videos (P2-07 to P2-11) ──────────────────────────────────────────

export const videoInput = z.object({
  clientId: z.uuid("Choose the client"),
  title: text(200).min(2, "Name the video"),
  format: text(40).min(1, "Choose the format"),
  aspect: z.enum(ASPECTS).default("9:16"),
  urgency: z.enum(URGENCIES).default("standard"),
  dueDate: date,
  publishDate: date.optional(),
  agreementId: z.uuid().optional(),
  editorId: person,
  directorId: person,
  cameraId: person,
  platforms: z.array(z.enum(PLATFORMS)).default([]),
  notes: optional(4000),
});
export type VideoInput = z.input<typeof videoInput>;

export const videoUpdate = z
  .object({
    title: text(200).min(2),
    format: text(40).min(1),
    aspect: z.enum(ASPECTS),
    urgency: z.enum(URGENCIES),
    dueDate: date,
    publishDate: date.nullable(),
    editorId: person,
    directorId: person,
    cameraId: person,
    clipNo: clearable(120),
    platforms: z.array(z.enum(PLATFORMS)),
    notes: clearable(4000),
    delayReason: clearable(1000),
  })
  .partial();
export type VideoUpdate = z.input<typeof videoUpdate>;

export const moveInput = z.object({ to: z.enum(VIDEO_STAGE_KEYS), note: optional(500) });
export const editStepInput = z.object({ step: text(120).min(1), done: z.boolean() });
export const qcInput = z.object({ check: key, result: z.enum(["pass", "fail"]).nullable(), note: optional(1000) });
export const timeLogInput = z.object({
  date,
  minutes: z
    .number()
    .int()
    .min(1, "At least a minute")
    .max(24 * 60),
  note: optional(500),
});

export const versionInput = z
  .object({
    /** An uploaded file, or a link to it. */
    fileId: z.uuid().optional(),
    link: z
      .url("Paste the full address")
      .refine((u) => u.startsWith("https://"), "Use an https:// link")
      .optional(),
    duration: z
      .string()
      .regex(/^(\d{1,2}:)?\d{1,2}:\d{2}$/, "Like 00:48")
      .optional(),
    notes: optional(2000),
  })
  .refine((v) => v.fileId || v.link, { path: ["link"], message: "Upload the video or paste a link to it" });
export type VersionInput = z.input<typeof versionInput>;

export const commentInput = z.object({
  text: text(2000).min(1, "Write the comment"),
  /** Seconds into the video. */
  at: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600)
    .optional(),
  author: optional(120),
});

export const REVISION_KIND_KEYS = ["agency_correction", "included_revision", "change_request"] as const;
export type RevisionKindKey = (typeof REVISION_KIND_KEYS)[number];
export const REVISION_KIND_LABEL: Record<RevisionKindKey, string> = {
  agency_correction: "Our correction",
  included_revision: "Included revision",
  change_request: "Change request",
};

export const changeRequestInput = z
  .object({
    videoId: z.uuid(),
    kind: z.enum(REVISION_KIND_KEYS),
    summary: text(2000).min(3, "Say what is to be changed"),
    estimate: z.number().int().min(0).max(10_000_000).optional(),
    dateImpactDays: z.number().int().min(0).max(120).optional(),
  })
  .refine((c) => c.kind !== "change_request" || c.estimate !== undefined, { path: ["estimate"], message: "Give the estimate for the change request" });
export type ChangeRequestInput = z.input<typeof changeRequestInput>;
export const changeRequestStep = z.object({ status: z.enum(["awaiting_client", "approved", "rejected", "done", "open"]) });

// ─── Shoots (P2-06) ───────────────────────────────────────────────────

export const SHOOT_STATUSES = ["planned", "packed", "on_shoot", "returned", "closed"] as const;
export type ShootStatus = (typeof SHOOT_STATUSES)[number];
export const SHOOT_STATUS_LABEL: Record<ShootStatus, string> = {
  planned: "Planned",
  packed: "Kit packed",
  on_shoot: "On shoot",
  returned: "Kit returned",
  closed: "Closed",
};

export const shootInput = z.object({
  clientId: z.uuid("Choose the client"),
  title: text(160).min(2, "Name the shoot"),
  date,
  callTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Like 07:00")
    .optional(),
  location: optional(300),
  batchNo: optional(40),
  kit: key,
  cameraId: person,
  directorId: person,
  videoIds: z.array(z.uuid()).max(60).default([]),
  notes: optional(2000),
});
export type ShootInput = z.input<typeof shootInput>;
export const shootUpdate = shootInput.omit({ clientId: true }).partial();
export const kitTickInput = z.object({
  item: text(120).min(1),
  column: z.enum(["packed", "shot", "received"]),
  done: z.boolean(),
});
export const preShootTick = z.object({ item: text(120).min(1), done: z.boolean() });
export const shootSign = z.object({ as: z.enum(["giver", "receiver", "client"]), name: optional(120) });
export const incidentInput = z.object({ items: z.array(text(120)).max(40).default([]), note: text(1000).min(3, "Say what happened") });

// ─── Publishing (P2-12) ───────────────────────────────────────────────

export const connectionInput = z.object({ platform: z.enum(PLATFORMS), handle: text(120).min(1, "Give the page or handle") });
export const postInput = z.object({
  videoId: z.uuid(),
  connectionId: z.uuid("Choose the platform"),
  scheduledAt: z.iso.datetime({ offset: true, message: "Pick the date and time" }),
  caption: optional(5000),
});
export type PostInput = z.input<typeof postInput>;
export const publishedInput = z.object({
  url: z.url("Paste the post's address").refine((u) => u.startsWith("https://"), "Use the https:// address of the post"),
  publishedAt: z.iso.datetime({ offset: true, message: "When was it posted?" }),
  proofFileId: z.uuid("Upload a screenshot of the post"),
  confirmed: z.literal(true, "Confirm the approved file was posted unchanged"),
});
export type PublishedInput = z.input<typeof publishedInput>;

// ─── Cycles (P2-01) ───────────────────────────────────────────────────

export const CYCLE_DECISIONS = ["carry", "credit", "forfeit"] as const;
export const cycleClose = z
  .object({ decision: z.enum(CYCLE_DECISIONS).optional(), note: optional(1000) })
  .refine((c) => c.decision !== "forfeit" || !!c.note, { path: ["note"], message: "Say why the client gives up the shortfall" });
export const cyclesGenerate = z.object({ month });
