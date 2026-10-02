import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { TenantTx } from "@gm/db";
import { firstName } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { Secrets } from "../common/secrets.js";
import { ENV, type Env } from "../env.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { type Recipient, WhatsAppService } from "./whatsapp.service.js";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * What the app tells clients on WhatsApp (P3-08): approval requests with Approve and Request changes buttons, videos
 * gone live, invoices ready, onboarding reminders. Each goes to the client's approvers who agreed to WhatsApp, with
 * their own portal link (made for them if they have none). Called inside the change's own transaction.
 */
@Injectable()
export class ClientMessages {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly secrets: Secrets,
    private readonly whatsapp: WhatsAppService,
  ) {}

  private async approvers(tx: TenantTx, clientId: string): Promise<Recipient[]> {
    return tx.contact.findMany({ where: { clientId, approver: true }, select: { id: true, name: true, phone: true, clientId: true, whatsappOptIn: true } });
  }

  private async active(tx: TenantTx) {
    return !!(await tx.whatsAppConnection.findUnique({ where: { agencyId: this.tenant.agencyId }, select: { id: true } }));
  }

  /** The contact's portal link; a link the app cannot read back (made before links were kept encrypted) is replaced. */
  async portalLink(tx: TenantTx, contact: { id: string; clientId: string; name: string }) {
    const existing = await tx.portalLink.findUnique({ where: { contactId: contact.id } });
    if (existing?.tokenSecret) return `${this.env.WEB_ORIGIN}/app/c/${this.secrets.decrypt(existing.tokenSecret)}`;
    const token = randomBytes(24).toString("base64url");
    const data = { token: hash(token), tokenSecret: this.secrets.encrypt(token) };
    if (existing) await tx.portalLink.update({ where: { id: existing.id }, data });
    else await tx.portalLink.create({ data: { agencyId: this.tenant.agencyId, clientId: contact.clientId, contactId: contact.id, ...data } });
    await this.audit.record(tx, {
      action: "share",
      entity: "portal_link",
      entityId: contact.id,
      after: { contact: contact.name, link: existing ? "replaced" : "new", via: "whatsapp" },
    });
    return `${this.env.WEB_ORIGIN}/app/c/${token}`;
  }

  /** Links for each recipient, made before the messages are queued. */
  private async links(tx: TenantTx, to: Recipient[]) {
    const out = new Map<string, string>();
    for (const r of to) if (r.whatsappOptIn) out.set(r.id, await this.portalLink(tx, r));
    return out;
  }

  /** A script or a video version is with the client: Approve or Request changes, from WhatsApp. */
  async approvalRequest(tx: TenantTx, clientId: string, what: string, related: { type: "script" | "video"; id: string; extra?: Record<string, unknown> }) {
    if (!(await this.active(tx))) return [];
    const to = await this.approvers(tx, clientId);
    const links = await this.links(tx, to);
    return this.whatsapp.queue(tx, "approval_request", to, (r) => [firstName(r.name), what, links.get(r.id) ?? ""], related);
  }

  async videoPublished(tx: TenantTx, clientId: string, video: { id: string; code: string; title: string }, where: string, url: string) {
    if (!(await this.active(tx))) return [];
    const to = await this.approvers(tx, clientId);
    return this.whatsapp.queue(tx, "video_published", to, (r) => [firstName(r.name), `“${video.title}”`, where, url], { type: "video", id: video.id });
  }

  async invoiceIssued(tx: TenantTx, clientId: string, invoice: { id: string; number: string; total: number; dueDate: Date | null }) {
    if (!(await this.active(tx))) return [];
    const to = await this.approvers(tx, clientId);
    const links = await this.links(tx, to);
    return this.whatsapp.queue(
      tx,
      "invoice_issued",
      to,
      (r) => [firstName(r.name), invoice.number, money(invoice.total), invoice.dueDate ? fmt(invoice.dueDate) : "on receipt", links.get(r.id) ?? ""],
      { type: "invoice", id: invoice.id },
    );
  }

  /**
   * An onboarding reminder sent by the app itself (P3-08). Needs the onboarding link kept encrypted; returns how many
   * were queued — none when WhatsApp cannot take it, and the team is then asked to send it themselves.
   */
  async onboardingReminder(tx: TenantTx, response: { id: string; clientId: string; tokenSecret: string | null }, agencyName: string) {
    if (!response.tokenSecret || !(await this.active(tx))) return [];
    const link = `${this.env.WEB_ORIGIN}/app/q/${this.secrets.decrypt(response.tokenSecret)}`;
    const to = await this.approvers(tx, response.clientId);
    return this.whatsapp.queue(tx, "onboarding_reminder", to, (r) => [firstName(r.name), agencyName, link], { type: "onboarding", id: response.id });
  }
}
