// What the API returns, as the web app receives it (dates are ISO strings). The API's e2e tests check these shapes.
import type { PermissionMatrix } from "./permissions.js";
import type { BusinessStage } from "./enums.js";
import type { DeliverableInput } from "./schemas.js";

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
