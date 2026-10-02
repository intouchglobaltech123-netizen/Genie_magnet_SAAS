import { randomBytes } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TenantTx } from "@gm/db";
import {
  firstName,
  waNumber,
  type WhatsAppConnectionInput,
  type WhatsAppMessageRow,
  WHATSAPP_PURPOSES,
  type WhatsAppPurposeKey,
  type WhatsAppSettings,
  type WhatsAppTemplateInput,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { Secrets } from "../common/secrets.js";
import { ENV, type Env } from "../env.js";
import { JobsService } from "../jobs/jobs.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { PermanentWhatsAppError, WHATSAPP_PROVIDER, type WhatsAppProvider } from "./provider.js";

const IST_MINUTES = 330;
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** The first moment at or after `now` outside the quiet hours (India time); quiet hours may run past midnight. */
export function afterQuietHours(now: Date, from: string, to: string): Date {
  const local = (now.getUTCHours() * 60 + now.getUTCMinutes() + IST_MINUTES) % 1440;
  const f = minutesOf(from);
  const t = minutesOf(to);
  const quiet = f === t ? false : f < t ? local >= f && local < t : local >= f || local < t;
  if (!quiet) return now;
  const wait = (t - local + 1440) % 1440;
  return new Date(now.getTime() + wait * 60_000 - now.getUTCSeconds() * 1000 - now.getUTCMilliseconds());
}

/** A contact a message may go to. */
export interface Recipient {
  id: string;
  name: string;
  phone: string;
  clientId: string;
  whatsappOptIn: boolean;
}

/**
 * WhatsApp (P3-07): an agency connects its own number (WhatsApp Cloud API details it enters; secrets encrypted),
 * registers the templates it had approved for each purpose, and the app sends them — only to contacts who agreed,
 * outside quiet hours, as background jobs with retries — keeping every message in a log.
 */
@Injectable()
export class WhatsAppService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly secrets: Secrets,
    private readonly jobs: JobsService,
  ) {}

  // ─── Settings ──────────────────────────────────────────────────────

  async settings(): Promise<WhatsAppSettings> {
    const [c, templates] = await Promise.all([
      this.tenant.db.whatsAppConnection.findUnique({ where: { agencyId: this.tenant.agencyId } }),
      this.tenant.db.whatsAppTemplate.findMany({ orderBy: { purpose: "asc" } }),
    ]);
    return {
      connection: c && {
        phoneNumberId: c.phoneNumberId,
        businessId: c.businessId,
        displayPhone: c.displayPhone,
        verifiedName: c.verifiedName,
        tokenHint: c.tokenHint,
        hasAppSecret: !!c.appSecret,
        status: c.status as "unchecked" | "connected" | "error",
        lastError: c.lastError,
        checkedAt: c.checkedAt?.toISOString() ?? null,
        quietFrom: c.quietFrom,
        quietTo: c.quietTo,
        webhookUrl: `${this.env.PUBLIC_API_URL}/webhooks/whatsapp/${c.id}`,
        verifyToken: c.verifyToken,
      },
      templates: templates.map((t) => ({ purpose: t.purpose, name: t.name, language: t.language, active: t.active })),
      provider: this.provider.kind,
    };
  }

  async saveConnection(input: WhatsAppConnectionInput & { quietFrom: string; quietTo: string }) {
    const existing = await this.tenant.db.whatsAppConnection.findUnique({ where: { agencyId: this.tenant.agencyId } });
    if (!existing && !input.accessToken)
      throw new BadRequestException({ message: "Paste the access token.", issues: [{ path: "accessToken", message: "Paste the permanent access token" }] });
    const secrets = {
      ...(input.accessToken && { accessToken: this.secrets.encrypt(input.accessToken), tokenHint: Secrets.hint(input.accessToken) }),
      ...(input.appSecret && { appSecret: this.secrets.encrypt(input.appSecret) }),
    };
    const changedNumber = !!existing && existing.phoneNumberId !== input.phoneNumberId;
    await this.tenant.tx(async (tx) => {
      const data = {
        phoneNumberId: input.phoneNumberId,
        businessId: input.businessId ?? null,
        quietFrom: input.quietFrom,
        quietTo: input.quietTo,
        ...secrets,
        // New details are checked again before they count as connected.
        ...((input.accessToken || changedNumber) && { status: "unchecked", lastError: null, displayPhone: null, verifiedName: null }),
      };
      if (existing) await tx.whatsAppConnection.update({ where: { id: existing.id }, data });
      else
        await tx.whatsAppConnection.create({
          data: {
            ...data,
            agencyId: this.tenant.agencyId,
            accessToken: secrets.accessToken!,
            tokenHint: secrets.tokenHint!,
            verifyToken: randomBytes(18).toString("base64url"),
            createdBy: this.tenant.userId,
          },
        });
      await this.audit.record(tx, {
        action: existing ? "update" : "connect",
        entity: "whatsapp",
        after: {
          phoneNumberId: input.phoneNumberId,
          quietHours: `${input.quietFrom}–${input.quietTo}`,
          ...(input.accessToken && { accessToken: Secrets.hint(input.accessToken) }),
          ...(input.appSecret && { appSecret: "(new)" }),
        },
      });
    });
    return input.accessToken || changedNumber ? this.check() : this.settings();
  }

  /** Asks WhatsApp for the number's details with the saved token: connected, or the reason it is not. */
  async check() {
    const c = await this.tenant.db.whatsAppConnection.findUnique({ where: { agencyId: this.tenant.agencyId } });
    if (!c) throw new NotFoundException("Connect your WhatsApp number first.");
    try {
      const r = await this.provider.check({ phoneNumberId: c.phoneNumberId, accessToken: this.secrets.decrypt(c.accessToken) });
      await this.tenant.db.whatsAppConnection.update({
        where: { id: c.id },
        data: { status: "connected", displayPhone: r.displayPhone, verifiedName: r.verifiedName, lastError: null, checkedAt: new Date() },
      });
    } catch (e) {
      await this.tenant.db.whatsAppConnection.update({
        where: { id: c.id },
        data: { status: "error", lastError: e instanceof Error ? e.message : String(e), checkedAt: new Date() },
      });
    }
    return this.settings();
  }

  async disconnect() {
    await this.tenant.tx(async (tx) => {
      const { count } = await tx.whatsAppConnection.deleteMany({ where: { agencyId: this.tenant.agencyId } });
      if (count) await this.audit.record(tx, { action: "disconnect", entity: "whatsapp" });
    });
    return this.settings();
  }

  async saveTemplate(input: Required<WhatsAppTemplateInput>) {
    await this.tenant.tx(async (tx) => {
      await tx.whatsAppTemplate.upsert({
        where: { agencyId_purpose: { agencyId: this.tenant.agencyId, purpose: input.purpose } },
        create: { agencyId: this.tenant.agencyId, purpose: input.purpose, name: input.name, language: input.language, active: input.active },
        update: { name: input.name, language: input.language, active: input.active },
      });
      await this.audit.record(tx, { action: "update", entity: "whatsapp_template", after: { ...input } });
    });
    return this.settings();
  }

  async removeTemplate(purpose: string) {
    await this.tenant.tx(async (tx) => {
      const { count } = await tx.whatsAppTemplate.deleteMany({ where: { purpose } });
      if (count) await this.audit.record(tx, { action: "delete", entity: "whatsapp_template", before: { purpose } });
    });
    return this.settings();
  }

  /** A test message to any number, with the approval request's template (or the first one registered). */
  async sendTest(phone: string) {
    const [c, templates] = await Promise.all([
      this.tenant.db.whatsAppConnection.findUnique({ where: { agencyId: this.tenant.agencyId } }),
      this.tenant.db.whatsAppTemplate.findMany({ where: { active: true } }),
    ]);
    if (!c) throw new ConflictException("Connect your WhatsApp number first.");
    const t = templates.find((x) => x.purpose === "approval_request") ?? templates[0];
    if (!t) throw new ConflictException("Add a template first.");
    const spec = WHATSAPP_PURPOSES[t.purpose as WhatsAppPurposeKey];
    const values = spec.variables.map((v, i) => (i === 0 ? "there" : `test ${v.toLowerCase()}`));
    try {
      const r = await this.provider.sendTemplate(
        { phoneNumberId: c.phoneNumberId, accessToken: this.secrets.decrypt(c.accessToken) },
        waNumber(phone),
        { name: t.name, language: t.language },
        values,
        spec.buttons.map((_, i) => `test:${i}`),
      );
      return { sent: true, id: r.id, template: t.name };
    } catch (e) {
      throw new BadRequestException(`WhatsApp did not send it: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ─── Opt-in ────────────────────────────────────────────────────────

  async setOptIn(contactId: string, optIn: boolean, source: string) {
    const c = await this.tenant.db.contact.findFirst({ where: { id: contactId }, include: { client: { select: { name: true } } } });
    if (!c) throw new NotFoundException("No contact with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.contact.update({ where: { id: contactId }, data: { whatsappOptIn: optIn, whatsappOptInAt: new Date(), whatsappOptInSource: source } });
      await this.audit.record(tx, {
        action: optIn ? "whatsapp_opt_in" : "whatsapp_opt_out",
        entity: "contact",
        entityId: contactId,
        after: { client: c.client.name, contact: c.name, source },
      });
    });
    return { optIn, source };
  }

  // ─── Queuing and sending ───────────────────────────────────────────

  /**
   * Queues a message for each contact, in the caller's transaction. Nothing happens when the agency has no WhatsApp
   * number; a contact who has not agreed, or a purpose with no template, is logged as skipped with the reason, so the
   * team can see why nobody was told. Returns the messages queued.
   */
  async queue(
    tx: TenantTx,
    purpose: WhatsAppPurposeKey,
    to: Recipient[],
    values: (r: Recipient) => string[],
    related: { type: string; id: string; extra?: Record<string, unknown> },
  ) {
    const c = await tx.whatsAppConnection.findUnique({ where: { agencyId: this.tenant.agencyId } });
    if (!c || !to.length) return [];
    const t = await tx.whatsAppTemplate.findUnique({ where: { agencyId_purpose: { agencyId: this.tenant.agencyId, purpose } } });
    const at = afterQuietHours(new Date(), c.quietFrom, c.quietTo);
    const queued: string[] = [];
    for (const r of to) {
      const reason =
        !t || !t.active
          ? "No template for this yet"
          : !r.whatsappOptIn
            ? "Has not agreed to WhatsApp messages"
            : c.status !== "connected"
              ? "The number is not connected"
              : null;
      const m = await tx.whatsAppMessage.create({
        data: {
          agencyId: this.tenant.agencyId,
          direction: "out",
          clientId: r.clientId,
          contactId: r.id,
          phone: waNumber(r.phone),
          purpose,
          template: t?.name,
          body: { values: reason ? [] : values(r), ...related.extra } as Prisma.InputJsonValue,
          relatedType: related.type,
          relatedId: related.id,
          status: reason ? "skipped" : "queued",
          reason,
        },
      });
      if (reason) continue;
      queued.push(m.id);
      await this.jobs.enqueue(tx, "whatsapp.send", { messageId: m.id }, { key: `wa:${m.id}`, runAt: at });
    }
    return queued;
  }

  /** The job that sends one queued message. A refusal that will not change fails it at once; anything else is retried. */
  async send(tx: TenantTx, messageId: string) {
    const m = await tx.whatsAppMessage.findUnique({ where: { id: messageId } });
    if (!m || m.status !== "queued") return { skipped: true };
    const c = await tx.whatsAppConnection.findUnique({ where: { agencyId: this.tenant.agencyId } });
    const fail = async (reason: string) => {
      await tx.whatsAppMessage.update({ where: { id: m.id }, data: { status: "failed", reason } });
      return { failed: reason };
    };
    if (!c) return fail("The WhatsApp number was disconnected");
    const number = { phoneNumberId: c.phoneNumberId, accessToken: this.secrets.decrypt(c.accessToken) };
    const body = m.body as { values?: string[]; text?: string };
    try {
      let id: string;
      if (m.purpose === "text") id = (await this.provider.sendText(number, m.phone, body.text ?? "")).id;
      else {
        const t = await tx.whatsAppTemplate.findUnique({ where: { agencyId_purpose: { agencyId: this.tenant.agencyId, purpose: m.purpose } } });
        if (!t) return fail("The template was removed");
        const buttons = WHATSAPP_PURPOSES[m.purpose as WhatsAppPurposeKey].buttons.map((b) => `${b === "Approve" ? "approve" : "changes"}:${m.id}`);
        id = (await this.provider.sendTemplate(number, m.phone, { name: t.name, language: t.language }, body.values ?? [], buttons)).id;
      }
      await tx.whatsAppMessage.update({ where: { id: m.id }, data: { status: "sent", providerId: id || null, sentAt: new Date(), reason: null } });
      return { sent: id };
    } catch (e) {
      if (e instanceof PermanentWhatsAppError) return fail(e.message);
      throw e;
    }
  }

  /** Free text to a contact (a reply within WhatsApp's 24-hour window), queued like any message. */
  async queueText(tx: TenantTx, to: { id: string | null; phone: string; clientId: string | null }, text: string, related?: { type: string; id: string }) {
    const m = await tx.whatsAppMessage.create({
      data: {
        agencyId: this.tenant.agencyId,
        direction: "out",
        clientId: to.clientId,
        contactId: to.id,
        phone: waNumber(to.phone),
        purpose: "text",
        body: { text },
        relatedType: related?.type,
        relatedId: related?.id,
        status: "queued",
      },
    });
    await this.jobs.enqueue(tx, "whatsapp.send", { messageId: m.id }, { key: `wa:${m.id}` });
  }

  // ─── The log ───────────────────────────────────────────────────────

  async messages(f: { clientId?: string; status?: string }): Promise<WhatsAppMessageRow[]> {
    const rows = await this.tenant.db.whatsAppMessage.findMany({
      where: { ...(f.clientId && { clientId: f.clientId }), ...(f.status && { status: f.status }) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const [clients, contacts] = await Promise.all([
      this.tenant.db.client.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.clientId).filter((x): x is string => !!x))] } },
        select: { id: true, name: true },
      }),
      this.tenant.db.contact.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.contactId).filter((x): x is string => !!x))] } },
        select: { id: true, name: true },
      }),
    ]);
    return rows.map((r) => {
      const body = r.body as { values?: string[]; text?: string };
      const spec = WHATSAPP_PURPOSES[r.purpose as WhatsAppPurposeKey];
      const text =
        body.text ??
        (spec && body.values?.length
          ? spec.suggested.replace(/\{\{(\d+)\}\}/g, (_, i: string) => body.values![Number(i) - 1] ?? "")
          : (spec?.label ?? r.purpose));
      return {
        id: r.id,
        direction: r.direction as "out" | "in",
        client: clients.find((c) => c.id === r.clientId) ?? null,
        contact: contacts.find((c) => c.id === r.contactId) ?? null,
        phone: r.phone,
        purpose: r.purpose,
        text,
        status: r.status as WhatsAppMessageRow["status"],
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
        sentAt: r.sentAt?.toISOString() ?? null,
      };
    });
  }

  /** A greeting with the contact's first name. */
  static hello(r: Recipient) {
    return firstName(r.name);
  }
}
