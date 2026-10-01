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
  createdAt: string;
  contacts: { id: string; name: string; title: string | null; email: string | null; phone: string; approver: boolean }[];
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
