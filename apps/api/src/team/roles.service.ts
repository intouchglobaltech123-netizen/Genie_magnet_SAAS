import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ensureDefaultRoles, type Prisma } from "@gm/db";
import {
  DEFAULT_ROLES,
  exceeds,
  FULL_ACCESS,
  OWNER_ROLE,
  type PermissionMatrix,
  permissionArea,
  permissionMatrix,
  type RoleInput,
  type RoleUpdate,
} from "@gm/shared";
import { AuditService, changes } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

type RoleRow = { id: string; key: string; name: string; description: string | null; permissions: Prisma.JsonValue; isClient: boolean };

/** A stored matrix, read defensively: anything invalid grants nothing. The owner role is always full access. */
export function matrixOf(role: Pick<RoleRow, "key" | "permissions">): PermissionMatrix {
  if (role.key === OWNER_ROLE) return FULL_ACCESS;
  const parsed = permissionMatrix.safeParse(role.permissions);
  return parsed.success ? parsed.data : {};
}

const present = (r: RoleRow, members = 0) => ({
  key: r.key,
  name: r.name,
  description: r.description,
  isOwner: r.key === OWNER_ROLE,
  isClient: r.isClient,
  permissions: matrixOf(r),
  members,
});

/** Turns a role name into its permanent key: "Technical support" → technical_support (then _2, _3… if taken). */
function keyFor(name: string, taken: Set<string>) {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "role";
  let key = base;
  for (let i = 2; taken.has(key) || key === OWNER_ROLE; i++) key = `${base}_${i}`;
  return key;
}

/**
 * The agency's roles and permission matrix (P1-11). Rules that keep it safe:
 * the owner role cannot be changed; nobody can give a role more access than they have themselves
 * (or touch a role that has more than they do); a role in use cannot be deleted. Every change is audited.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const agencyId = this.tenant.agencyId;
    let roles = await this.tenant.db.role.findMany({ orderBy: { createdAt: "asc" } });
    if (!roles.length) {
      // An agency whose set-up was interrupted gets its default roles now.
      await this.tenant.tx((tx) => ensureDefaultRoles(tx, agencyId));
      roles = await this.tenant.db.role.findMany({ orderBy: { createdAt: "asc" } });
    }
    const counts = await this.tenant.db.membership.groupBy({ by: ["role"], where: { agencyId }, _count: { _all: true } });
    const members = new Map(counts.map((c) => [c.role, c._count._all]));
    // Default roles in their usual order (owner first), then the agency's own roles in the order they were made.
    const rank = (key: string) => {
      const i = (DEFAULT_ROLES as readonly string[]).indexOf(key);
      return i === -1 ? DEFAULT_ROLES.length : i;
    };
    const ordered = roles.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r.key) - rank(b.r.key) || a.i - b.i);
    return ordered.map(({ r }) => present(r, members.get(r.key) ?? 0));
  }

  async find(key: string) {
    const role = await this.tenant.db.role.findUnique({ where: { agencyId_key: { agencyId: this.tenant.agencyId, key } } });
    if (!role) throw new NotFoundException(`There is no role "${key}" in this agency.`);
    return role;
  }

  async create(input: RoleInput) {
    const agencyId = this.tenant.agencyId;
    const permissions = input.permissions ?? (input.copyFrom ? matrixOf(await this.find(input.copyFrom)) : {});
    this.assertWithinOwn(permissions);
    const taken = new Set((await this.tenant.db.role.findMany({ select: { key: true } })).map((r) => r.key));
    const key = keyFor(input.name, taken);
    return this.tenant.tx(async (tx) => {
      const role = await tx.role.create({
        data: { agencyId, key, name: input.name, description: input.description, permissions: permissions as Prisma.InputJsonObject },
      });
      await this.audit.record(tx, { action: "create", entity: "role", entityId: role.id, after: { key, name: role.name, permissions } });
      return present(role);
    });
  }

  async update(key: string, input: RoleUpdate) {
    if (key === OWNER_ROLE) throw new ForbiddenException("The owner role always has full access and cannot be changed.");
    const role = await this.find(key);
    const current = matrixOf(role);
    this.assertWithinOwn(current);
    if (input.permissions) this.assertWithinOwn(input.permissions);

    const before = { name: role.name, description: role.description, permissions: current };
    const after = {
      name: input.name ?? role.name,
      description: input.description === undefined ? role.description : input.description,
      permissions: input.permissions ?? current,
    };
    const diff = changes(before, after);
    if (!diff) return present(role);
    return this.tenant.tx(async (tx) => {
      const updated = await tx.role.update({
        where: { id: role.id },
        data: { name: after.name, description: after.description, permissions: after.permissions as Prisma.InputJsonObject },
      });
      // The role's name is kept on both sides so the entry says which role changed, even when only permissions did.
      await this.audit.record(tx, {
        action: "update",
        entity: "role",
        entityId: role.id,
        before: { name: role.name, ...diff.before },
        after: { name: after.name, ...diff.after },
      });
      return present(updated);
    });
  }

  async remove(key: string) {
    if (key === OWNER_ROLE) throw new ForbiddenException("The owner role cannot be deleted.");
    const agencyId = this.tenant.agencyId;
    const role = await this.find(key);
    this.assertWithinOwn(matrixOf(role));
    const [members, invitations] = await Promise.all([
      this.tenant.db.membership.count({ where: { agencyId, role: key } }),
      this.tenant.db.invitation.count({ where: { agencyId, role: key, status: "pending" } }),
    ]);
    if (members || invitations) {
      throw new ConflictException(`${members} people and ${invitations} pending invitations use "${role.name}". Give them another role first.`);
    }
    await this.tenant.tx(async (tx) => {
      await tx.role.delete({ where: { id: role.id } });
      await this.audit.record(tx, { action: "delete", entity: "role", entityId: role.id, before: { key, name: role.name, permissions: matrixOf(role) } });
    });
  }

  /** Nobody but an owner may hand out — or edit a role holding — more access than they have themselves. */
  assertWithinOwn(wanted: PermissionMatrix) {
    if (this.tenant.role === OWNER_ROLE) return;
    const over = exceeds(wanted, this.tenant.permissions);
    if (over.length) {
      throw new ForbiddenException(`That goes beyond your own access (${over.map((a) => permissionArea(a).label).join(", ")}). Ask an owner.`);
    }
  }
}
