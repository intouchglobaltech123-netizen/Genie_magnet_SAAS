import { Injectable } from "@nestjs/common";
import { forAgency, type Prisma, type TenantTx } from "@gm/db";
import type { AuditQuery } from "@gm/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

type Fields = Record<string, unknown>;

export interface AuditEntry {
  /** create · update · delete, or a domain verb (approve, send, invite, accept, cancel, seed…). */
  action: string;
  /** Singular record type: client, agreement, package, invoice, role, membership, invitation, answer… */
  entity: string;
  entityId?: string;
  /** For updates, only the fields that changed (see `changes`). */
  before?: Fields | null;
  after?: Fields | null;
}

/** Writes an entry for a change made outside our own transactions (sign-in service events). */
export type AuditWriter = (agencyId: string, actorId: string | undefined, entry: AuditEntry) => Promise<void>;

/** Only the fields whose values differ, or null when nothing changed (then no entry is written). */
export function changes(before: Fields, after: Fields): { before: Fields; after: Fields } | null {
  const b: Fields = {};
  const a: Fields = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      b[key] = before[key] ?? null;
      a[key] = after[key] ?? null;
    }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}

const json = (v: Fields | null | undefined) => (v ? (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonObject) : undefined);

function row(agencyId: string, actorId: string | undefined, e: AuditEntry) {
  return { agencyId, actorId, action: e.action, entity: e.entity, entityId: e.entityId, before: json(e.before), after: json(e.after) };
}

/**
 * The audit log (P1-03): who changed what, and when. Entries are append-only — the API's database role
 * cannot update or delete them.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly prisma: PrismaService,
  ) {}

  /** Inside the change's own transaction (`TenantDb.tx`): the change and its entry are saved together or not at all. */
  async record(tx: TenantTx, entry: AuditEntry) {
    await tx.auditLog.create({ data: row(this.tenant.agencyId, this.tenant.userId, entry) });
  }

  /** For changes made by the sign-in service (invitations, roles, removals): written straight after the change. */
  readonly recordFor: AuditWriter = async (agencyId, actorId, entry) => {
    await forAgency(this.prisma.client, agencyId, actorId).auditLog.create({ data: row(agencyId, actorId, entry) });
  };

  /** Newest first, with the name of the person who made each change. */
  async list(q: AuditQuery) {
    const rows = await this.tenant.db.auditLog.findMany({
      where: {
        entity: q.entity,
        entityId: q.entityId,
        actorId: q.actorId,
        at: q.from || q.to ? { gte: q.from, lt: q.to } : undefined,
      },
      orderBy: [{ at: "desc" }, { id: "desc" }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, q.limit);
    const actorIds = [...new Set(page.map((r) => r.actorId).filter((id): id is string => !!id))];
    // Only people who are still members are visible; former members show without a name.
    const people = actorIds.length ? await this.tenant.db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
    const names = new Map(people.map((p) => [p.id, p.name]));
    return {
      items: page.map((r) => ({
        id: r.id,
        at: r.at,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        actor: r.actorId ? { id: r.actorId, name: names.get(r.actorId) ?? null } : null,
        before: r.before,
        after: r.after,
      })),
      next: rows.length > q.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }
}
