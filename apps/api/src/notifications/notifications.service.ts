import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { TenantTx } from "@gm/db";
import {
  allows,
  type AreaKey,
  FULL_ACCESS,
  type NotificationKind,
  type NotificationPreferences,
  OWNER_ROLE,
  type PermissionLevel,
  type PermissionMatrix,
  permissionMatrix,
} from "@gm/shared";
import { TenantDb } from "../tenancy/tenant-context.js";

export interface Notice {
  kind: NotificationKind;
  title: string;
  body?: string;
  link?: string;
}

/** Who to tell: these people, and/or everyone whose role has this access. */
export interface Recipients {
  users?: (string | null | undefined)[];
  can?: { area: AreaKey; level: Exclude<PermissionLevel, "none"> };
}

/**
 * Notifications in the app (P1-04). Senders call `notify` inside their own transaction, so a notification exists only
 * when the change it reports was saved. The person who made the change is never told about it, and each person's
 * switched-off kinds are respected. Email joins as a second channel in the last step, reading the same rows.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly tenant: TenantDb) {}

  /** Team members whose role allows `level` in `area` (client people never). */
  private async withAccess(tx: TenantTx, area: AreaKey, level: Exclude<PermissionLevel, "none">) {
    const [members, roles] = await Promise.all([
      tx.membership.findMany({ where: { agencyId: this.tenant.agencyId }, select: { userId: true, role: true } }),
      tx.role.findMany({ where: { agencyId: this.tenant.agencyId }, select: { key: true, permissions: true, isClient: true } }),
    ]);
    const matrix = new Map<string, PermissionMatrix | null>(
      roles.map((r) => [r.key, r.isClient ? null : r.key === OWNER_ROLE ? FULL_ACCESS : (permissionMatrix.safeParse(r.permissions).data ?? {})]),
    );
    return members.filter((m) => (m.role === OWNER_ROLE ? true : !!matrix.get(m.role) && allows(matrix.get(m.role)!, area, level))).map((m) => m.userId);
  }

  async notify(tx: TenantTx, to: Recipients, notice: Notice) {
    const ids = new Set((to.users ?? []).filter((u): u is string => !!u));
    if (to.can) for (const id of await this.withAccess(tx, to.can.area, to.can.level)) ids.add(id);
    ids.delete(this.tenant.userId ?? "");
    if (!ids.size) return;
    const muted = await tx.notificationPreference.findMany({
      where: { agencyId: this.tenant.agencyId, userId: { in: [...ids] }, muted: { has: notice.kind } },
      select: { userId: true },
    });
    for (const m of muted) ids.delete(m.userId);
    if (!ids.size) return;
    await tx.notification.createMany({
      data: [...ids].map((userId) => ({
        agencyId: this.tenant.agencyId,
        userId,
        kind: notice.kind,
        title: notice.title,
        body: notice.body,
        link: notice.link,
      })),
    });
  }

  private me() {
    const userId = this.tenant.userId;
    if (!userId) throw new UnauthorizedException("Sign in to see your notifications.");
    return userId;
  }

  /** The newest first, with how many are unread. */
  async list(unreadOnly: boolean) {
    const userId = this.me();
    const [items, unread] = await Promise.all([
      this.tenant.db.notification.findMany({ where: { userId, ...(unreadOnly && { readAt: null }) }, orderBy: { createdAt: "desc" }, take: 100 }),
      this.tenant.db.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      unread,
      items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, read: !!n.readAt, createdAt: n.createdAt })),
    };
  }

  async markRead(ids?: string[]) {
    const userId = this.me();
    await this.tenant.db.notification.updateMany({ where: { userId, readAt: null, ...(ids && { id: { in: ids } }) }, data: { readAt: new Date() } });
    return this.list(false);
  }

  async preferences(): Promise<NotificationPreferences> {
    const p = await this.tenant.db.notificationPreference.findUnique({ where: { agencyId_userId: { agencyId: this.tenant.agencyId, userId: this.me() } } });
    return { muted: (p?.muted ?? []) as NotificationKind[], quietFrom: p?.quietFrom ?? null, quietTo: p?.quietTo ?? null };
  }

  async savePreferences(input: NotificationPreferences) {
    const key = { agencyId: this.tenant.agencyId, userId: this.me() };
    await this.tenant.db.notificationPreference.upsert({ where: { agencyId_userId: key }, create: { ...key, ...input }, update: input });
    return this.preferences();
  }
}
