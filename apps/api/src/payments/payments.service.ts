import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { findPaymentConnection, Prisma, type TenantTx } from "@gm/db";
import type { PaymentConnectionInput, PaymentSettings } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { Secrets } from "../common/secrets.js";
import { ENV, type Env } from "../env.js";
import { JobsService } from "../jobs/jobs.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { asSystem, TenantDb } from "../tenancy/tenant-context.js";
import { PAYMENTS_PROVIDER, type PaymentsProvider, PermanentPaymentError } from "./provider.js";

/** The day (India time) a payment was made. */
const istDay = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);

type RazorpayEvent = {
  event?: string;
  payload?: {
    payment_link?: { entity?: { id?: string; status?: string } };
    payment?: { entity?: { id?: string; amount?: number; method?: string; created_at?: number } };
  };
};

/**
 * Payments (P3-10): an agency takes invoice payments through its own Razorpay account. Each issued invoice gets a
 * payment link (a background job, so issuing never waits on Razorpay); when Razorpay says a link was paid — signed with
 * the agency's webhook secret — the payment is recorded once and the invoice is marked paid by itself.
 */
@Injectable()
export class PaymentsService {
  private readonly log = new Logger("Payments");

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(PAYMENTS_PROVIDER) private readonly provider: PaymentsProvider,
    private readonly prisma: PrismaService,
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly secrets: Secrets,
    private readonly jobs: JobsService,
    private readonly notifications: NotificationsService,
  ) {}

  private connection() {
    return this.tenant.db.paymentConnection.findUnique({ where: { agencyId: this.tenant.agencyId } });
  }

  async settings(): Promise<PaymentSettings> {
    const c = await this.connection();
    return {
      connection: c && {
        keyId: c.keyId,
        mode: c.keyId.startsWith("rzp_test_") ? "test" : "live",
        secretHint: c.secretHint,
        status: c.status as "unchecked" | "connected" | "error",
        lastError: c.lastError,
        checkedAt: c.checkedAt?.toISOString() ?? null,
        webhookUrl: `${this.env.PUBLIC_API_URL}/webhooks/razorpay/${c.id}`,
        webhookSecret: this.secrets.decrypt(c.webhookSecret),
      },
      provider: this.provider.kind,
    };
  }

  async connect(input: PaymentConnectionInput) {
    const existing = await this.connection();
    if (!existing && !input.keySecret)
      throw new BadRequestException({ message: "Paste the key secret.", issues: [{ path: "keySecret", message: "Paste the key secret" }] });
    await this.tenant.tx(async (tx) => {
      const data = {
        keyId: input.keyId,
        ...(input.keySecret && { keySecret: this.secrets.encrypt(input.keySecret), secretHint: Secrets.hint(input.keySecret) }),
        status: "unchecked",
        lastError: null,
      };
      if (existing) await tx.paymentConnection.update({ where: { id: existing.id }, data });
      else
        await tx.paymentConnection.create({
          data: {
            ...data,
            agencyId: this.tenant.agencyId,
            keySecret: this.secrets.encrypt(input.keySecret!),
            secretHint: Secrets.hint(input.keySecret!),
            webhookSecret: this.secrets.encrypt(randomBytes(24).toString("base64url")),
            createdBy: this.tenant.userId,
          },
        });
      await this.audit.record(tx, {
        action: existing ? "update" : "connect",
        entity: "payments",
        after: { keyId: input.keyId, ...(input.keySecret && { keySecret: Secrets.hint(input.keySecret) }) },
      });
    });
    return this.check();
  }

  /** Tries the saved keys with Razorpay: connected, or the reason they are not. */
  async check() {
    const c = await this.connection();
    if (!c) throw new NotFoundException("Connect Razorpay first.");
    try {
      await this.provider.check({ keyId: c.keyId, keySecret: this.secrets.decrypt(c.keySecret) });
      await this.tenant.db.paymentConnection.update({ where: { id: c.id }, data: { status: "connected", lastError: null, checkedAt: new Date() } });
    } catch (e) {
      await this.tenant.db.paymentConnection.update({
        where: { id: c.id },
        data: { status: "error", lastError: e instanceof Error ? e.message : String(e), checkedAt: new Date() },
      });
    }
    return this.settings();
  }

  async disconnect() {
    await this.tenant.tx(async (tx) => {
      const { count } = await tx.paymentConnection.deleteMany({ where: { agencyId: this.tenant.agencyId } });
      if (count) await this.audit.record(tx, { action: "disconnect", entity: "payments" });
    });
    return this.settings();
  }

  // ─── Payment links ─────────────────────────────────────────────────

  /** Queues the link for an issued invoice, in the caller's transaction (when the agency takes payments online). */
  async queueLink(tx: TenantTx, invoiceId: string) {
    const c = await tx.paymentConnection.findUnique({ where: { agencyId: this.tenant.agencyId }, select: { status: true } });
    if (!c || c.status !== "connected") return false;
    await this.jobs.enqueue(tx, "payments.link", { invoiceId }, { key: `paylink:${invoiceId}:${Date.now()}` });
    return true;
  }

  /** The team asks for a link again (after Razorpay refused one, or one made before payments were connected). */
  async requestLink(invoiceId: string) {
    const inv = await this.tenant.db.invoice.findFirst({ where: { id: invoiceId }, select: { status: true, payLinkStatus: true } });
    if (!inv) throw new NotFoundException("No invoice with that id.");
    if (inv.status !== "sent") throw new ConflictException("Only an issued, unpaid invoice gets a payment link.");
    if (inv.payLinkStatus === "created") throw new ConflictException("This invoice already has a payment link.");
    const queued = await this.tenant.tx((tx) => this.queueLink(tx, invoiceId));
    if (!queued) throw new ConflictException("Connect your Razorpay account in Settings → Payments first.");
    return { queued: true };
  }

  /** The job: makes the link with Razorpay and keeps it on the invoice. */
  async makeLink(tx: TenantTx, invoiceId: string) {
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { client: { select: { name: true } } } });
    if (!inv || inv.status !== "sent" || inv.payLinkStatus === "created" || inv.payLinkStatus === "paid") return { skipped: true };
    const c = await tx.paymentConnection.findUnique({ where: { agencyId: this.tenant.agencyId } });
    if (!c) return { skipped: true };
    const approver = await tx.contact.findFirst({ where: { clientId: inv.clientId, approver: true }, select: { phone: true, email: true } });
    const billedTo = (inv.billedTo as { name?: string } | null)?.name ?? inv.client.name;
    try {
      const link = await this.provider.createLink(
        { keyId: c.keyId, keySecret: this.secrets.decrypt(c.keySecret) },
        {
          amount: inv.total,
          reference: inv.number ?? inv.id,
          description: `Invoice ${inv.number}${inv.period ? ` for ${inv.period}` : ""}`,
          customer: {
            name: billedTo,
            ...(approver?.phone && { contact: approver.phone.replace(/[^\d+]/g, "") }),
            ...(approver?.email && { email: approver.email }),
          },
          notes: { invoice_id: inv.id, invoice_number: inv.number ?? "" },
        },
      );
      await tx.invoice.update({ where: { id: inv.id }, data: { payLinkId: link.id, payLinkUrl: link.url, payLinkStatus: "created", payLinkError: null } });
      return { link: link.id };
    } catch (e) {
      if (!(e instanceof PermanentPaymentError)) throw e;
      await tx.invoice.update({ where: { id: inv.id }, data: { payLinkStatus: "failed", payLinkError: e.message } });
      return { failed: e.message };
    }
  }

  /** Queues switching the link off (the invoice was cancelled). */
  async queueCancel(tx: TenantTx, invoiceId: string) {
    await this.jobs.enqueue(tx, "payments.cancel", { invoiceId }, { key: `paycancel:${invoiceId}` });
  }

  async cancelLink(tx: TenantTx, invoiceId: string) {
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { payLinkId: true, payLinkStatus: true } });
    const c = await tx.paymentConnection.findUnique({ where: { agencyId: this.tenant.agencyId } });
    if (!inv?.payLinkId || inv.payLinkStatus !== "created" || !c) return { skipped: true };
    try {
      await this.provider.cancelLink({ keyId: c.keyId, keySecret: this.secrets.decrypt(c.keySecret) }, inv.payLinkId);
    } catch (e) {
      if (!(e instanceof PermanentPaymentError)) throw e;
    }
    await tx.invoice.update({ where: { id: invoiceId }, data: { payLinkStatus: "cancelled" } });
    return { cancelled: inv.payLinkId };
  }

  // ─── What Razorpay sends back ──────────────────────────────────────

  async receive(connectionId: string, raw: Buffer | undefined, signature: string | undefined, body: RazorpayEvent) {
    const c = await findPaymentConnection(this.prisma.client, connectionId);
    if (!c) throw new NotFoundException("Unknown address.");
    if (!raw || !signature) throw new ForbiddenException("Not signed.");
    const expected = Buffer.from(createHmac("sha256", this.secrets.decrypt(c.webhookSecret)).update(raw).digest("hex"));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new ForbiddenException("Wrong signature.");
    await asSystem(c.agencyId, () => this.handle(body));
    return { ok: true };
  }

  private async handle(e: RazorpayEvent) {
    const linkId = e.payload?.payment_link?.entity?.id;
    if (!linkId) return;
    const inv = await this.tenant.db.invoice.findFirst({ where: { payLinkId: linkId }, include: { client: { select: { name: true } } } });
    if (!inv) return;
    if (e.event === "payment_link.cancelled" || e.event === "payment_link.expired") {
      if (inv.payLinkStatus === "created") await this.tenant.db.invoice.update({ where: { id: inv.id }, data: { payLinkStatus: e.event.split(".")[1] } });
      return;
    }
    if (e.event !== "payment_link.paid") return;
    const p = e.payload?.payment?.entity;
    if (!p?.id || typeof p.amount !== "number") return;
    const amount = Math.round(p.amount / 100);
    const paidAt = p.created_at ? new Date(p.created_at * 1000) : new Date();
    try {
      await this.tenant.tx(async (tx) => {
        await tx.payment.create({
          data: { agencyId: this.tenant.agencyId, invoiceId: inv.id, providerPaymentId: p.id!, amount, method: p.method ?? null, paidAt },
        });
        await tx.invoice.update({ where: { id: inv.id }, data: { payLinkStatus: "paid" } });
        if (inv.status !== "sent") return;
        const full = amount >= inv.total;
        if (full)
          await tx.invoice.update({
            where: { id: inv.id },
            data: { status: "paid", paidOn: new Date(`${istDay(paidAt)}T00:00:00Z`), paymentNote: `Paid online (${p.method ?? "Razorpay"}, ${p.id})` },
          });
        await this.audit.record(tx, {
          action: full ? "paid" : "part_paid",
          entity: "invoice",
          entityId: inv.id,
          after: { number: inv.number, amount, via: "razorpay", payment: p.id },
        });
        await this.notifications.notify(
          tx,
          { users: [inv.createdBy], can: { area: "invoices", level: "approve" } },
          {
            kind: "invoice_paid",
            title: `${full ? "Paid online" : "Part paid online"}: ${inv.number} · ${inv.client.name}`,
            body: `₹${amount.toLocaleString("en-IN")} by ${p.method ?? "Razorpay"}`,
            link: `/app/invoices/${inv.id}`,
          },
        );
      });
    } catch (err) {
      // Razorpay sent this payment again: it is already recorded.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
      this.log.warn(`payment ${p.id}: ${String(err)}`);
      throw err;
    }
  }
}
