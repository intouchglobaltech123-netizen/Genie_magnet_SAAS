// Who may see and do what (P1-11, ADR 0004). Each agency has a permission matrix — areas × roles, each cell
// none / view / edit / approve — that its owner edits in Settings. These are only the starting values every
// new agency gets; the API enforces the agency's saved matrix and the web app uses the same rules to hide actions.
import { z } from "zod";
import { DEFAULT_ROLE_LABELS, type DefaultRole } from "./enums.js";

/** Ordered: each level includes the ones before it (edit can view, approve can edit). */
export const PERMISSION_LEVELS = ["none", "view", "edit", "approve"] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export interface PermissionArea {
  key: string;
  label: string;
  group: string;
  /** What "approve" means in this area, shown in Settings. */
  hint?: string;
  /** The highest level that means something here. */
  max: PermissionLevel;
  /** Can be limited to the person's own records (assigned to them / owned by them). */
  ownable?: boolean;
  /** Off for every role except the owner until granted (salaries, personal finance). */
  sensitive?: boolean;
}

export const PERMISSION_AREAS = [
  { key: "settings", label: "Agency settings", group: "Agency", hint: "Profile, branding, packages, pipeline stages, invoice settings", max: "edit" },
  { key: "team", label: "People", group: "Agency", hint: "Invite people, change their role, remove them", max: "edit" },
  { key: "roles", label: "Roles and permissions", group: "Agency", hint: "Create roles and decide what each may see and do", max: "edit" },
  { key: "audit", label: "Audit log", group: "Agency", max: "view" },
  { key: "crm", label: "Leads and proposals", group: "Sales", hint: "Approve: discounts above the sales limit", max: "approve", ownable: true },
  { key: "clients", label: "Clients", group: "Clients", max: "edit", ownable: true },
  { key: "agreements", label: "Agreements", group: "Clients", hint: "Approve: sign off agreements and renewals", max: "approve" },
  { key: "onboarding", label: "Onboarding", group: "Clients", hint: "Approve: let production start before onboarding is complete", max: "approve" },
  { key: "invoices", label: "Invoices and payments", group: "Money", hint: "Approve: send invoices, record write-offs", max: "approve" },
  { key: "finance", label: "Expenses and finance reports", group: "Money", hint: "Approve: approve expenses", max: "approve" },
  { key: "content", label: "Topics and scripts", group: "Delivery", hint: "Approve: approve scripts", max: "approve", ownable: true },
  { key: "production", label: "Shoots and videos", group: "Delivery", hint: "Approve: internal quality check", max: "approve", ownable: true },
  { key: "publishing", label: "Scheduling and publishing", group: "Delivery", hint: "Approve: publish", max: "approve" },
  {
    key: "projects",
    label: "Projects and tasks",
    group: "Delivery",
    hint: "View: every project and everyone's tasks. Edit: start projects, give tasks to others and keep the task lists",
    max: "edit",
  },
  {
    key: "equipment",
    label: "Equipment and assets",
    group: "Delivery",
    hint: "Edit: check out, return, reserve and report problems. Approve: the register, repairs and retiring items",
    max: "approve",
  },
  {
    key: "reports",
    label: "Goals, reviews and dashboards",
    group: "Management",
    hint: "Edit: goals, reviews, decisions and SOPs. Approve: lock reviews and approve SOPs",
    max: "approve",
  },
  { key: "hr", label: "Attendance, leave and hiring", group: "People", hint: "Approve: approve leave", max: "approve" },
  { key: "salaries", label: "Salaries and payroll", group: "People", hint: "Approve: run payroll", max: "approve", sensitive: true },
  { key: "personal_finance", label: "Personal finance planner", group: "People", max: "edit", sensitive: true },
  { key: "portal", label: "Client portal (their own deliverables)", group: "Client people", hint: "Approve: approve deliverables", max: "approve" },
] as const satisfies readonly PermissionArea[];

export type AreaKey = (typeof PERMISSION_AREAS)[number]["key"];
export const AREA_KEYS = PERMISSION_AREAS.map((a) => a.key) as [AreaKey, ...AreaKey[]];

const areaByKey = new Map<string, PermissionArea>(PERMISSION_AREAS.map((a) => [a.key, a]));
export const permissionArea = (key: AreaKey) => areaByKey.get(key)!;

export interface Grant {
  level: PermissionLevel;
  /** Only for ownable areas: "own" limits the role to records assigned to or owned by the person. */
  scope?: "all" | "own";
}
/** One role's row of the matrix. A missing area means no access. */
export type PermissionMatrix = Partial<Record<AreaKey, Grant>>;

const rank = (level: PermissionLevel | undefined) => PERMISSION_LEVELS.indexOf(level ?? "none");

/** Does this matrix allow `level` in `area`? */
export function allows(matrix: PermissionMatrix, area: AreaKey, level: Exclude<PermissionLevel, "none">) {
  return rank(matrix[area]?.level) >= rank(level);
}

/** "all", "own", or null when the role has no access to the area. */
export function scopeOf(matrix: PermissionMatrix, area: AreaKey): "all" | "own" | null {
  const grant = matrix[area];
  if (!grant || grant.level === "none") return null;
  return grant.scope === "own" ? "own" : "all";
}

/**
 * The areas where `wanted` would go beyond `own` — used so nobody can give a role (their own included)
 * more access than they have themselves.
 */
export function exceeds(wanted: PermissionMatrix, own: PermissionMatrix): AreaKey[] {
  return AREA_KEYS.filter((area) => {
    if (rank(wanted[area]?.level) > rank(own[area]?.level)) return true;
    return scopeOf(own, area) === "own" && scopeOf(wanted, area) === "all";
  });
}

/** The owner role: everything, always. It cannot be edited, so an agency can never lock itself out. */
export const OWNER_ROLE = "owner";
export const FULL_ACCESS: PermissionMatrix = Object.fromEntries(PERMISSION_AREAS.map((a) => [a.key, { level: a.max }]));

/** Validates a matrix sent from Settings: known areas, levels the area allows, "own" only where it means something. */
export const permissionMatrix = z
  .partialRecord(z.enum(AREA_KEYS), z.object({ level: z.enum(PERMISSION_LEVELS), scope: z.enum(["all", "own"]).optional() }))
  .superRefine((m, ctx) => {
    for (const [key, grant] of Object.entries(m)) {
      const area = areaByKey.get(key);
      if (!area || !grant) continue;
      if (rank(grant.level) > rank(area.max)) ctx.addIssue({ code: "custom", path: [key, "level"], message: `${area.label} goes up to "${area.max}"` });
      if (grant.scope === "own" && !area.ownable)
        ctx.addIssue({ code: "custom", path: [key, "scope"], message: `${area.label} cannot be limited to own records` });
    }
  })
  .transform((m) => {
    // Store only real grants, and "own" only where it applies.
    const clean: PermissionMatrix = {};
    for (const [key, grant] of Object.entries(m) as [AreaKey, Grant][]) {
      if (grant.level === "none") continue;
      clean[key] = grant.scope === "own" ? { level: grant.level, scope: "own" } : { level: grant.level };
    }
    return clean;
  });

const g = (level: PermissionLevel, scope?: "own"): Grant => (scope ? { level, scope } : { level });

/** Growth OS starting matrix. Sensitive areas (salaries, personal finance) are off for every role but the owner. */
export const DEFAULT_PERMISSIONS: Record<DefaultRole, PermissionMatrix> = {
  owner: FULL_ACCESS,
  manager: {
    settings: g("edit"),
    team: g("edit"),
    roles: g("view"),
    audit: g("view"),
    crm: g("approve"),
    clients: g("edit"),
    agreements: g("approve"),
    onboarding: g("approve"),
    invoices: g("edit"),
    finance: g("view"),
    content: g("approve"),
    production: g("approve"),
    publishing: g("approve"),
    projects: g("edit"),
    equipment: g("approve"),
    reports: g("approve"),
    hr: g("view"),
  },
  team_leader: {
    team: g("view"),
    crm: g("edit"),
    clients: g("edit"),
    agreements: g("view"),
    onboarding: g("edit"),
    content: g("approve"),
    production: g("approve"),
    publishing: g("edit"),
    projects: g("edit"),
    equipment: g("edit"),
    reports: g("edit"),
  },
  editor: { clients: g("view"), content: g("view"), production: g("edit", "own"), equipment: g("view") },
  shooter: { clients: g("view"), content: g("view"), production: g("edit", "own"), equipment: g("edit") },
  script_writer: { clients: g("view"), onboarding: g("view"), content: g("edit", "own") },
  social_media_manager: { clients: g("view"), content: g("view"), production: g("view"), publishing: g("approve"), reports: g("view") },
  finance: {
    crm: g("view"),
    clients: g("view"),
    agreements: g("view"),
    invoices: g("approve"),
    finance: g("approve"),
    equipment: g("view"),
    reports: g("view"),
  },
  hr: { team: g("view"), hr: g("approve"), projects: g("edit") },
  freelancer: { content: g("view", "own"), production: g("edit", "own") },
  client_approver: { portal: g("approve") },
  client_viewer: { portal: g("view") },
};

export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  permissions: PermissionMatrix;
  /** Client people (approvers, viewers) only ever use the client portal. */
  isClient: boolean;
}

const DESCRIPTIONS: Record<DefaultRole, string> = {
  owner: "Full access, always. Cannot be changed.",
  manager: "Runs the agency day to day: people, clients, delivery and approvals. No salaries.",
  team_leader: "Leads a team: clients, content and production, with approvals.",
  editor: "Edits the videos assigned to them.",
  shooter: "Shoots the videos assigned to them.",
  script_writer: "Writes the scripts assigned to them.",
  social_media_manager: "Schedules and publishes approved content.",
  finance: "Invoices, payments, expenses and finance reports. No salaries.",
  hr: "Attendance, leave and hiring. No salaries unless granted.",
  freelancer: "Works only on what is assigned to them.",
  client_approver: "Client's person who approves their deliverables in the portal.",
  client_viewer: "Client's person who can see their deliverables in the portal.",
};

/** The roles every new agency starts with (copied into its own roles, which it then edits). */
export const DEFAULT_ROLE_DEFINITIONS: RoleDefinition[] = (Object.keys(DEFAULT_PERMISSIONS) as DefaultRole[]).map((key) => ({
  key,
  name: DEFAULT_ROLE_LABELS[key],
  description: DESCRIPTIONS[key],
  permissions: DEFAULT_PERMISSIONS[key],
  isClient: key === "client_approver" || key === "client_viewer",
}));

export const roleInput = z.object({
  name: z.string().trim().min(2, "Give the role a name (at least 2 characters)").max(60, "Keep the name under 60 characters"),
  description: z.string().trim().max(200).optional(),
  /** Start from another role's permissions (copy a role). Ignored when `permissions` is given. */
  copyFrom: z.string().max(60).optional(),
  permissions: permissionMatrix.optional(),
});
export type RoleInput = z.infer<typeof roleInput>;

export const roleUpdate = z.object({
  name: z.string().trim().min(2, "Give the role a name (at least 2 characters)").max(60, "Keep the name under 60 characters").optional(),
  description: z.string().trim().max(200).nullable().optional(),
  permissions: permissionMatrix.optional(),
});
export type RoleUpdate = z.infer<typeof roleUpdate>;

export const invitationInput = z.object({
  email: z.email("Enter a valid email address").transform((e) => e.toLowerCase()),
  role: z.string().min(1, "Choose a role").max(60),
});
export type InvitationInput = z.infer<typeof invitationInput>;

export const memberUpdate = z.object({ role: z.string().min(1).max(60) });
export type MemberUpdate = z.infer<typeof memberUpdate>;
