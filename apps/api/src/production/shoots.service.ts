import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import type { ShootInput, ShootStatus } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { ProductionSettingsService } from "./production-settings.service.js";

type Ticks = Record<string, { packed?: boolean; shot?: boolean; received?: boolean }>;
type Signatures = Partial<Record<"giver" | "receiver" | "client", { by: string | null; name: string | null; at: string }>>;
const day = (d: Date) => d.toISOString().slice(0, 10);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);

/**
 * Shoots (P2-06): the day, the crew, the agency's kit list ticked as packed, used and received, the pre-shoot checks,
 * signatures for the kit going out and coming back (and the client's sign-off), and incidents for anything missing.
 * The status follows the signatures: packed when the giver signs, returned when the receiver signs, closed when the
 * client has signed too.
 */
@Injectable()
export class ShootsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly settings: ProductionSettingsService,
  ) {}

  private async names(ids: (string | null | undefined)[]) {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (!wanted.length) return new Map<string, string>();
    const people = await this.tenant.db.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
    return new Map(people.map((p) => [p.id, p.name]));
  }

  async list(f: { from?: string; clientId?: string }) {
    const rows = await this.tenant.db.shoot.findMany({
      where: { ...(f.from && { date: { gte: utc(f.from) } }), ...(f.clientId && { clientId: f.clientId }) },
      include: {
        client: { select: { id: true, name: true, code: true } },
        _count: { select: { videos: true } },
        incidents: { where: { resolvedAt: null }, select: { id: true } },
      },
      orderBy: [{ date: "asc" }, { callTime: "asc" }],
      take: 500,
    });
    const s = await this.settings.get();
    const names = await this.names(rows.flatMap((r) => [r.cameraId, r.directorId]));
    return rows.map((r) => {
      const items = s.kits.find((k) => k.key === r.kit)?.items ?? [];
      const ticks = r.kitTicks as Ticks;
      return {
        id: r.id,
        title: r.title,
        client: r.client,
        date: day(r.date),
        callTime: r.callTime,
        location: r.location,
        batchNo: r.batchNo,
        kit: r.kit,
        status: r.status as ShootStatus,
        camera: r.cameraId ? { id: r.cameraId, name: names.get(r.cameraId) ?? null } : null,
        director: r.directorId ? { id: r.directorId, name: names.get(r.directorId) ?? null } : null,
        videos: r._count.videos,
        packed: items.filter((i) => ticks[i]?.packed).length,
        received: items.filter((i) => ticks[i]?.received).length,
        items: items.length,
        openIncidents: r.incidents.length,
      };
    });
  }

  private async find(id: string) {
    const s = await this.tenant.db.shoot.findFirst({ where: { id }, include: { client: { select: { id: true, name: true, code: true } } } });
    if (!s) throw new NotFoundException("No shoot with that id.");
    return s;
  }

  /** The shoot sheet. */
  async get(id: string) {
    const s = await this.find(id);
    const [settings, videos, incidents] = await Promise.all([
      this.settings.get(),
      this.tenant.db.video.findMany({
        where: { shootId: id },
        orderBy: { code: "asc" },
        select: { id: true, code: true, title: true, urgency: true, clipNo: true, protectedAt: true, editorId: true, stage: true },
      }),
      this.tenant.db.shootIncident.findMany({ where: { shootId: id }, orderBy: { createdAt: "desc" } }),
    ]);
    const sig = s.signatures as Signatures;
    const names = await this.names([s.cameraId, s.directorId, ...videos.map((v) => v.editorId), ...incidents.map((i) => i.createdBy)]);
    const who = (pid: string | null) => (pid ? { id: pid, name: names.get(pid) ?? null } : null);
    const kit = settings.kits.find((k) => k.key === s.kit);
    return {
      id: s.id,
      title: s.title,
      client: s.client,
      date: day(s.date),
      callTime: s.callTime,
      location: s.location,
      batchNo: s.batchNo,
      kit: { key: s.kit, name: kit?.name ?? s.kit, items: kit?.items ?? [] },
      status: s.status as ShootStatus,
      camera: who(s.cameraId),
      director: who(s.directorId),
      notes: s.notes,
      kitTicks: s.kitTicks as Ticks,
      preShootItems: settings.preShoot,
      preShoot: s.preShoot as Record<string, boolean>,
      signatures: sig,
      videos: videos.map((v) => ({
        id: v.id,
        code: v.code,
        title: v.title,
        urgency: v.urgency,
        clipNo: v.clipNo,
        protected: !!v.protectedAt,
        editor: who(v.editorId),
        stage: v.stage,
      })),
      incidents: incidents.map((i) => ({ id: i.id, items: i.items, note: i.note, resolved: !!i.resolvedAt, by: who(i.createdBy), createdAt: i.createdAt })),
    };
  }

  private async attach(tx: Prisma.TransactionClient, shootId: string, clientId: string, videoIds: string[]) {
    if (!videoIds.length) return;
    const n = await tx.video.count({ where: { id: { in: videoIds }, clientId } });
    if (n !== videoIds.length)
      throw new BadRequestException({ message: "Pick this client's videos.", issues: [{ path: "videoIds", message: "Only this client's videos" }] });
    await tx.video.updateMany({ where: { id: { in: videoIds } }, data: { shootId } });
    // Videos still being planned or scripted are now waiting for the shoot.
    const moving = await tx.video.findMany({ where: { id: { in: videoIds }, stage: { in: ["planned", "scripting"] } }, select: { id: true, stage: true } });
    for (const v of moving) {
      await tx.video.update({ where: { id: v.id }, data: { stage: "shoot_scheduled" } });
      await tx.videoStageChange.create({
        data: { agencyId: this.tenant.agencyId, videoId: v.id, from: v.stage, to: "shoot_scheduled", note: "Shoot scheduled", by: this.tenant.userId },
      });
    }
  }

  async create(input: ShootInput & { videoIds: string[] }) {
    const s = await this.settings.get();
    if (!s.kits.some((k) => k.key === input.kit))
      throw new BadRequestException({ message: "Choose one of your kit lists.", issues: [{ path: "kit", message: "Choose a kit list" }] });
    const client = await this.tenant.db.client.findFirst({ where: { id: input.clientId }, select: { id: true, name: true } });
    if (!client) throw new BadRequestException({ message: "Choose one of your clients.", issues: [{ path: "clientId", message: "Choose the client" }] });
    const id = await this.tenant.tx(async (tx) => {
      const shoot = await tx.shoot.create({
        data: {
          agencyId: this.tenant.agencyId,
          clientId: input.clientId,
          title: input.title,
          date: utc(input.date),
          callTime: input.callTime,
          location: input.location,
          batchNo: input.batchNo,
          kit: input.kit,
          cameraId: input.cameraId ?? undefined,
          directorId: input.directorId ?? undefined,
          notes: input.notes,
          createdBy: this.tenant.userId,
        },
      });
      await this.attach(tx, shoot.id, input.clientId, input.videoIds);
      await this.audit.record(tx, {
        action: "create",
        entity: "shoot",
        entityId: shoot.id,
        after: { title: shoot.title, client: client.name, date: input.date, videos: input.videoIds.length },
      });
      await this.notifications.notify(
        tx,
        { users: [shoot.cameraId, shoot.directorId] },
        {
          kind: "video_assigned",
          title: `Shoot on ${input.date}: ${shoot.title}`,
          body: [input.callTime, input.location].filter(Boolean).join(" · ") || undefined,
          link: `/app/shoots/${shoot.id}`,
        },
      );
      return shoot.id;
    });
    return this.get(id);
  }

  async update(id: string, input: Partial<ShootInput>) {
    const s = await this.find(id);
    if (s.status === "closed") throw new ConflictException("This shoot is closed.");
    await this.tenant.tx(async (tx) => {
      const { videoIds, ...rest } = input;
      await tx.shoot.update({ where: { id }, data: { ...rest, date: rest.date ? utc(rest.date) : undefined } });
      if (videoIds) {
        await tx.video.updateMany({ where: { shootId: id, id: { notIn: videoIds } }, data: { shootId: null } });
        await this.attach(tx, id, s.clientId, videoIds);
      }
    });
    return this.get(id);
  }

  async tickKit(id: string, item: string, column: "packed" | "shot" | "received", done: boolean) {
    const s = await this.find(id);
    if (s.status === "closed") throw new ConflictException("This shoot is closed.");
    const settings = await this.settings.get();
    if (!settings.kits.find((k) => k.key === s.kit)?.items.includes(item)) throw new BadRequestException("That item is not on this shoot's kit list.");
    if (column === "packed" && s.status !== "planned") throw new ConflictException("The kit is already signed out.");
    const ticks = { ...(s.kitTicks as Ticks) };
    ticks[item] = { ...ticks[item], [column]: done };
    await this.tenant.db.shoot.update({ where: { id }, data: { kitTicks: ticks as Prisma.InputJsonValue } });
    return this.get(id);
  }

  /** Ticks every item in a column at once. */
  async tickAll(id: string, column: "packed" | "received") {
    const s = await this.find(id);
    const settings = await this.settings.get();
    const ticks = { ...(s.kitTicks as Ticks) };
    for (const item of settings.kits.find((k) => k.key === s.kit)?.items ?? []) ticks[item] = { ...ticks[item], [column]: true };
    await this.tenant.db.shoot.update({ where: { id }, data: { kitTicks: ticks as Prisma.InputJsonValue } });
    return this.get(id);
  }

  async tickPreShoot(id: string, item: string, done: boolean) {
    const s = await this.find(id);
    const pre = { ...(s.preShoot as Record<string, boolean>) };
    if (done) pre[item] = true;
    else delete pre[item];
    await this.tenant.db.shoot.update({ where: { id }, data: { preShoot: pre } });
    return this.get(id);
  }

  async start(id: string) {
    const s = await this.find(id);
    if (s.status !== "packed") throw new ConflictException("Sign the kit out first.");
    await this.setStatus(s, "on_shoot");
    return this.get(id);
  }

  /** Signatures: the giver once everything is packed; the receiver once everything is back; the client after that. */
  async sign(id: string, as: "giver" | "receiver" | "client", name?: string) {
    const s = await this.find(id);
    const settings = await this.settings.get();
    const items = settings.kits.find((k) => k.key === s.kit)?.items ?? [];
    const ticks = s.kitTicks as Ticks;
    const sig = { ...(s.signatures as Signatures) };
    let status = s.status as ShootStatus;
    if (as === "giver") {
      const open = items.filter((i) => !ticks[i]?.packed).length;
      if (open) throw new ConflictException(`${open} kit items are not packed yet.`);
      status = "packed";
    } else if (as === "receiver") {
      if (!sig.giver) throw new ConflictException("The kit was never signed out.");
      const missing = items.filter((i) => ticks[i]?.packed && !ticks[i]?.received);
      if (missing.length) throw new ConflictException(`Not back yet: ${missing.join(", ")}. Raise an incident for anything missing.`);
      status = sig.client ? "closed" : "returned";
    } else {
      if (!sig.receiver) throw new ConflictException("The client signs after the kit is back.");
      if (!name) throw new BadRequestException({ message: "Whose signature is it?", issues: [{ path: "name", message: "Enter the client's name" }] });
      status = "closed";
    }
    sig[as] = { by: this.tenant.userId ?? null, name: name ?? null, at: new Date().toISOString() };
    await this.tenant.tx(async (tx) => {
      await tx.shoot.update({ where: { id }, data: { signatures: sig as Prisma.InputJsonValue, status } });
      await this.audit.record(tx, { action: "sign", entity: "shoot", entityId: id, after: { title: s.title, as, status } });
    });
    return this.get(id);
  }

  private async setStatus(s: { id: string; title: string; status: string }, status: ShootStatus) {
    await this.tenant.tx(async (tx) => {
      await tx.shoot.update({ where: { id: s.id }, data: { status } });
      await this.audit.record(tx, {
        action: "update",
        entity: "shoot",
        entityId: s.id,
        before: { title: s.title, status: s.status },
        after: { title: s.title, status },
      });
    });
  }

  /** The shoot is done: its videos waiting for it move to Shot. */
  async videosShot(id: string) {
    const s = await this.find(id);
    if (s.status === "planned" || s.status === "packed") throw new ConflictException("Start the shoot first.");
    const waiting = await this.tenant.db.video.findMany({ where: { shootId: id, stage: "shoot_scheduled" }, select: { id: true } });
    await this.tenant.tx(async (tx) => {
      for (const v of waiting) {
        await tx.video.update({ where: { id: v.id }, data: { stage: "shot" } });
        await tx.videoStageChange.create({
          data: { agencyId: this.tenant.agencyId, videoId: v.id, from: "shoot_scheduled", to: "shot", note: `Shot on ${day(s.date)}`, by: this.tenant.userId },
        });
      }
    });
    return this.get(id);
  }

  async incident(id: string, input: { items: string[]; note: string }) {
    const s = await this.find(id);
    await this.tenant.tx(async (tx) => {
      const i = await tx.shootIncident.create({
        data: { agencyId: this.tenant.agencyId, shootId: id, items: input.items, note: input.note, createdBy: this.tenant.userId },
      });
      await this.audit.record(tx, {
        action: "create",
        entity: "shoot_incident",
        entityId: i.id,
        after: { shoot: s.title, items: input.items, note: input.note },
      });
    });
    return this.get(id);
  }

  async resolveIncident(id: string, incidentId: string) {
    await this.find(id);
    const i = await this.tenant.db.shootIncident.findFirst({ where: { id: incidentId, shootId: id } });
    if (!i) throw new NotFoundException("No incident with that id.");
    await this.tenant.db.shootIncident.update({ where: { id: incidentId }, data: { resolvedAt: new Date(), resolvedBy: this.tenant.userId } });
    return this.get(id);
  }
}
