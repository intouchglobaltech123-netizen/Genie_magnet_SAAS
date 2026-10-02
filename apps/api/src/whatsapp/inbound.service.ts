import { createHmac, timingSafeEqual } from "node:crypto";
import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { findWhatsAppConnection } from "@gm/db";
import { waNumber } from "@gm/shared";
import { Secrets } from "../common/secrets.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ContentService } from "../production/content.service.js";
import { VideosService } from "../production/videos.service.js";
import { asPortal, asSystem, TenantDb } from "../tenancy/tenant-context.js";
import { WhatsAppService } from "./whatsapp.service.js";

type Status = { id: string; status: string; timestamp?: string; errors?: { title?: string; message?: string }[] };
type Incoming = {
  from: string;
  id: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { payload?: string; text?: string };
  interactive?: { button_reply?: { id?: string; title?: string } };
};
type Payload = { entry?: { changes?: { value?: { statuses?: Status[]; messages?: Incoming[] } }[] }[] };
type Contact = { id: string; name: string; phone: string; clientId: string };

const RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3 };
const DAY = 86_400_000;
const STOP = /^\s*(stop|unsubscribe)\s*$/i;

/**
 * What WhatsApp sends back (P3-08): delivery and read receipts update the log; a client's Approve or Request changes
 * button acts on the script or video the message was about, as that client; text that follows a change request
 * becomes their comment; STOP turns WhatsApp off for them; anything else reaches whoever looks after the client.
 */
@Injectable()
export class WhatsAppInbound {
  private readonly log = new Logger("WhatsApp");

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantDb,
    private readonly secrets: Secrets,
    private readonly whatsapp: WhatsAppService,
    private readonly notifications: NotificationsService,
    private readonly content: ContentService,
    private readonly videos: VideosService,
  ) {}

  /** Meta checks the address once, with the verify token the agency pasted. */
  async verify(connectionId: string, mode?: string, token?: string, challenge?: string) {
    const c = await findWhatsAppConnection(this.prisma.client, connectionId);
    if (!c || mode !== "subscribe" || !token || token !== c.verifyToken || !challenge) throw new ForbiddenException("Not verified.");
    return challenge;
  }

  async receive(connectionId: string, raw: Buffer | undefined, signature: string | undefined, payload: Payload) {
    const c = await findWhatsAppConnection(this.prisma.client, connectionId);
    if (!c) throw new NotFoundException("Unknown address.");
    // Only what Meta signed with the agency's app secret is believed.
    if (!c.appSecret || !raw || !signature) throw new ForbiddenException("Not signed.");
    const expected = Buffer.from(`sha256=${createHmac("sha256", this.secrets.decrypt(c.appSecret)).update(raw).digest("hex")}`);
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new ForbiddenException("Wrong signature.");
    await asSystem(c.agencyId, () => this.handle(payload));
    return { ok: true };
  }

  private async handle(payload: Payload) {
    const values = (payload.entry ?? []).flatMap((e) => (e.changes ?? []).map((ch) => ch.value ?? {}));
    for (const v of values) {
      for (const s of v.statuses ?? []) await this.status(s).catch((e) => this.log.warn(`status ${s.id}: ${String(e)}`));
      for (const m of v.messages ?? []) await this.message(m).catch((e) => this.log.warn(`message ${m.id}: ${String(e)}`));
    }
  }

  private async status(s: Status) {
    const m = await this.tenant.db.whatsAppMessage.findFirst({ where: { providerId: s.id, direction: "out" } });
    if (!m) return;
    const at = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date();
    if (s.status === "failed") {
      await this.tenant.db.whatsAppMessage.update({
        where: { id: m.id },
        data: { status: "failed", reason: s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? "WhatsApp could not deliver it" },
      });
      return;
    }
    if ((RANK[s.status] ?? -1) <= (RANK[m.status] ?? -1)) return; // never step back (read, then a late "delivered")
    await this.tenant.db.whatsAppMessage.update({
      where: { id: m.id },
      data: {
        status: s.status,
        ...(s.status === "delivered" && { deliveredAt: at }),
        ...(s.status === "read" && { readAt: at, deliveredAt: m.deliveredAt ?? at }),
      },
    });
  }

  private async contactFor(phone: string): Promise<Contact | null> {
    const all = await this.tenant.db.contact.findMany({ select: { id: true, name: true, phone: true, clientId: true } });
    return all.find((c) => waNumber(c.phone) === phone) ?? null;
  }

  private async message(m: Incoming) {
    if (await this.tenant.db.whatsAppMessage.findFirst({ where: { providerId: m.id, direction: "in" }, select: { id: true } })) return; // seen
    const contact = await this.contactFor(m.from);
    const payload = m.button?.payload ?? m.interactive?.button_reply?.id ?? null;
    const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? "";
    const button = payload ? /^(approve|changes):([0-9a-f-]{36})$/.exec(payload) : null;
    const original = button ? await this.tenant.db.whatsAppMessage.findFirst({ where: { id: button[2], direction: "out" } }) : null;
    await this.tenant.db.whatsAppMessage.create({
      data: {
        agencyId: this.tenant.agencyId,
        direction: "in",
        clientId: contact?.clientId,
        contactId: contact?.id,
        phone: m.from,
        purpose: button ? "button" : "text",
        body: { text, ...(payload && { payload }) },
        relatedType: original?.relatedType,
        relatedId: original?.relatedId,
        status: "received",
        providerId: m.id,
      },
    });
    if (!contact) return;

    if (button && original && original.contactId === contact.id) return this.answer(contact, button[1] as "approve" | "changes", original);
    if (STOP.test(text)) {
      await this.whatsapp.setOptIn(contact.id, false, "Replied STOP on WhatsApp");
      return;
    }
    // Text after asking for changes (within a day) is the detail of what to change.
    const asked = await this.tenant.db.whatsAppMessage.findFirst({
      where: {
        direction: "in",
        contactId: contact.id,
        purpose: "button",
        createdAt: { gte: new Date(Date.now() - DAY) },
        body: { path: ["payload"], string_starts_with: "changes:" },
      },
      orderBy: { createdAt: "desc" },
    });
    if (asked?.relatedType && asked.relatedId) return this.detail(contact, asked.relatedType, asked.relatedId, text);
    const client = await this.tenant.db.client.findUniqueOrThrow({ where: { id: contact.clientId }, select: { name: true, accountOwnerId: true } });
    await this.tenant.tx((tx) =>
      this.notifications.notify(tx, client.accountOwnerId ? { users: [client.accountOwnerId] } : { can: { area: "clients", level: "edit" } }, {
        kind: "client_portal",
        title: `${contact.name} (${client.name}) on WhatsApp`,
        body: text.slice(0, 300),
        link: `/app/clients/${contact.clientId}`,
      }),
    );
  }

  private reply(contact: Contact, text: string, related?: { type: string; id: string }) {
    return this.tenant.tx((tx) => this.whatsapp.queueText(tx, { id: contact.id, phone: contact.phone, clientId: contact.clientId }, text, related));
  }

  /** Approve or Request changes on the script or video the message was about — as the client, if it still waits. */
  private async answer(contact: Contact, action: "approve" | "changes", original: { relatedType: string | null; relatedId: string | null; body: unknown }) {
    const approved = action === "approve";
    const decision = approved ? { approved: true as const } : { approved: false as const, note: "Asked for changes on WhatsApp" };
    const as = <T>(fn: () => Promise<T>) => asPortal(this.tenant.agencyId, { clientId: contact.clientId, contactId: contact.id, name: contact.name }, fn);
    let done = false;
    if (original.relatedType === "video" && original.relatedId) {
      const versionId = (original.body as { versionId?: string }).versionId;
      done = await as(async () => {
        const v = await this.videos.get(original.relatedId!);
        const sent = v.versions.find((x) => x.status === "sent");
        if (v.client.id !== contact.clientId || v.stage !== "client_review" || !sent || (versionId && sent.id !== versionId)) return false;
        await this.videos.decide(v.id, decision);
        return true;
      });
    } else if (original.relatedType === "script" && original.relatedId) {
      done = await as(async () => {
        const c = await this.content.get(original.relatedId!);
        if (c.client.id !== contact.clientId || c.stage !== "approval" || c.scripts[0]?.status !== "sent") return false;
        await this.content.decide(c.id, decision);
        return true;
      });
    }
    const related = original.relatedType && original.relatedId ? { type: original.relatedType, id: original.relatedId } : undefined;
    if (!done) return this.reply(contact, "Thank you — this one has already been answered.", related);
    return this.reply(contact, approved ? "Thank you — approved." : "Thank you. What would you like changed? Reply here and the team will see it.", related);
  }

  /** The client's words after asking for changes: a comment on the video's version, or the script's note. */
  private async detail(contact: Contact, type: string, id: string, text: string) {
    await asPortal(this.tenant.agencyId, { clientId: contact.clientId, contactId: contact.id, name: contact.name }, async () => {
      if (type === "video") {
        const v = await this.videos.get(id);
        const version = v.versions.find((x) => x.status === "changes_requested") ?? v.versions[0];
        if (!version) return;
        await this.videos.comment(id, version.id, { text, author: contact.name });
        await this.tenant.tx((tx) =>
          this.notifications.notify(
            tx,
            { users: [v.editor?.id, v.director?.id] },
            {
              kind: "client_portal",
              title: `${contact.name} on WhatsApp about ${v.code}`,
              body: text.slice(0, 300),
              link: `/app/production/${id}?tab=versions`,
            },
          ),
        );
      } else if (type === "script") {
        const c = await this.content.get(id);
        const last = c.scripts[0];
        if (!last) return;
        await this.tenant.db.scriptVersion.update({ where: { id: last.id }, data: { clientNote: [last.clientNote, text].filter(Boolean).join("\n") } });
        await this.tenant.tx((tx) =>
          this.notifications.notify(
            tx,
            { users: [c.owner?.id] },
            { kind: "client_portal", title: `${contact.name} on WhatsApp about “${c.title}”`, body: text.slice(0, 300), link: `/app/content/${id}` },
          ),
        );
      }
    });
  }
}
