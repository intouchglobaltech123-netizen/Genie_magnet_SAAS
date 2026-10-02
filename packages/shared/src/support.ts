// Support access (P6-08, ADR 0011): the platform's support team comes into an agency only with its consent — for the
// hours it allows, seeing only or also fixing, for the reason it gives — and everything done meanwhile is in the
// agency's audit log. Salaries and people's personal planners stay closed to support whatever the agency allows.
import { z } from "zod";
import { type AreaKey, type PermissionMatrix, PERMISSION_AREAS } from "./permissions.js";

const text = (max: number) => z.string().trim().max(max);

export const SUPPORT_LEVELS = ["view", "edit"] as const;
export type SupportLevel = (typeof SUPPORT_LEVELS)[number];
export const SUPPORT_LEVEL_LABEL: Record<SupportLevel, string> = { view: "See only", edit: "See and fix" };

export const supportGrantInput = z.object({
  hours: z.number().int().min(1, "At least an hour").max(72, "At most three days"),
  level: z.enum(SUPPORT_LEVELS).default("view"),
  reason: text(300).min(3, "Say what support should look at"),
});
export type SupportGrantInput = z.input<typeof supportGrantInput>;

/** Never open to support: salaries and payroll, people's personal planners, and the client portal. */
const CLOSED: AreaKey[] = ["salaries", "personal_finance", "portal"];
/** Seen but never changed by support: who is on the team and what roles may do. */
const SEE_ONLY: AreaKey[] = ["team", "roles"];

/** What support may do in the agency at the level it allowed. */
export function supportPermissions(level: SupportLevel): PermissionMatrix {
  const m: PermissionMatrix = {};
  for (const a of PERMISSION_AREAS) {
    if (CLOSED.includes(a.key)) continue;
    const fix = level === "edit" && !SEE_ONLY.includes(a.key) && a.max !== "view";
    m[a.key] = { level: fix ? "edit" : "view" };
  }
  return m;
}

/** GET /support-access (one item) */
export interface SupportGrantRow {
  id: string;
  level: SupportLevel;
  reason: string;
  expiresAt: string;
  grantedBy: { id: string; name: string | null };
  revokedAt: string | null;
  revokedBy: { id: string; name: string | null } | null;
  /** The last time support came in on it. */
  lastUsedAt: string | null;
  active: boolean;
  createdAt: string;
}

/** On GET /me while someone from the platform's team is in an agency on its consent. */
export interface SupportVisit {
  agencyId: string;
  agencyName: string;
  level: SupportLevel;
  until: string;
}
