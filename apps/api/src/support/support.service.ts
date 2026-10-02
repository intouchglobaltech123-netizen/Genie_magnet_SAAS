import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { asPlatform } from "@gm/db";
import { type SupportGrantInput, supportGrantInput, type SupportGrantRow, type SupportLevel } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { Secrets } from "../common/secrets.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SUPPORT_ROLE, TenantDb } from "../tenancy/tenant-context.js";

const HOUR = 3_600_000;

/**
 * Support access (P6-08, ADR 0011). The agency lets the platform's support team in — for some hours, seeing only or
 * also fixing, for a reason — and can take it back; the platform's team comes in only while such consent lasts, under
 * a sealed cookie bound to the person, and every visit and change is in the agency's audit log.
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly secrets: Secrets,
  ) {}

  // ─── The agency's side ──────────────────────────────────────────────

  async list(): Promise<SupportGrantRow[]> {
    const rows = await this.tenant.db.supportGrant.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    const ids = [...new Set(rows.flatMap((r) => [r.grantedBy, r.revokedBy]).filter((x): x is string => !!x))];
    const users = ids.length ? await this.tenant.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const name = (id: string) => ({ id, name: users.find((u) => u.id === id)?.name ?? null });
    const now = new Date();
    return rows.map((r) => ({
      id: r.id,
      level: r.level as SupportLevel,
      reason: r.reason,
      expiresAt: r.expiresAt.toISOString(),
      grantedBy: name(r.grantedBy),
      revokedAt: r.revokedAt?.toISOString() ?? null,
      revokedBy: r.revokedBy ? name(r.revokedBy) : null,
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      active: !r.revokedAt && r.expiresAt > now,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Support never changes its own access. */
  private notSupport() {
    if (this.tenant.role === SUPPORT_ROLE) throw new ForbiddenException("Support cannot change its own access.");
  }

  async grant(input: SupportGrantInput) {
    this.notSupport();
    const g = supportGrantInput.parse(input);
    await this.tenant.tx(async (tx) => {
      const created = await tx.supportGrant.create({
        data: {
          agencyId: this.tenant.agencyId,
          level: g.level,
          reason: g.reason,
          expiresAt: new Date(Date.now() + g.hours * HOUR),
          grantedBy: this.tenant.userId ?? "",
        },
      });
      await this.audit.record(tx, {
        action: "create",
        entity: "support_grant",
        entityId: created.id,
        after: { level: g.level, hours: g.hours, reason: g.reason },
      });
    });
    return this.list();
  }

  async revoke(id: string) {
    this.notSupport();
    const g = await this.tenant.db.supportGrant.findFirst({ where: { id } });
    if (!g) throw new NotFoundException("No support access with that id.");
    if (g.revokedAt) throw new ConflictException("It was already taken back.");
    await this.tenant.tx(async (tx) => {
      await tx.supportGrant.update({ where: { id }, data: { revokedAt: new Date(), revokedBy: this.tenant.userId ?? null } });
      await this.audit.record(tx, { action: "update", entity: "support_grant", entityId: id, after: { revoked: true } });
    });
    return this.list();
  }

  // ─── The platform's side ────────────────────────────────────────────

  /** Agencies that let support in now: until when, and how far. */
  async open(): Promise<Map<string, { until: string; level: SupportLevel }>> {
    const rows = await asPlatform(this.prisma.client, (tx) =>
      tx.supportGrant.findMany({ where: { revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { expiresAt: "asc" } }),
    );
    return new Map(rows.map((r) => [r.agencyId, { until: r.expiresAt.toISOString(), level: r.level as SupportLevel }]));
  }

  /** Comes into the agency on its consent: the sealed visit, and how long it may last. */
  async enter(agencyId: string, adminId: string) {
    const grant = await asPlatform(this.prisma.client, async (tx) => {
      const g = await tx.supportGrant.findFirst({ where: { agencyId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { expiresAt: "desc" } });
      if (g) await tx.supportGrant.update({ where: { id: g.id }, data: { lastUsedAt: new Date() } });
      return g;
    });
    if (!grant) throw new ConflictException("This agency has not let support in, or its access has ended.");
    await this.audit.recordFor(agencyId, adminId, {
      action: "support_enter",
      entity: "support_grant",
      entityId: grant.id,
      after: { level: grant.level, reason: grant.reason },
    });
    return {
      sealed: this.secrets.encrypt(JSON.stringify({ a: agencyId, g: grant.id, u: adminId })),
      maxAge: grant.expiresAt.getTime() - Date.now(),
    };
  }

  /** Leaves the agency; the agency's audit log says so. */
  async leave(sealed: string | null, adminId: string) {
    if (!sealed) return;
    try {
      const v = JSON.parse(this.secrets.decrypt(sealed)) as { a: string; g: string; u: string };
      if (v.u === adminId) await this.audit.recordFor(v.a, adminId, { action: "support_leave", entity: "support_grant", entityId: v.g });
    } catch {
      // Nothing to record for a cookie that is not ours.
    }
  }
}
