import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { asPlatform, type TenantTx, withAgency } from "@gm/db";
import { allows, type TicketCategory, type TicketDetail, type TicketInput, type TicketRow, type TicketStatus, ticketRef } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  page: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
};
type Message = { id: string; body: string; fromPlatform: boolean; authorName: string; createdAt: Date };

const row = (t: Ticket): TicketRow => ({
  id: t.id,
  ref: ticketRef(t.id),
  subject: t.subject,
  category: t.category as TicketCategory,
  status: t.status as TicketStatus,
  page: t.page,
  createdBy: { id: t.createdBy, name: t.createdByName },
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});
const messages = (ms: Message[]) =>
  ms.map((m) => ({ id: m.id, body: m.body, fromSupport: m.fromPlatform, author: m.authorName, createdAt: m.createdAt.toISOString() }));

/**
 * The support inbox (P6-15). In the agency: each person sees the messages they wrote, and those who keep the settings
 * see all of the agency's. On the platform: the support team sees every agency's and replies; its reply is written in
 * the agency's own records, and the person who wrote is told.
 */
@Injectable()
export class HelpdeskService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  private me() {
    if (!this.tenant.userId || this.tenant.support) throw new ForbiddenException("Write to support as someone in the agency.");
    return this.tenant.userId;
  }

  private seesAll() {
    return allows(this.tenant.permissions, "settings", "view");
  }

  private async name(userId: string) {
    return (await this.tenant.db.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? "";
  }

  // ─── In the agency ──────────────────────────────────────────────────

  async list(): Promise<TicketRow[]> {
    const me = this.me();
    const rows = await this.tenant.db.supportTicket.findMany({ where: this.seesAll() ? {} : { createdBy: me }, orderBy: { updatedAt: "desc" }, take: 100 });
    return rows.map(row);
  }

  async get(id: string): Promise<TicketDetail> {
    const me = this.me();
    const t = await this.tenant.db.supportTicket.findFirst({
      where: { id, ...(this.seesAll() ? {} : { createdBy: me }) },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!t) throw new NotFoundException("No message with that reference.");
    return { ...row(t), messages: messages(t.messages) };
  }

  async create(input: TicketInput) {
    const me = this.me();
    const name = await this.name(me);
    const id = await this.tenant.tx(async (tx) => {
      const t = await tx.supportTicket.create({
        data: { agencyId: this.tenant.agencyId, subject: input.subject, category: input.category, page: input.page, createdBy: me, createdByName: name },
      });
      await tx.supportMessage.create({ data: { agencyId: this.tenant.agencyId, ticketId: t.id, authorId: me, authorName: name, body: input.body } });
      await this.audit.record(tx, { action: "create", entity: "support_ticket", entityId: t.id, after: { subject: input.subject, category: input.category } });
      return t.id;
    });
    return this.get(id);
  }

  async reply(id: string, body: string) {
    const me = this.me();
    const t = await this.get(id);
    if (t.status === "closed") throw new ConflictException("This conversation is closed. Write a new message instead.");
    const name = await this.name(me);
    await this.tenant.tx(async (tx) => {
      await tx.supportMessage.create({ data: { agencyId: this.tenant.agencyId, ticketId: id, authorId: me, authorName: name, body } });
      await tx.supportTicket.update({ where: { id }, data: { status: "open" } });
    });
    return this.get(id);
  }

  async close(id: string) {
    this.me();
    const t = await this.get(id);
    if (t.status !== "closed")
      await this.tenant.tx(async (tx) => {
        await tx.supportTicket.update({ where: { id }, data: { status: "closed", closedAt: new Date() } });
        await this.audit.record(tx, { action: "update", entity: "support_ticket", entityId: id, after: { status: "closed" } });
      });
    return this.get(id);
  }

  // ─── On the platform ────────────────────────────────────────────────

  /** Every agency's, waiting for support first. */
  async platformList(): Promise<TicketRow[]> {
    const [tickets, agencies] = await asPlatform(this.prisma.client, (tx) =>
      Promise.all([tx.supportTicket.findMany({ orderBy: { updatedAt: "desc" }, take: 300 }), tx.agency.findMany({ select: { id: true, name: true } })]),
    );
    const names = new Map(agencies.map((a) => [a.id, a.name]));
    const order = { open: 0, answered: 1, closed: 2 } as Record<string, number>;
    return tickets
      .map((t) => ({ ...row(t), agency: { id: t.agencyId, name: names.get(t.agencyId) ?? "" } }))
      .sort((a, b) => order[a.status]! - order[b.status]! || b.updatedAt.localeCompare(a.updatedAt));
  }

  async platformGet(id: string): Promise<TicketDetail> {
    const t = await asPlatform(this.prisma.client, (tx) =>
      tx.supportTicket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } }),
    );
    if (!t) throw new NotFoundException("No message with that reference.");
    const agency = await asPlatform(this.prisma.client, (tx) => tx.agency.findUnique({ where: { id: t.agencyId }, select: { id: true, name: true } }));
    return { ...row(t), agency: agency ?? { id: t.agencyId, name: "" }, messages: messages(t.messages) };
  }

  /** The support team's reply, written in the agency's own records; the person who wrote is told. */
  async platformReply(id: string, body: string, by: { id: string; name: string }, close: boolean) {
    const t = await this.platformGet(id);
    await withAgency(this.prisma.client, t.agency!.id, async (tx: TenantTx) => {
      await tx.supportMessage.create({ data: { agencyId: t.agency!.id, ticketId: id, authorId: by.id, authorName: by.name, body, fromPlatform: true } });
      await tx.supportTicket.update({ where: { id }, data: close ? { status: "closed", closedAt: new Date() } : { status: "answered" } });
      const muted = await tx.notificationPreference.count({ where: { agencyId: t.agency!.id, userId: t.createdBy.id, muted: { has: "support_reply" } } });
      if (!muted)
        await tx.notification.create({
          data: {
            agencyId: t.agency!.id,
            userId: t.createdBy.id,
            kind: "support_reply",
            title: `Support replied: ${t.subject}`,
            body: body.length > 140 ? `${body.slice(0, 139)}…` : body,
            link: `/app/support/${id}`,
          },
        });
    });
    return this.platformGet(id);
  }
}
