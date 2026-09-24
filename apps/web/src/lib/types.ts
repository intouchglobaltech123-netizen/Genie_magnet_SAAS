// Shapes mirror the future Prisma models so the NestJS API can replace mock data later.

export type Role = "founder" | "manager" | "editor" | "finance" | "hr" | "client";

export type Department = "Management" | "Sales & Marketing" | "Production" | "Post-Production" | "Social Media" | "HR & Admin" | "Technology" | "Finance";

export interface Person {
  id: string;
  name: string;
  role: string; // job title
  department: Department;
  type: "employee" | "freelancer";
  email: string;
  phone: string;
  joinedOn: string;
  managerId?: string;
  skills: string[];
  hourlyCost: number; // loaded cost per productive hour (INR)
  monthlyCtc?: number;
  status: "active" | "on-leave" | "notice";
  utilisation: number; // 0..1 this week
}

export type CustomerCategory = "Awesome" | "Breadwinning" | "Convincing" | "Dangerous";

export interface Client {
  id: string;
  code: string; // used in video codes
  name: string;
  industry: string;
  city: string;
  kind: "recurring" | "partner";
  category: CustomerCategory;
  accountOwnerId: string;
  health: number; // 0..100
  since: string;
  contacts: { name: string; title: string; email: string; phone: string; approver: boolean }[];
  monthlyValue: number;
  outstanding: number;
}

export interface Agreement {
  id: string;
  clientId: string;
  title: string;
  packageName: string;
  service: "Video Production" | "Social Media Management" | "Personal Branding" | "Website" | "Consulting";
  status: "active" | "renewal-due" | "paused" | "draft" | "ended";
  startDate: string;
  endDate: string;
  monthlyFee: number;
  billing: "Monthly advance" | "Monthly arrears" | "Milestone" | "50% advance";
  units: { label: string; perCycle: number }[];
  revisionsPerDeliverable: number;
  turnaroundDays: number;
  responsibilities: string[];
  exclusions: string[];
}

export interface Cycle {
  id: string;
  agreementId: string;
  clientId: string;
  label: string; // "Sep 2026"
  start: string;
  end: string;
  status: "upcoming" | "in-progress" | "reconciling" | "closed";
  promised: number;
  delivered: number;
  inProgress: number;
  revenue: number;
  cost: number;
}

export type Urgency = "rush" | "priority" | "standard";

export type VideoStage =
  | "Planned"
  | "Scripting"
  | "Shoot Scheduled"
  | "Shot"
  | "Editing"
  | "Internal QC"
  | "Client Review"
  | "Revision"
  | "Approved"
  | "Published";

export const VIDEO_STAGES: VideoStage[] = [
  "Planned",
  "Scripting",
  "Shoot Scheduled",
  "Shot",
  "Editing",
  "Internal QC",
  "Client Review",
  "Revision",
  "Approved",
  "Published",
];

export const EDIT_STEPS = [
  "Rough cut",
  "Video analyse",
  "B-rolls",
  "Text",
  "Colour corrections",
  "Transitions",
  "BGM",
  "Spelling",
  "Final overview",
] as const;
export type EditStep = (typeof EDIT_STEPS)[number];

export const QC_CHECKS = [
  "Matches brief",
  "Script / content accuracy",
  "Captions & subtitles",
  "Audio levels & clarity",
  "Branding (logo, colours, fonts)",
  "Framing & composition",
  "Spelling",
  "Call-to-action present",
  "Format & aspect ratio",
  "Resolution & export quality",
  "Full playback check",
] as const;

export interface VideoVersion {
  id: string;
  label: string; // v1, v2
  createdAt: string;
  by: string;
  duration: string;
  notes: string;
  status: "internal" | "sent" | "changes-requested" | "approved";
}

export interface ClientComment {
  id: string;
  versionId: string;
  author: string;
  at: string;
  timestamp?: string; // mm:ss in video
  text: string;
  kind: "text" | "voice";
  resolved: boolean;
}

export interface Video {
  id: string;
  code: string; // KVR-0926-03
  title: string;
  clientId: string;
  agreementId: string;
  cycleId: string;
  format: "Reel" | "Long-form" | "Ad" | "Testimonial" | "Podcast clip" | "Explainer";
  aspect: "9:16" | "16:9" | "1:1" | "4:5";
  urgency: Urgency;
  stage: VideoStage;
  clipNo: string; // camera clip reference e.g. C0034–C0041
  videoProtection: boolean; // VP — footage protected/backed up
  editorId: string;
  directorId: string;
  cameraId: string;
  shootId?: string;
  dueDate: string;
  publishDate: string;
  plannedMinutes: number;
  loggedMinutes: number;
  editSteps: Record<EditStep, boolean>;
  qc: Record<string, "pass" | "fail" | "pending">;
  revisionsUsed: number;
  versions: VideoVersion[];
  comments: ClientComment[];
  delayReason?: string;
  platform: string[];
  publishedUrl?: string;
}

export interface Shoot {
  id: string;
  projectName: string;
  clientId: string;
  date: string;
  callTime: string;
  location: string;
  batchNo: string;
  kit: "dual" | "single";
  cameraId: string;
  directorId: string;
  videoIds: string[];
  status: "planned" | "packed" | "on-shoot" | "returned" | "closed";
  notes: string;
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  source: "Website" | "Meta Ads" | "Google Ads" | "WhatsApp" | "Referral" | "BNI" | "Instagram" | "Event" | "Walk-in";
  service: Agreement["service"];
  stage: "New" | "Contacted" | "Qualified" | "Discovery" | "Proposal" | "Negotiation" | "Won" | "Lost";
  value: number;
  ownerId: string;
  nextFollowUp: string;
  score: number;
  createdAt: string;
  notes?: string;
}

export interface Asset {
  id: string;
  tag: string;
  name: string;
  category: "Camera" | "Lens" | "Lighting" | "Audio" | "Support" | "Power" | "Storage" | "Computer" | "Accessory";
  purchaseValue: number;
  purchaseDate: string;
  usefulLifeYears: number;
  residualValue: number;
  status: "available" | "reserved" | "checked-out" | "maintenance" | "retired";
  custodianId?: string;
  condition: "Excellent" | "Good" | "Fair" | "Needs repair";
  hoursUsed: number;
}
