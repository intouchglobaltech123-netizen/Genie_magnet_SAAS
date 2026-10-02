import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import { allows, type ClientDecision, type ContentInput, type ContentUpdate, type ScriptInput, scopeOf } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { thisMonth } from "./cycles.service.js";
import { VideosService } from "./videos.service.js";

type Stage = "idea" | "topic" | "research" | "script" | "approval" | "ready";
const first = (m: string) => new Date(`${m}-01T00:00:00Z`);
const ym = (d: Date) => d.toISOString().slice(0, 7);
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
/** The last day of a month: an idea's video is due by then unless a due date is set. */
const monthEnd = (m: string) => {
  const d = first(m);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
};

const WITH = {
  client: { select: { id: true, name: true, code: true } },
  versions: { orderBy: { number: "desc" } },
  video: { select: { id: true, code: true, stage: true } },
} as const satisfies Prisma.ContentItemInclude;
type Row = Prisma.ContentItemGetPayload<{ include: typeof WITH }>;

/**
 * Content (P2-02 to P2-05): the idea bank around each client's pillars, the monthly topic list the client picks from,
 * research, and scripts with versions. Writers save drafts and ask for review; people who may approve scripts send them
 * to the client; the client's answer (recorded by the team until the portal arrives) either sends the script back with
 * notes or approves it — and an approved script becomes a video in production.
 */
@Injectable()
export class ContentService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly videos: VideosService,
  ) {}

  private scope(): Prisma.ContentItemWhereInput {
    return this.tenant.ownOnly("content", "ownerId");
  }

  private async names(ids: (string | null | undefined)[]) {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (!wanted.length) return new Map<string, string>();
    const people = await this.tenant.db.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
    return new Map(people.map((p) => [p.id, p.name]));
  }

  private present(c: Row, names: Map<string, string>) {
    const who = (id: string | null) => (id ? { id, name: names.get(id) ?? null } : null);
    return {
      id: c.id,
      client: c.client,
      title: c.title,
      pillar: c.pillar,
      format: c.format,
      source: c.source,
      stage: c.stage as Stage,
      owner: who(c.ownerId),
      month: ym(c.month),
      due: day(c.due),
      pick: c.pick as "picked" | "skipped" | null,
      notes: c.notes,
      research: c.research,
      links: c.links as { label: string; url: string }[],
      scripts: c.versions.map((v) => ({
        id: v.id,
        number: v.number,
        label: `v${v.number}`,
        hook: v.hook,
        body: v.body,
        cta: v.cta,
        onScreen: v.onScreen,
        status: v.status as "draft" | "review" | "sent" | "changes" | "approved",
        clientNote: v.clientNote,
        by: who(v.createdById),
        createdAt: v.createdAt,
        sentAt: v.sentAt,
        decidedAt: v.decidedAt,
      })),
      video: c.video,
      updatedAt: c.updatedAt,
    };
  }

  async list(f: { clientId?: string; month?: string; stage?: string }) {
    const rows = await this.tenant.db.contentItem.findMany({
      where: {
        AND: [
          this.scope(),
          { ...(f.clientId && { clientId: f.clientId }), ...(f.month && { month: first(f.month) }), ...(f.stage && { stage: f.stage as Stage }) },
        ],
      },
      include: WITH,
      orderBy: [{ month: "asc" }, { createdAt: "asc" }],
      take: 2000,
    });
    const names = await this.names(rows.flatMap((r) => [r.ownerId, ...r.versions.map((v) => v.createdById)]));
    return rows.map((r) => this.present(r, names));
  }

  private async find(id: string) {
    const row = await this.tenant.db.contentItem.findFirst({ where: { AND: [{ id }, this.scope()] }, include: WITH });
    if (!row) throw new NotFoundException("No content with that id that you can see.");
    return row;
  }

  async get(id: string) {
    const row = await this.find(id);
    const names = await this.names([row.ownerId, ...row.versions.map((v) => v.createdById)]);
    return this.present(row, names);
  }

  private async log(action: string, c: { id: string; title: string }, after: Record<string, unknown> = {}) {
    await this.tenant.tx((tx) => this.audit.record(tx, { action, entity: "content", entityId: c.id, after: { title: c.title, ...after } }));
  }

  // ─── Pillars and ideas ────────────────────────────────────────────

  async setPillars(clientId: string, pillars: string[]) {
    const client = await this.tenant.db.client.findFirst({ where: { id: clientId }, select: { id: true, name: true, pillars: true } });
    if (!client) throw new NotFoundException("No client with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.client.update({ where: { id: clientId }, data: { pillars } });
      await this.audit.record(tx, {
        action: "update",
        entity: "client",
        entityId: clientId,
        before: { name: client.name, pillars: client.pillars },
        after: { name: client.name, pillars },
      });
    });
    return { pillars };
  }

  async create(input: ContentInput & { source: string; pillar: string }) {
    const client = await this.tenant.db.client.findFirst({ where: { id: input.clientId }, select: { archivedAt: true } });
    if (!client) throw new BadRequestException({ message: "Choose one of your clients.", issues: [{ path: "clientId", message: "Choose the client" }] });
    // Roles limited to their own content own what they add.
    const ownerId = scopeOf(this.tenant.permissions, "content") === "own" ? this.tenant.userId : (input.ownerId ?? this.tenant.userId);
    const id = await this.tenant.tx(async (tx) => {
      const c = await tx.contentItem.create({
        data: {
          agencyId: this.tenant.agencyId,
          clientId: input.clientId,
          title: input.title,
          pillar: input.pillar,
          format: input.format,
          source: input.source,
          month: first(input.month),
          notes: input.notes ?? "",
          ownerId,
          createdBy: this.tenant.userId,
        },
      });
      await this.audit.record(tx, { action: "create", entity: "content", entityId: c.id, after: { title: c.title, month: input.month } });
      return c.id;
    });
    return this.get(id);
  }

  async update(id: string, input: ContentUpdate) {
    const c = await this.find(id);
    if (input.ownerId !== undefined && scopeOf(this.tenant.permissions, "content") === "own" && input.ownerId !== this.tenant.userId)
      throw new ForbiddenException("Your role works only with its own content.");
    await this.tenant.db.contentItem.update({
      where: { id },
      data: {
        ...input,
        links: input.links as Prisma.InputJsonValue | undefined,
        month: input.month ? first(input.month) : undefined,
        due: input.due === undefined ? undefined : input.due ? new Date(`${input.due}T00:00:00Z`) : null,
      },
    });
    if (input.title && input.title !== c.title) await this.log("update", { id, title: input.title }, { was: c.title });
    return this.get(id);
  }

  async remove(id: string) {
    const c = await this.find(id);
    if (c.video) throw new ConflictException("It is already a video — change it in production.");
    await this.tenant.tx(async (tx) => {
      await tx.contentItem.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "content", entityId: id, before: { title: c.title } });
    });
  }

  /** From the idea bank (or the topic list) straight to research. */
  async start(id: string) {
    const c = await this.find(id);
    if (c.stage !== "idea" && c.stage !== "topic") throw new ConflictException("It has already started.");
    await this.tenant.db.contentItem.update({ where: { id }, data: { stage: "research", pick: null } });
    await this.log("start", c);
    return this.get(id);
  }

  async researchDone(id: string) {
    const c = await this.find(id);
    if (c.stage !== "research") throw new ConflictException("It is not in research.");
    await this.tenant.db.contentItem.update({ where: { id }, data: { stage: "script" } });
    return this.get(id);
  }

  // ─── Scripts ──────────────────────────────────────────────────────

  /** Saves the script: the open draft is overwritten; after it was sent, a new version starts. */
  async saveScript(id: string, input: ScriptInput & { cta: string; onScreen: string }) {
    const c = await this.find(id);
    if (c.stage === "ready") throw new ConflictException("The script is approved — it is in production now.");
    if (c.stage === "approval") throw new ConflictException("The script is with the client — record their answer first.");
    const last = c.versions[0];
    if (last && (last.status === "draft" || last.status === "review")) {
      await this.tenant.db.scriptVersion.update({ where: { id: last.id }, data: { ...input, status: "draft", createdById: this.tenant.userId } });
    } else {
      await this.tenant.db.scriptVersion.create({
        data: { agencyId: this.tenant.agencyId, contentItemId: id, number: (last?.number ?? 0) + 1, ...input, createdById: this.tenant.userId },
      });
    }
    if (c.stage !== "script") await this.tenant.db.contentItem.update({ where: { id }, data: { stage: "script" } });
    return this.get(id);
  }

  /** The writer asks for the script to be reviewed by someone who may approve scripts. */
  async askReview(id: string) {
    const c = await this.find(id);
    const last = c.versions[0];
    if (!last || last.status !== "draft") throw new ConflictException("Save the script first.");
    await this.tenant.tx(async (tx) => {
      await tx.scriptVersion.update({ where: { id: last.id }, data: { status: "review" } });
      await this.notifications.notify(
        tx,
        { can: { area: "content", level: "approve" } },
        { kind: "script_approval", title: `Script to review: ${c.title}`, body: `${c.client.name} · v${last.number}`, link: `/app/content/${id}` },
      );
    });
    return this.get(id);
  }

  /** Sent to the client (content: approve): the reviewer's go-ahead. */
  async send(id: string) {
    if (!allows(this.tenant.permissions, "content", "approve"))
      throw new ForbiddenException("Scripts are sent to the client by people who may approve scripts.");
    const c = await this.find(id);
    const last = c.versions[0];
    if (!last || (last.status !== "draft" && last.status !== "review")) throw new ConflictException("Write the script first.");
    await this.tenant.tx(async (tx) => {
      await tx.scriptVersion.update({ where: { id: last.id }, data: { status: "sent", sentAt: new Date() } });
      await tx.contentItem.update({ where: { id }, data: { stage: "approval" } });
      await this.audit.record(tx, { action: "send", entity: "content", entityId: id, after: { title: c.title, script: `v${last.number}` } });
    });
    return this.get(id);
  }

  /** The client's answer: changes (back to the writer with the notes), or approved — then it becomes a video. */
  async decide(id: string, d: ClientDecision) {
    const c = await this.find(id);
    const last = c.versions[0];
    if (!last || last.status !== "sent" || c.stage !== "approval") throw new ConflictException("No script is with the client.");
    const videoId = await this.tenant.tx(async (tx) => {
      await tx.scriptVersion.update({
        where: { id: last.id },
        data: { status: d.approved ? "approved" : "changes", clientNote: d.note ?? null, decidedBy: this.tenant.userId, decidedAt: new Date() },
      });
      await tx.contentItem.update({ where: { id }, data: { stage: d.approved ? "ready" : "script" } });
      await this.audit.record(tx, {
        action: d.approved ? "approve" : "changes",
        entity: "content",
        entityId: id,
        after: { title: c.title, script: `v${last.number}`, note: d.note ?? null },
      });
      await this.notifications.notify(
        tx,
        { users: [last.createdById, c.ownerId] },
        { kind: "script_decided", title: `${d.approved ? "Approved" : "Changes asked"}: ${c.title}`, body: d.note, link: `/app/content/${id}` },
      );
      if (!d.approved) return null;
      // Handed to production: the idea's video, or a new one due by the end of its month.
      if (c.video) {
        if (c.video.stage === "planned" || c.video.stage === "scripting") {
          await tx.video.update({ where: { id: c.video.id }, data: { stage: "shoot_scheduled" } });
          await tx.videoStageChange.create({
            data: {
              agencyId: this.tenant.agencyId,
              videoId: c.video.id,
              from: c.video.stage,
              to: "shoot_scheduled",
              note: "Script approved",
              by: this.tenant.userId,
            },
          });
        }
        return c.video.id;
      }
      const m = ym(c.month);
      return this.videos.insert(
        tx,
        {
          clientId: c.clientId,
          title: c.title,
          format: c.format,
          aspect: "9:16",
          urgency: "standard",
          dueDate: day(c.due) ?? monthEnd(m < thisMonth() ? thisMonth() : m),
          platforms: [],
          editorId: null,
        },
        { contentItemId: id },
      );
    });
    return { ...(await this.get(id)), videoId };
  }

  // ─── Monthly topic lists (P2-03) ──────────────────────────────────

  /** The month's lists, one per client, with the ideas offered and the client's picks. */
  async topicLists(month = thisMonth()) {
    const [lists, items] = await Promise.all([this.tenant.db.topicList.findMany({ where: { month: first(month) } }), this.list({ month })]);
    const clients = await this.tenant.db.client.findMany({ where: { id: { in: lists.map((l) => l.clientId) } }, select: { id: true, name: true, code: true } });
    return lists.map((l) => {
      const offered = items.filter((i) => i.client.id === l.clientId && (i.stage === "idea" || i.stage === "topic" || i.pick));
      return {
        id: l.id,
        month,
        client: clients.find((c) => c.id === l.clientId)!,
        needed: l.needed,
        status: l.status as "draft" | "sent" | "confirmed",
        sentAt: l.sentAt,
        confirmedAt: l.confirmedAt,
        items: offered,
        picked: offered.filter((i) => i.pick === "picked").length,
      };
    });
  }

  async saveTopicList(input: { clientId: string; month: string; needed: number }) {
    const client = await this.tenant.db.client.findFirst({ where: { id: input.clientId }, select: { id: true } });
    if (!client) throw new NotFoundException("No client with that id.");
    await this.tenant.db.topicList.upsert({
      where: { clientId_month: { clientId: input.clientId, month: first(input.month) } },
      create: { agencyId: this.tenant.agencyId, clientId: input.clientId, month: first(input.month), needed: input.needed, createdBy: this.tenant.userId },
      update: { needed: input.needed },
    });
    return this.topicLists(input.month);
  }

  private async topicList(id: string) {
    const l = await this.tenant.db.topicList.findFirst({ where: { id } });
    if (!l) throw new NotFoundException("No topic list with that id.");
    return l;
  }

  /** Offers the client's ideas for the month: they become topics for the client to pick from. */
  async sendTopicList(id: string) {
    const l = await this.topicList(id);
    const n = await this.tenant.db.contentItem.count({ where: { clientId: l.clientId, month: l.month, stage: "idea" } });
    if (!n) throw new ConflictException("Add ideas for this client and month first.");
    await this.tenant.tx(async (tx) => {
      await tx.contentItem.updateMany({ where: { clientId: l.clientId, month: l.month, stage: "idea" }, data: { stage: "topic" } });
      await tx.topicList.update({ where: { id }, data: { status: "sent", sentAt: new Date() } });
      await this.audit.record(tx, { action: "send", entity: "topic_list", entityId: id, after: { month: ym(l.month), topics: n } });
    });
    return this.topicLists(ym(l.month));
  }

  /** The client's pick on a topic (recorded by the team until the portal arrives). */
  async pick(id: string, pick: "picked" | "skipped" | null) {
    const c = await this.find(id);
    if (c.stage !== "topic") throw new ConflictException("Only topics on a sent list are picked.");
    await this.tenant.db.contentItem.update({ where: { id }, data: { pick } });
    return this.get(id);
  }

  /** Confirms the client's picks: picked topics go to research, the rest back to the idea bank. */
  async confirmTopicList(id: string) {
    const l = await this.topicList(id);
    if (l.status !== "sent") throw new ConflictException("Send the list to the client first.");
    await this.tenant.tx(async (tx) => {
      const picked = await tx.contentItem.updateMany({
        where: { clientId: l.clientId, month: l.month, stage: "topic", pick: "picked" },
        data: { stage: "research" },
      });
      await tx.contentItem.updateMany({ where: { clientId: l.clientId, month: l.month, stage: "topic" }, data: { stage: "idea", pick: null } });
      await tx.topicList.update({ where: { id }, data: { status: "confirmed", confirmedAt: new Date() } });
      await this.audit.record(tx, { action: "confirm", entity: "topic_list", entityId: id, after: { month: ym(l.month), picked: picked.count } });
    });
    return this.topicLists(ym(l.month));
  }
}
