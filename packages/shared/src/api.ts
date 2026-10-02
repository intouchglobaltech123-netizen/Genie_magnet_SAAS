// What the API returns, as the web app receives it (dates are ISO strings). The API's e2e tests check these shapes.
import type { PermissionMatrix } from "./permissions.js";
import type { BusinessStage } from "./enums.js";
import type { DeliverableInput } from "./schemas.js";
import type { AnswerValue, ChecklistState, Progress, Question, QuestionnaireDefinition, WindowState } from "./onboarding.js";

/** Every error from the API (sign-in routes return `{ message, code }`). */
export interface ApiErrorBody {
  message: string;
  issues?: { path: string; message: string }[];
  requestId?: string;
}

export interface RoleRef {
  key: string;
  name: string;
}

/** GET /me */
export interface Me {
  user: { id: string; name: string; email: string; image: string | null };
  activeAgencyId: string | null;
  role: RoleRef | null;
  permissions: PermissionMatrix | null;
  agencies: { id: string; name: string; slug: string; logo: string | null; role: string }[];
}

/** GET /team */
export interface Team {
  members: { id: string; user: { id: string; name: string; email: string; image: string | null }; role: RoleRef; title: string | null; joinedAt: string }[];
  invitations: { id: string; email: string; role: RoleRef; expiresAt: string; invitedBy: string | null; link: string }[];
}

/** POST /team/invitations */
export interface CreatedInvitation {
  id: string;
  email: string;
  role: RoleRef;
  expiresAt: string;
  link: string;
}

/** GET /roles (one item) */
export interface Role {
  key: string;
  name: string;
  description: string | null;
  isOwner: boolean;
  isClient: boolean;
  permissions: PermissionMatrix;
  members: number;
}

export interface Contact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string;
  approver: boolean;
}

/** GET /clients (one item) */
export interface Client {
  id: string;
  code: string;
  name: string;
  industry: string | null;
  city: string | null;
  stage: "struggle" | "survival" | "stability" | "success" | "scale" | null;
  fitment: "amazing" | "bread_winning" | "convenience" | "dangerous" | null;
  health: number | null;
  whatsappGroupUrl: string | null;
  accountOwnerId: string | null;
  accountOwner: { id: string; name: string | null } | null;
  legalName: string | null;
  gstin: string | null;
  /** GST state code (INDIAN_STATES). */
  state: string | null;
  billingAddress: string | null;
  notes: string | null;
  /** Content pillars (Phase 2). */
  pillars: string[];
  archivedAt: string | null;
  createdAt: string;
  contacts: Contact[];
  /** Fees a month of its active agreements. */
  monthlyFee: number;
  activeAgreements: number;
  renewalDue: boolean;
}

/** An agreement (P1-19): GET /agreements, and on the client page. */
export interface Agreement {
  id: string;
  clientId: string;
  client: { id: string; name: string; code: string };
  packageId: string | null;
  packageName: string | null;
  title: string;
  status: "draft" | "active" | "paused" | "ended";
  startDate: string;
  endDate: string;
  months: number;
  monthlyFee: number;
  billing: string;
  revisionsPerDeliverable: number;
  shootDays: number;
  platforms: string[];
  deliverables: DeliverableInput[];
  videosPerMonth: number;
  postsPerMonth: number;
  notes: string | null;
  /** Why it was paused or ended. */
  statusNote: string | null;
  renewsId: string | null;
  renewedById: string | null;
  signedBy: { id: string; name: string | null } | null;
  signedAt: string | null;
  createdAt: string;
  /** Days until its end date (negative once past). */
  daysLeft: number;
  /** Signed off, but its start date is still to come. */
  upcoming: boolean;
  renewalDue: boolean;
}

/** GET /invoice-settings (null until the agency sets them up). */
export interface InvoiceSettings {
  legalName: string;
  gstin: string | null;
  state: string;
  address: string;
  services: { name: string; sac: string; rate: 0 | 5 | 12 | 18 | 28 }[];
  numberFormat: string;
  nextNumber: number;
  /** What the next invoice number will look like if issued today. */
  nextNumberPreview: string;
  paymentTermsDays: number;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  upiId: string | null;
  footer: string | null;
}

export interface BilledTo {
  name: string;
  gstin: string | null;
  state: string | null;
  address: string | null;
}

/** An invoice (P1-20). */
export interface Invoice {
  id: string;
  number: string | null;
  status: "draft" | "sent" | "paid" | "cancelled";
  client: { id: string; name: string; code: string };
  agreement: { id: string; title: string } | null;
  period: string | null;
  issueDate: string | null;
  dueDate: string | null;
  placeOfSupply: string | null;
  /** CGST + SGST (true) or IGST (false). */
  intraState: boolean;
  /** False when the agency has no GSTIN: no GST is charged. */
  registered: boolean;
  lines: { description: string; sac: string; quantity: number; rate: number; taxRate: 0 | 5 | 12 | 18 | 28; amount: number }[];
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  totalInWords: string;
  /** For drafts, the client's and agency's details as they are now; for issued invoices, as they were when issued. */
  billedTo: BilledTo;
  seller:
    | (Omit<InvoiceSettings, "services" | "numberFormat" | "nextNumber" | "nextNumberPreview" | "paymentTermsDays"> & {
        logo: string | null;
        brandColor: string | null;
      })
    | null;
  notes: string | null;
  sentAt: string | null;
  paidOn: string | null;
  paymentNote: string | null;
  cancelReason: string | null;
  /** Sent, unpaid and past its due date. */
  overdue: boolean;
  createdAt: string;
}

/** GET /clients/:id */
export interface ClientDetail extends Client {
  /** Null when the person's role may not see agreements. */
  agreements: Agreement[] | null;
  /** The lead it was won from. */
  lead: { id: string; name: string; company: string | null } | null;
  canDelete: boolean;
}

/** GET /audit */
export interface AuditPage {
  items: {
    id: string;
    at: string;
    action: string;
    entity: string;
    entityId: string | null;
    actor: { id: string; name: string | null } | null;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  }[];
  next: string | null;
}

/** GET /api/auth/test-sign-in/people (test servers only) */
export interface TestPerson {
  name: string;
  email: string;
  agencies: { id: string; name: string; role: string; title: string | null }[];
}

/** GET /agency */
export interface AgencyProfile {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  brandColor: string | null;
  businessStage: BusinessStage | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  city: string | null;
  windowDays: number;
  reminderDays: number[];
  languages: string[];
  discountLimit: number;
  renewalNoticeDays: number;
  plan: string;
}

/** GET /packages (one item) */
export interface Package {
  id: string;
  name: string;
  description: string | null;
  monthlyFee: number;
  deliverables: DeliverableInput[];
  videosPerMonth: number;
  postsPerMonth: number;
  shootDays: number;
  revisionsPerDeliverable: number;
  platforms: string[];
  billing: string | null;
  active: boolean;
  /** How many agreements use it (then it can be archived, not deleted). */
  agreements: number;
  createdAt: string;
}

/** GET /imports (one item) */
export interface ImportRecord {
  id: string;
  kind: "clients" | "team" | "leads";
  fileName: string;
  rowCount: number;
  createdAt: string;
  createdBy: string | null;
  undoneAt: string | null;
  /** Within 24 hours, not undone yet, and the person may change this kind of record. */
  canUndo: boolean;
}

/** POST /imports/clients and /imports/team */
export interface ImportResult {
  id: string;
  created: number;
}

/** GET /pipeline/stages (one item) */
export interface PipelineStage {
  key: string;
  name: string;
  kind: "open" | "won" | "lost";
  probability: number;
  position: number;
}

/** GET /leads (one item) */
export interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  stage: string;
  value: number;
  ownerId: string | null;
  owner: { id: string; name: string | null } | null;
  nextFollowUp: string | null;
  notes: string | null;
  lostReason: string | null;
  clientId: string | null;
  activities: number;
  createdAt: string;
  updatedAt: string;
}

/** A proposal on a lead (P1-16). */
export interface Proposal {
  id: string;
  leadId: string;
  leadName?: string;
  packageId: string | null;
  packageName: string;
  listFee: number;
  discountPercent: number;
  monthlyFee: number;
  months: number;
  deliverables: DeliverableInput[];
  notes: string | null;
  status: "pending_approval" | "approved" | "rejected" | "sent" | "accepted" | "declined";
  decisionNote: string | null;
  decidedBy: string | null;
  createdBy: string | null;
  createdAt: string;
}

/** GET /leads/:id */
export interface LeadDetail extends Lead {
  proposals: Proposal[];
  history: { id: string; kind: string; summary: string; outcome: string | null; at: string; by: { id: string; name: string | null } | null }[];
}

// ─── Onboarding (P1-21 to P1-25) ──────────────────────────────────────

/** GET /questionnaires/:kind */
export interface QuestionnaireVersions {
  kind: "client" | "agency";
  published: { id: string; version: number; definition: QuestionnaireDefinition; publishedAt: string | null; updatedAt: string } | null;
  draft: { id: string; version: number; definition: QuestionnaireDefinition; publishedAt: null; updatedAt: string } | null;
  versions: { version: number; publishedAt: string; responses: number }[];
}

type Person = { id: string; name: string | null } | null;

/** GET /onboarding (one item) */
export interface OnboardingSummary {
  id: string;
  kind: "client" | "agency";
  client: { id: string; name: string; code: string } | null;
  version: number;
  mode: "link" | "assisted";
  language: string;
  sentAt: string | null;
  requiredDoneAt: string | null;
  completedAt: string | null;
  createdAt: string;
  progress: Pick<Progress, "required" | "window" | "complete">;
  gate: { open: boolean; byException: boolean; missing: string[] };
  window: { state: WindowState; day: number | null; dueOn: string | null };
  /** Reminder days that have come and are not recorded as sent. */
  remindersDue: number[];
}

/** GET /onboarding/:id */
export interface OnboardingDetail extends OnboardingSummary {
  windowDays: number;
  reminderDays: number[];
  languages: string[];
  definition: QuestionnaireDefinition;
  answers: Record<string, { value: AnswerValue; by: Person; at: string }>;
  progress: Progress;
  checklist: (Omit<ChecklistState, "by"> & { by: Person })[];
  reminders: { day: number; channel: string; sentAt: string; by: Person }[];
  exception: { reason: string | null; at: string; by: Person } | null;
  canvas: { block: string; label: string; items: { question: string; answer: AnswerValue }[] }[];
  files: Record<string, { name: string; size: number; url: string | null }>;
  filled: { question: string; field: string; value: AnswerValue | null }[];
}

/** GET /public/onboarding/:token — what the client sees. */
export interface PublicQuestionnaire {
  agency: { name: string; logo: string | null; brandColor: string | null };
  client: { name: string };
  language: string;
  languages: { code: string; label: string }[];
  sections: { key: string; title: string; intro: string | null; when: "required" | "within-window"; questions: (Question & { optionLabels?: string[] })[] }[];
  answers: Record<string, AnswerValue>;
  files: Record<string, { name: string; size: number; url: string | null }>;
  progress: Progress;
  window: { state: WindowState; dueOn: string | null; days: number };
}

// ─── Notifications and files (P1-04, P1-05) ───────────────────────────

/** GET /notifications */
export interface NotificationList {
  unread: number;
  items: { id: string; kind: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: string }[];
}

/** A stored file, with a download link valid for an hour (null until uploaded). */
export interface StoredFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  status: string;
  uploadedBy: string | null;
  createdAt: string;
  url: string | null;
}

/** POST /files, POST /public/onboarding/:token/files */
export interface UploadStart {
  id: string;
  uploadUrl: string;
  expiresIn: number;
}

// ─── Production (Phase 2) ─────────────────────────────────────────────

type Who = { id: string; name: string | null } | null;
type ClientRef = { id: string; name: string; code: string };

/** GET /videos (one item) */
export interface VideoSummary {
  id: string;
  code: string;
  title: string;
  client: ClientRef;
  format: string;
  aspect: string;
  urgency: "rush" | "priority" | "standard";
  stage: import("./production.js").VideoStageKey;
  dueDate: string | null;
  publishDate: string | null;
  editor: Who;
  director: Who;
  camera: Who;
  clipNo: string | null;
  protected: boolean;
  editProgress: { done: number; total: number };
  qcProgress: { passed: number; failed: number; total: number };
  revisionsUsed: number;
  allowance: number | null;
  overdue: boolean;
  month: string | null;
  shootId: string | null;
  latestVersion: { label: string; status: string } | null;
  platforms: string[];
}

/** GET /videos/:id */
export interface VideoDetail extends VideoSummary {
  agreement: { id: string; title: string; revisionsPerDeliverable: number } | null;
  plannedMinutes: number;
  loggedMinutes: number;
  delayReason: string | null;
  notes: string | null;
  protectedAt: string | null;
  protectedBy: Who;
  editSteps: { step: string; done: boolean; by: Who; at: string | null }[];
  qc: { key: string; label: string; hint: string; result: "pass" | "fail" | null; note: string | null; by: Who; at: string | null }[];
  versions: {
    id: string;
    label: string;
    number: number;
    status: "internal" | "sent" | "changes_requested" | "approved";
    duration: string | null;
    notes: string | null;
    link: string | null;
    file: StoredFile | null;
    sentAt: string | null;
    decidedAt: string | null;
    by: Who;
    createdAt: string;
    comments: { id: string; author: string; at: number | null; text: string; resolved: boolean; createdAt: string }[];
  }[];
  changeRequests: {
    id: string;
    kind: string;
    summary: string;
    estimate: number | null;
    dateImpactDays: number | null;
    status: string;
    by: Who;
    createdAt: string;
  }[];
  history: { from: string | null; to: string; note: string | null; by: Who; at: string }[];
  timeLogs: { id: string; date: string; minutes: number; note: string | null; by: Who }[];
  content: { id: string; title: string; script: { hook: string; body: string; cta: string; onScreen: string } | null } | null;
  shoot: { id: string; title: string; date: string; status: string } | null;
  files: StoredFile[];
  moves: { to: import("./production.js").VideoStageKey; blocked: string | null }[];
}

/** GET /content (one item), GET /content/:id */
export interface ContentItem {
  id: string;
  client: ClientRef;
  title: string;
  pillar: string;
  format: string;
  source: string;
  stage: "idea" | "topic" | "research" | "script" | "approval" | "ready";
  owner: Who;
  month: string;
  due: string | null;
  pick: "picked" | "skipped" | null;
  notes: string;
  research: string;
  links: { label: string; url: string }[];
  scripts: {
    id: string;
    number: number;
    label: string;
    hook: string;
    body: string;
    cta: string;
    onScreen: string;
    status: "draft" | "review" | "sent" | "changes" | "approved";
    clientNote: string | null;
    by: Who;
    createdAt: string;
    sentAt: string | null;
    decidedAt: string | null;
  }[];
  video: { id: string; code: string; stage: string } | null;
  updatedAt: string;
}

/** GET /topic-lists (one item) */
export interface TopicList {
  id: string;
  month: string;
  client: ClientRef;
  needed: number;
  status: "draft" | "sent" | "confirmed";
  sentAt: string | null;
  confirmedAt: string | null;
  items: ContentItem[];
  picked: number;
}

/** GET /cycles (one item) */
export interface CycleRow {
  id: string;
  month: string;
  agreement: { id: string; title: string; monthlyFee: number };
  client: ClientRef;
  promised: number;
  carriedIn: number;
  delivered: number;
  inMaking: number;
  planned: number;
  notStarted: number;
  status: "upcoming" | "in_progress" | "reconciling" | "closed";
  decision: "carry" | "credit" | "forfeit" | null;
  decisionNote: string | null;
  credit: number | null;
  closedAt: string | null;
}

/** GET /shoots (one item) */
export interface ShootSummary {
  id: string;
  title: string;
  client: ClientRef;
  date: string;
  callTime: string | null;
  location: string | null;
  batchNo: string | null;
  kit: string;
  status: import("./production.js").ShootStatus;
  camera: Who;
  director: Who;
  videos: number;
  packed: number;
  received: number;
  items: number;
  openIncidents: number;
}

/** GET /shoots/:id */
export interface ShootDetail extends Omit<ShootSummary, "kit" | "videos" | "packed" | "received" | "items" | "openIncidents"> {
  kit: { key: string; name: string; items: string[] };
  notes: string | null;
  kitTicks: Record<string, { packed?: boolean; shot?: boolean; received?: boolean }>;
  preShootItems: string[];
  preShoot: Record<string, boolean>;
  /** `name` is the client's own name on their sign-off; `byName` is the team member who signed or recorded it. */
  signatures: Partial<Record<"giver" | "receiver" | "client", { by: string | null; byName: string | null; name: string | null; at: string }>>;
  videos: { id: string; code: string; title: string; urgency: string; clipNo: string | null; protected: boolean; editor: Who; stage: string }[];
  incidents: { id: string; items: string[]; note: string; resolved: boolean; by: Who; createdAt: string }[];
  timeLogs: { id: string; date: string; minutes: number; note: string | null; by: Who }[];
  /** Total time logged on the shoot. */
  minutes: number;
}

/** GET /publishing (one item) */
export interface PublishingItem {
  id: string;
  code: string;
  title: string;
  client: ClientRef;
  stage: string;
  publishDate: string | null;
  platforms: string[];
  approvedVersion: string | null;
  posts: {
    id: string;
    videoId: string;
    platform: string;
    handle: string;
    connectionId: string;
    scheduledAt: string;
    caption: string | null;
    status: "scheduled" | "published";
    publishedUrl: string | null;
    publishedAt: string | null;
    proofFileId: string | null;
  }[];
}

/** GET /publishing/quotas (one item) */
export interface QuotaRow extends CycleRow {
  scheduled: number;
  atRisk: boolean;
}

/** GET /change-requests (one item) */
export interface ChangeRequestRow {
  id: string;
  kind: string;
  summary: string;
  estimate: number | null;
  dateImpactDays: number | null;
  status: string;
  createdAt: string;
  client: string | null;
  video: { id: string; code: string; title: string; revisionsUsed: number; allowance: number | null } | null;
}

/** GET /clients/:id/platforms (one item) */
export interface PlatformConnectionRow {
  id: string;
  platform: string;
  handle: string;
  status: string;
  connectedAt: string;
}

/** A background job as Settings → Background jobs shows it. */
export interface JobRow {
  id: string;
  name: string;
  label: string;
  status: "queued" | "running" | "done" | "failed";
  /** The day a daily job is for. */
  date: string | null;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  lastError: string | null;
  result: unknown;
  createdAt: string;
  finishedAt: string | null;
}

export interface JobOverview {
  failed: number;
  waiting: number;
  /** The latest run of each daily job. */
  daily: { name: string; label: string; date: string | null; status: JobRow["status"] | null; finishedAt: string | null }[];
}

/** One time entry, on a video or a shoot (Production → Time). */
export interface TimeEntryRow {
  id: string;
  date: string;
  minutes: number;
  note: string | null;
  by: Who;
  on: { kind: "video" | "shoot"; id: string; label: string; client: string };
}

/** Something on the calendar: a shoot, a video due or to publish, a post, an agreement ending. */
export interface CalendarEvent {
  kind: "shoot" | "due" | "publish" | "post" | "renewal";
  date: string;
  /** 24-hour time in India, when it has one. */
  time: string | null;
  title: string;
  detail: string | null;
  client: { id: string; name: string; code: string } | null;
  link: string;
  /** Done (a published post, a closed shoot) or late (a video past due). */
  state: "open" | "done" | "late";
}

/** The set-up guide's steps, in order (P1-32). */
export type SetupStep =
  | "agency_questionnaire"
  | "profile"
  | "packages"
  | "roles"
  | "team"
  | "clients"
  | "leads"
  | "invoices"
  | "onboarding_questions"
  | "production"
  | "platforms"
  | "videos";

export interface SetupStatus {
  /** Hidden for the whole agency by someone who may change settings. */
  hidden: boolean;
  /** Each step, done once the real data exists. */
  steps: Record<SetupStep, boolean>;
}

// ─── Client portal (P3-01 to P3-05) ──────────────────────────────────

export interface PortalHome {
  agency: { name: string; logo: string | null; brandColor: string | null };
  client: { name: string };
  contact: { name: string };
  todo: { topics: number; scripts: number; videos: number; invoices: number };
  /** WhatsApp messages: whether the agency sends them, and whether this contact agreed. */
  whatsapp: { available: boolean; optIn: boolean };
}

export interface PortalTopicList {
  id: string;
  month: string;
  needed: number;
  status: "sent" | "confirmed";
  items: { id: string; title: string; pillar: string; format: string; notes: string; pick: "picked" | "skipped" | null }[];
}

export interface PortalScript {
  contentId: string;
  title: string;
  format: string;
  month: string;
  script: { label: string; hook: string; body: string; cta: string; onScreen: string; sentAt: string | null };
  /** Earlier versions and what was asked. */
  earlier: { label: string; status: string; clientNote: string | null }[];
}

export interface PortalVideo {
  id: string;
  code: string;
  title: string;
  stage: string;
  version: {
    id: string;
    label: string;
    link: string | null;
    fileUrl: string | null;
    duration: string | null;
    notes: string | null;
    sentAt: string | null;
    comments: { id: string; author: string; at: number | null; text: string; createdAt: string }[];
  } | null;
  posts: { platform: string; url: string | null; at: string }[];
}

export interface PortalVideos {
  waiting: PortalVideo[];
  done: PortalVideo[];
}

export interface PortalInvoiceRow {
  id: string;
  number: string | null;
  issueDate: string | null;
  dueDate: string | null;
  total: number;
  status: "sent" | "paid";
  paidOn: string | null;
}

export interface ClientRequestRow {
  id: string;
  client: { id: string; name: string; code: string };
  contactName: string;
  kind: string;
  text: string;
  status: "open" | "answered";
  answer: string | null;
  answeredBy: { id: string; name: string | null } | null;
  createdAt: string;
  answeredAt: string | null;
}

export interface PortalLinkRow {
  contactId: string;
  contactName: string;
  phone: string;
  approver: boolean;
  active: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
  /** Agreed to WhatsApp messages, and how (or how they stopped). */
  whatsappOptIn: boolean;
  whatsappSource: string | null;
}

// ─── WhatsApp (P3-07, P3-08) ───────────────────────────────────────────

export interface WhatsAppSettings {
  connection: {
    phoneNumberId: string;
    businessId: string | null;
    displayPhone: string | null;
    verifiedName: string | null;
    tokenHint: string;
    hasAppSecret: boolean;
    status: "unchecked" | "connected" | "error";
    lastError: string | null;
    checkedAt: string | null;
    quietFrom: string;
    quietTo: string;
    /** Paste these into the Meta app's webhook settings. */
    webhookUrl: string;
    verifyToken: string;
  } | null;
  templates: { purpose: string; name: string; language: string; active: boolean }[];
  /** "outbox" while messages are kept in the app (development); "cloud" when they really go. */
  provider: "cloud" | "outbox";
}

export interface WhatsAppMessageRow {
  id: string;
  direction: "out" | "in";
  client: { id: string; name: string } | null;
  contact: { id: string; name: string } | null;
  phone: string;
  purpose: string;
  /** What it said: the template's values or the text. */
  text: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed" | "skipped" | "received";
  reason: string | null;
  createdAt: string;
  sentAt: string | null;
}
