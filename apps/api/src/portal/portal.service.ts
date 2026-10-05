import { createHash, randomBytes } from "node:crypto";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { findPortalLink } from "@gm/db";
import {
  type ClientDecision,
  type ClientRequestKind,
  type ClientRequestRow,
  type PortalHome,
  type PortalInvoiceRow,
  type PortalLinkRow,
  type PortalScript,
  type PortalTopicList,
  type PortalVideo,
  type PortalVideos,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { ENV, type Env } from "../env.js";
import { InvoicesService } from "../invoices/invoices.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ContentService } from "../production/content.service.js";
import { Secrets } from "../common/secrets.js";
import { PortalDomainService } from "../settings/portal-domain.service.js";
import { WhatsAppService } from "../whatsapp/whatsapp.service.js";
import { ReportsService } from "../reports/reports.service.js";
import { VideosService } from "../production/videos.service.js";
import { asPortal, type PortalPerson, TenantDb } from "../tenancy/tenant-context.js";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const ym = (d: Date) => d.toISOString().slice(0, 7);
const monthName = (d: Date) => d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
/** Dates from the services as the portal's text. */
const text = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);
const NOT_VALID = "This link is not valid any more. Ask your agency for a new one.";

/**
 * The client portal (P3-01 to P3-05). Each client contact has their own private link (only its hash is kept); the team
 * makes, replaces and switches it off. Everything the portal reads or changes is limited to that contact's client, and
 * goes through the same rules as the team's own screens. Changes are recorded as made by the contact.
 */
@Injectable()
export class PortalService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly content: ContentService,
    private readonly videos: VideosService,
    private readonly invoices: InvoicesService,
    private readonly secrets: Secrets,
    private readonly whatsapp: WhatsAppService,
    private readonly reports: ReportsService,
    private readonly domain: PortalDomainService,
  ) {}

  // ─── The team: links and requests ──────────────────────────────────

  private async contactOf(clientId: string, contactId: string) {
    const c = await this.tenant.db.contact.findFirst({ where: { id: contactId, clientId }, include: { client: { select: { name: true, archivedAt: true } } } });
    if (!c) throw new NotFoundException("No contact with that id for this client.");
    return c;
  }

  /** Each contact of the client and whether they have a portal link. */
  async links(clientId: string): Promise<PortalLinkRow[]> {
    const contacts = await this.tenant.db.contact.findMany({ where: { clientId }, include: { portalLink: true }, orderBy: { name: "asc" } });
    return contacts.map((c) => ({
      contactId: c.id,
      contactName: c.name,
      phone: c.phone,
      approver: c.approver,
      active: !!c.portalLink,
      createdAt: c.portalLink?.createdAt.toISOString() ?? null,
      lastUsedAt: c.portalLink?.lastUsedAt?.toISOString() ?? null,
      whatsappOptIn: c.whatsappOptIn,
      whatsappSource: c.whatsappOptInSource,
    }));
  }

  /** A new private link for the contact; an earlier one stops working. The link is shown only in this answer. */
  async makeLink(clientId: string, contactId: string) {
    const c = await this.contactOf(clientId, contactId);
    if (c.client.archivedAt) throw new ConflictException("This client is archived.");
    const token = randomBytes(24).toString("base64url");
    await this.tenant.tx(async (tx) => {
      const existing = await tx.portalLink.findUnique({ where: { contactId } });
      const data = { token: hash(token), tokenSecret: this.secrets.encrypt(token), createdBy: this.tenant.userId };
      if (existing) await tx.portalLink.update({ where: { contactId }, data: { ...data, createdAt: new Date(), lastUsedAt: null } });
      else await tx.portalLink.create({ data: { ...data, agencyId: this.tenant.agencyId, clientId, contactId } });
      await this.audit.record(tx, {
        action: "share",
        entity: "portal_link",
        entityId: contactId,
        after: { client: c.client.name, contact: c.name, link: existing ? "replaced" : "new" },
      });
    });
    return { link: (await this.domain.links()).portal(token), links: await this.links(clientId) };
  }

  /** Switches the contact's link off at once. */
  async removeLink(clientId: string, contactId: string) {
    const c = await this.contactOf(clientId, contactId);
    await this.tenant.tx(async (tx) => {
      const { count } = await tx.portalLink.deleteMany({ where: { contactId } });
      if (count)
        await this.audit.record(tx, { action: "unshare", entity: "portal_link", entityId: contactId, after: { client: c.client.name, contact: c.name } });
    });
    return this.links(clientId);
  }

  private async presentRequests(
    rows: {
      id: string;
      clientId: string;
      contactName: string;
      kind: string;
      text: string;
      status: string;
      answer: string | null;
      answeredBy: string | null;
      createdAt: Date;
      answeredAt: Date | null;
    }[],
  ): Promise<ClientRequestRow[]> {
    const clients = await this.tenant.db.client.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.clientId))] } },
      select: { id: true, name: true, code: true },
    });
    const ids = [...new Set(rows.map((r) => r.answeredBy).filter((x): x is string => !!x))];
    const people = ids.length ? await this.tenant.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    return rows.map((r) => ({
      id: r.id,
      client: clients.find((c) => c.id === r.clientId)!,
      contactName: r.contactName,
      kind: r.kind,
      text: r.text,
      status: r.status as "open" | "answered",
      answer: r.answer,
      answeredBy: r.answeredBy ? { id: r.answeredBy, name: people.find((p) => p.id === r.answeredBy)?.name ?? null } : null,
      createdAt: r.createdAt.toISOString(),
      answeredAt: r.answeredAt?.toISOString() ?? null,
    }));
  }

  /** What clients have asked from their portals, newest first. */
  async requests(f: { status?: "open" | "answered"; clientId?: string }) {
    const rows = await this.tenant.db.clientRequest.findMany({
      where: { ...(f.status && { status: f.status }), ...(f.clientId && { clientId: f.clientId }) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return this.presentRequests(rows);
  }

  async answer(id: string, answer: string) {
    const r = await this.tenant.db.clientRequest.findFirst({ where: { id } });
    if (!r) throw new NotFoundException("No request with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.clientRequest.update({ where: { id }, data: { status: "answered", answer, answeredBy: this.tenant.userId, answeredAt: new Date() } });
      await this.audit.record(tx, { action: "answer", entity: "client_request", entityId: id, after: { from: r.contactName, answer } });
    });
    return (await this.requests({ clientId: r.clientId })).find((x) => x.id === id)!;
  }

  // ─── The portal ────────────────────────────────────────────────────

  /** Opens a link and runs `fn` as its contact, inside their agency. */
  private async as<T>(token: string, fn: (p: PortalPerson) => Promise<T>): Promise<T> {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new NotFoundException(NOT_VALID);
    const link = await findPortalLink(this.prisma.client, hash(token));
    if (!link) throw new NotFoundException(NOT_VALID);
    const contact = await asPortal(link.agencyId, { clientId: link.clientId, contactId: link.contactId, name: "" }, () =>
      this.tenant.db.contact.findFirst({ where: { id: link.contactId }, select: { name: true, client: { select: { archivedAt: true } } } }),
    );
    if (!contact || contact.client.archivedAt) throw new NotFoundException(NOT_VALID);
    const person = { clientId: link.clientId, contactId: link.contactId, name: contact.name };
    return asPortal(link.agencyId, person, async () => {
      await this.tenant.db.portalLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } });
      return fn(person);
    });
  }

  /** Something in the portal belongs to the contact's client, or it is not there. */
  private mine(clientId: string, p: PortalPerson) {
    if (clientId !== p.clientId) throw new NotFoundException("Not found.");
  }

  private teamFor(clientId: string) {
    return this.tenant.db.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true, accountOwnerId: true } });
  }

  /** The contact agrees to (or stops) WhatsApp messages themselves. */
  async setWhatsApp(token: string, optIn: boolean) {
    return this.as(token, async (p) => {
      await this.whatsapp.setOptIn(p.contactId, optIn, optIn ? "Agreed in their portal" : "Turned off in their portal");
      return { optIn };
    });
  }

  async home(token: string): Promise<PortalHome> {
    return this.as(token, async (p) => {
      const [whatsapp, contact] = await Promise.all([
        this.tenant.db.whatsAppConnection.findUnique({ where: { agencyId: this.tenant.agencyId }, select: { status: true } }),
        this.tenant.db.contact.findUniqueOrThrow({ where: { id: p.contactId }, select: { whatsappOptIn: true } }),
      ]);
      const [agency, client, topics, scripts, videos, invoices] = await Promise.all([
        this.tenant.db.agency.findUniqueOrThrow({ where: { id: this.tenant.agencyId }, select: { name: true, logo: true, brandColor: true } }),
        this.tenant.db.client.findUniqueOrThrow({ where: { id: p.clientId }, select: { name: true } }),
        this.topicsStillToPick(p.clientId),
        this.tenant.db.contentItem.count({ where: { clientId: p.clientId, stage: "approval" } }),
        this.tenant.db.video.count({ where: { clientId: p.clientId, stage: "client_review", versions: { some: { status: "sent" } } } }),
        this.tenant.db.invoice.count({ where: { clientId: p.clientId, status: "sent" } }),
      ]);
      return {
        agency,
        client,
        contact: { name: p.name },
        todo: { topics, scripts, videos, invoices },
        whatsapp: { available: whatsapp?.status === "connected", optIn: contact.whatsappOptIn },
      };
    });
  }

  // P3-02 — topics

  async topics(token: string): Promise<PortalTopicList[]> {
    return this.as(token, (p) => this.topicListsFor(p));
  }

  /** Picks the client still owes: on each list waiting for them, how many it asks for less how many are picked. */
  private async topicsStillToPick(clientId: string) {
    const lists = await this.tenant.db.topicList.findMany({ where: { clientId, status: "sent" }, select: { month: true, needed: true } });
    const owed = await Promise.all(
      lists.map(async (l) => {
        const picked = await this.tenant.db.contentItem.count({ where: { clientId, month: l.month, stage: "topic", pick: "picked" } });
        return Math.max(0, l.needed - picked);
      }),
    );
    return owed.reduce((n, x) => n + x, 0);
  }

  private async topicListsFor(p: PortalPerson): Promise<PortalTopicList[]> {
    const lists = await this.tenant.db.topicList.findMany({
      where: { clientId: p.clientId, status: { in: ["sent", "confirmed"] } },
      orderBy: { month: "desc" },
      take: 6,
    });
    const out: PortalTopicList[] = [];
    for (const l of lists) {
      const items = await this.tenant.db.contentItem.findMany({
        where: { clientId: p.clientId, month: l.month, ...(l.status === "sent" ? { stage: "topic" } : { pick: "picked" }) },
        orderBy: { createdAt: "asc" },
      });
      out.push({
        id: l.id,
        month: ym(l.month),
        needed: l.needed,
        status: l.status as "sent" | "confirmed",
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          pillar: i.pillar,
          format: i.format,
          notes: i.notes,
          pick: i.pick as "picked" | "skipped" | null,
        })),
      });
    }
    return out;
  }

  async pick(token: string, contentId: string, pick: "picked" | "skipped" | null) {
    return this.as(token, async (p) => {
      const c = await this.content.get(contentId);
      this.mine(c.client.id, p);
      await this.content.pick(contentId, pick);
      return this.topicListsFor(p);
    });
  }

  /** The client says their picks are done: the team is told, and confirms the list. */
  async topicsDone(token: string, listId: string) {
    return this.as(token, async (p) => {
      const l = await this.tenant.db.topicList.findFirst({ where: { id: listId, clientId: p.clientId } });
      if (!l) throw new NotFoundException("Not found.");
      if (l.status !== "sent") throw new ConflictException("This list is already confirmed.");
      const picked = await this.tenant.db.contentItem.count({ where: { clientId: p.clientId, month: l.month, stage: "topic", pick: "picked" } });
      const client = await this.teamFor(p.clientId);
      await this.tenant.tx(async (tx) => {
        await this.audit.record(tx, { action: "picks_done", entity: "topic_list", entityId: listId, after: { month: ym(l.month), picked } });
        await this.notifications.notify(
          tx,
          { users: [client.accountOwnerId, l.createdBy], can: { area: "content", level: "approve" } },
          {
            kind: "client_portal",
            title: `${client.name} picked ${picked === 1 ? "1 topic" : `${picked} topics`} for ${monthName(l.month)}`,
            body: `${p.name}, in their portal. Confirm the list to start research.`,
            link: "/app/content",
          },
        );
      });
      return { picked };
    });
  }

  // P3-03 — scripts

  async scripts(token: string): Promise<PortalScript[]> {
    return this.as(token, async (p) => {
      const items = await this.tenant.db.contentItem.findMany({ where: { clientId: p.clientId, stage: "approval" }, select: { id: true } });
      const out: PortalScript[] = [];
      for (const { id } of items) {
        const c = await this.content.get(id);
        const [last, ...earlier] = c.scripts;
        if (!last || last.status !== "sent") continue;
        out.push({
          contentId: c.id,
          title: c.title,
          format: c.format,
          month: c.month,
          script: { label: last.label, hook: last.hook, body: last.body, cta: last.cta, onScreen: last.onScreen, sentAt: text(last.sentAt) },
          earlier: earlier.map((s) => ({ label: s.label, status: s.status, clientNote: s.clientNote })),
        });
      }
      return out;
    });
  }

  async decideScript(token: string, contentId: string, d: ClientDecision) {
    return this.as(token, async (p) => {
      const c = await this.content.get(contentId);
      this.mine(c.client.id, p);
      await this.content.decide(contentId, d);
      return { ok: true };
    });
  }

  // P3-04 — videos

  private async portalVideo(id: string): Promise<PortalVideo> {
    const v = await this.videos.get(id);
    const latest = v.versions.find((x) => x.status === "sent") ?? null;
    const posts = await this.tenant.db.scheduledPost.findMany({
      where: { videoId: id, status: "published" },
      include: { connection: { select: { platform: true } } },
      orderBy: { publishedAt: "asc" },
    });
    return {
      id: v.id,
      code: v.code,
      title: v.title,
      stage: v.stage,
      version: latest && {
        id: latest.id,
        label: latest.label,
        link: latest.link,
        fileUrl: latest.file?.url ?? null,
        duration: latest.duration,
        notes: latest.notes,
        sentAt: text(latest.sentAt),
        comments: latest.comments.map(({ resolved: _r, ...c }) => ({ ...c, createdAt: text(c.createdAt)! })),
      },
      posts: posts.map((x) => ({ platform: x.connection.platform, url: x.publishedUrl, at: (x.publishedAt ?? x.scheduledAt).toISOString() })),
    };
  }

  async videosFor(token: string): Promise<PortalVideos> {
    return this.as(token, async (p) => {
      const [waiting, done] = await Promise.all([
        this.tenant.db.video.findMany({
          where: { clientId: p.clientId, stage: "client_review", versions: { some: { status: "sent" } } },
          orderBy: { dueDate: "asc" },
          select: { id: true },
        }),
        this.tenant.db.video.findMany({
          where: { clientId: p.clientId, stage: { in: ["approved", "published"] } },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: { id: true },
        }),
      ]);
      return {
        waiting: await Promise.all(waiting.map((v) => this.portalVideo(v.id))),
        done: await Promise.all(done.map((v) => this.portalVideo(v.id))),
      };
    });
  }

  private async waitingVideo(id: string, p: PortalPerson) {
    const v = await this.videos.get(id);
    this.mine(v.client.id, p);
    const version = v.versions.find((x) => x.status === "sent");
    if (v.stage !== "client_review" || !version) throw new ConflictException("This video is not waiting for you.");
    return { v, version };
  }

  async comment(token: string, videoId: string, input: { text: string; at?: number }) {
    return this.as(token, async (p) => {
      const { v, version } = await this.waitingVideo(videoId, p);
      await this.videos.comment(videoId, version.id, { text: input.text, at: input.at, author: p.name });
      await this.tenant.tx((tx) =>
        this.notifications.notify(
          tx,
          { users: [v.editor?.id, v.director?.id] },
          { kind: "client_portal", title: `${p.name} commented on ${v.code}`, body: input.text, link: `/app/production/${videoId}?tab=versions` },
        ),
      );
      return this.portalVideo(videoId);
    });
  }

  async decideVideo(token: string, videoId: string, d: ClientDecision) {
    return this.as(token, async (p) => {
      await this.waitingVideo(videoId, p);
      await this.videos.decide(videoId, d);
      return this.portalVideo(videoId);
    });
  }

  // P3-05 — invoices and requests

  async invoicesFor(token: string): Promise<PortalInvoiceRow[]> {
    return this.as(token, async (p) => {
      const rows = await this.tenant.db.invoice.findMany({
        where: { clientId: p.clientId, status: { in: ["sent", "paid"] } },
        orderBy: { issueDate: "desc" },
        take: 50,
      });
      return rows.map((r) => ({
        id: r.id,
        number: r.number,
        issueDate: day(r.issueDate),
        dueDate: day(r.dueDate),
        total: r.total,
        status: r.status as "sent" | "paid",
        paidOn: day(r.paidOn),
        payUrl: r.status === "sent" && r.payLinkStatus === "created" ? r.payLinkUrl : null,
      }));
    });
  }

  /** Released monthly reports (P3-09). */
  async reportsFor(token: string) {
    return this.as(token, (p) => this.reports.released(p.clientId));
  }

  async report(token: string, id: string) {
    return this.as(token, (p) => this.reports.releasedOne(p.clientId, id));
  }

  /** One issued invoice, to view and print. */
  async invoice(token: string, id: string) {
    return this.as(token, async (p) => {
      const inv = await this.tenant.db.invoice.findFirst({ where: { id, clientId: p.clientId, status: { in: ["sent", "paid"] } }, select: { id: true } });
      if (!inv) throw new NotFoundException("Not found.");
      return this.invoices.get(id);
    });
  }

  async myRequests(token: string) {
    return this.as(token, async (p) => {
      const rows = await this.tenant.db.clientRequest.findMany({ where: { clientId: p.clientId }, orderBy: { createdAt: "desc" }, take: 50 });
      return this.presentRequests(rows);
    });
  }

  async ask(token: string, input: { kind: ClientRequestKind; text: string }) {
    return this.as(token, async (p) => {
      const client = await this.teamFor(p.clientId);
      await this.tenant.tx(async (tx) => {
        const r = await tx.clientRequest.create({
          data: { agencyId: this.tenant.agencyId, clientId: p.clientId, contactId: p.contactId, contactName: p.name, kind: input.kind, text: input.text },
        });
        await this.audit.record(tx, { action: "create", entity: "client_request", entityId: r.id, after: { kind: input.kind } });
        await this.notifications.notify(tx, client.accountOwnerId ? { users: [client.accountOwnerId] } : { can: { area: "clients", level: "edit" } }, {
          kind: "client_portal",
          title: `${client.name} asks: ${input.text.slice(0, 80)}`,
          body: `${p.name}, in their portal.`,
          link: "/app/requests",
        });
      });
      const rows = await this.tenant.db.clientRequest.findMany({ where: { clientId: p.clientId }, orderBy: { createdAt: "desc" }, take: 50 });
      return this.presentRequests(rows);
    });
  }
}
