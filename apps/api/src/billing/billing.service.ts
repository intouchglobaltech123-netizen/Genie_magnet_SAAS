import { ConflictException, ForbiddenException, Inject, Injectable, Logger } from "@nestjs/common";
import { asPlatform, type Prisma, withAgency } from "@gm/db";
import { financialYear, invoiceTotals, type PlanCurrency, type PlatformInvoiceRow, type PlatformSettings, rupeesInWords, stateName } from "@gm/shared";
import { ENV, type Env } from "../env.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PlatformSettingsService } from "../platform/platform-settings.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { asSystem, TenantDb } from "../tenancy/tenant-context.js";
import { BILLING_PROVIDER, type BillingProvider, razorpaySigned, stripeSigned } from "./billing-provider.js";

const DAY = 86_400_000;
const day = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
const fromUnix = (s: unknown) => (typeof s === "number" ? new Date(s * 1000) : null);
const addMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()));
type Party = PlatformInvoiceRow["seller"];
type InvoiceRow = Prisma.PlatformInvoiceGetPayload<object>;

/** What a plan costs in a currency: before tax, and what is charged (GST on rupees; none on exports). */
export function priceOf(settings: PlatformSettings, planKey: string, currency: PlanCurrency) {
  const plan = settings.plans.find((p) => p.key === planKey);
  const amount = plan ? (currency === "INR" ? plan.priceInr : plan.priceUsd) : null;
  if (!plan || amount === null) return null;
  const tax = currency === "INR" ? Math.round((amount * settings.invoice.gstRate) / 100) : 0;
  return { plan, amount, charge: amount + tax };
}

export function invoiceRow(r: InvoiceRow, agencyName: string): PlatformInvoiceRow {
  return {
    id: r.id,
    number: r.number,
    agency: { id: r.agencyId, name: agencyName },
    issuedOn: r.issuedOn.toISOString().slice(0, 10),
    periodStart: r.periodStart.toISOString().slice(0, 10),
    periodEnd: r.periodEnd.toISOString().slice(0, 10),
    plan: { key: r.planKey, name: r.planName },
    currency: r.currency as PlanCurrency,
    amount: r.amount,
    cgst: r.cgst,
    sgst: r.sgst,
    igst: r.igst,
    total: r.total,
    totalInWords: r.currency === "INR" ? rupeesInWords(r.total) : `US dollars ${r.total.toLocaleString("en-US")} only`,
    gstRate: r.gstRate,
    seller: r.seller as Party,
    buyer: r.buyer as Party,
    sac: r.sac,
    provider: r.provider,
    paidAt: r.paidAt.toISOString(),
  };
}

type RazorpayEvent = {
  event: string;
  payload?: {
    subscription?: { entity?: { id?: string; notes?: Record<string, string>; current_start?: number; current_end?: number } };
    payment?: { entity?: { id?: string } };
  };
};
type StripeEvent = { type: string; data?: { object?: Record<string, unknown> } };

/**
 * Billing (P6-04, ADR 0011): a payment starts or renews the agency's plan for its period and issues our GST invoice,
 * numbered across the platform (CGST and SGST in our state, IGST across states, none on an export); a failed payment
 * puts the plan past due for the grace period; a cancelled subscription ends at its period's end. The payment
 * providers' webhooks are signed and may come twice: each payment issues one invoice.
 */
@Injectable()
export class BillingService {
  private readonly log = new Logger("Billing");

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(BILLING_PROVIDER) readonly provider: BillingProvider,
    private readonly prisma: PrismaService,
    private readonly platform: PlatformSettingsService,
    private readonly tenant: TenantDb,
    private readonly notifications: NotificationsService,
  ) {}

  /** Our invoice for one payment; nothing when that payment already has one. */
  async issue(i: {
    agencyId: string;
    planKey: string;
    currency: PlanCurrency;
    periodStart: Date;
    periodEnd: Date;
    provider: string;
    paymentRef: string;
  }): Promise<string | null> {
    const settings = await this.platform.get();
    const price = priceOf(settings, i.planKey, i.currency);
    if (!price) {
      this.log.error(`No ${i.currency} price for plan ${i.planKey}: no invoice for payment ${i.paymentRef}`, { agencyId: i.agencyId });
      return null;
    }
    // The agency's own details, read inside the agency.
    const buyer = await withAgency(this.prisma.client, i.agencyId, async (tx) => {
      const [a, s] = await Promise.all([
        tx.agency.findUnique({ where: { id: i.agencyId }, select: { name: true } }),
        tx.invoiceSettings.findUnique({ where: { agencyId: i.agencyId } }),
      ]);
      return { name: s?.legalName || a?.name || "", gstin: s?.gstin ?? "", address: s?.address ?? "", state: s?.state ?? "" };
    });
    const seller: Party = {
      name: settings.invoice.legalName || settings.brandName,
      gstin: settings.invoice.gstin,
      address: settings.invoice.address,
      state: settings.invoice.stateCode,
    };
    const tax =
      i.currency === "INR"
        ? invoiceTotals([{ quantity: 1, rate: price.amount, taxRate: settings.invoice.gstRate }], {
            intraState: !!seller.state && seller.state === buyer.state,
            registered: true,
          })
        : { cgst: 0, sgst: 0, igst: 0 };
    const issuedOn = day(new Date());
    return asPlatform(this.prisma.client, async (tx) => {
      if (await tx.platformInvoice.findUnique({ where: { provider_paymentRef: { provider: i.provider, paymentRef: i.paymentRef } } })) return null;
      // One number at a time across the platform, in each financial year.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('platform_invoice_number'))`;
      const prefix = `${settings.invoice.prefix}/${financialYear(issuedOn).short}/`;
      const n = (await tx.platformInvoice.count({ where: { number: { startsWith: prefix } } })) + 1;
      const created = await tx.platformInvoice.create({
        data: {
          agencyId: i.agencyId,
          number: `${prefix}${String(n).padStart(4, "0")}`,
          issuedOn: new Date(`${issuedOn}T00:00:00Z`),
          periodStart: new Date(`${day(i.periodStart)}T00:00:00Z`),
          periodEnd: new Date(`${day(i.periodEnd)}T00:00:00Z`),
          planKey: price.plan.key,
          planName: price.plan.name,
          currency: i.currency,
          amount: price.amount,
          cgst: tax.cgst,
          sgst: tax.sgst,
          igst: tax.igst,
          total: price.amount + tax.cgst + tax.sgst + tax.igst,
          gstRate: i.currency === "INR" ? settings.invoice.gstRate : 0,
          seller: { ...seller, state: stateName(seller.state) ?? seller.state },
          buyer: { ...buyer, state: stateName(buyer.state) ?? buyer.state },
          sac: settings.invoice.sac,
          provider: i.provider,
          paymentRef: i.paymentRef,
        },
      });
      return created.id;
    });
  }

  /** A payment came in: the plan runs to the period's end, and our invoice is issued. */
  async paid(p: {
    agencyId: string;
    planKey: string;
    currency: PlanCurrency;
    provider: "outbox" | "razorpay" | "stripe";
    ref: string;
    paymentRef: string;
    periodStart: Date;
    periodEnd: Date;
  }) {
    const before = await asPlatform(this.prisma.client, async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { agencyId: p.agencyId } });
      const data = {
        planKey: p.planKey,
        status: "active",
        trialEndsAt: null,
        currentPeriodEnd: p.periodEnd,
        graceUntil: null,
        provider: p.provider,
        providerRef: p.ref,
      };
      await tx.subscription.upsert({ where: { agencyId: p.agencyId }, create: { agencyId: p.agencyId, ...data }, update: data });
      return sub;
    });
    // A new subscription replaces the one before it.
    if (before?.providerRef && before.providerRef !== p.ref)
      await this.provider
        .cancel(before.provider, before.providerRef)
        .catch((e: unknown) => this.log.warn(`Could not stop the earlier subscription: ${String(e)}`));
    return this.issue({ ...p });
  }

  /** A payment failed: past due, the grace period counted from the first failure; the agency is told. */
  async failed(agencyId: string) {
    const settings = await this.platform.get();
    const grace = await asPlatform(this.prisma.client, async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { agencyId } });
      if (!sub) return null;
      const graceUntil = sub.graceUntil ?? new Date(Date.now() + settings.graceDays * DAY);
      await tx.subscription.update({ where: { agencyId }, data: { status: "past_due", graceUntil } });
      return graceUntil;
    });
    if (!grace) return;
    await asSystem(agencyId, () =>
      this.tenant.tx((tx) =>
        this.notifications.notify(
          tx,
          { can: { area: "settings", level: "edit" } },
          {
            kind: "billing",
            title: "A payment for the plan failed",
            body: `Pay it in Settings → Plan by ${day(grace)} to keep working without a break.`,
            link: "/app/settings/plan",
          },
        ),
      ),
    );
  }

  async cancelled(agencyId: string) {
    await asPlatform(this.prisma.client, (tx) => tx.subscription.updateMany({ where: { agencyId }, data: { status: "cancelled" } }));
  }

  // ─── Webhooks ───────────────────────────────────────────────────────

  async razorpay(raw: Buffer | undefined, signature: string | undefined, body: RazorpayEvent) {
    const secret = this.env.RAZORPAY_BILLING_WEBHOOK_SECRET;
    if (!secret) throw new ConflictException("Billing webhooks are not switched on.");
    if (!raw || !razorpaySigned(raw, signature, secret)) throw new ForbiddenException("Wrong signature.");
    const sub = body.payload?.subscription?.entity;
    const agencyId = sub?.notes?.agencyId;
    if (!sub?.id || !agencyId) return { ignored: body.event };
    if (body.event === "subscription.charged") {
      const paymentRef = body.payload?.payment?.entity?.id ?? `${sub.id}:${sub.current_start}`;
      const start = fromUnix(sub.current_start) ?? new Date();
      await this.paid({
        agencyId,
        planKey: sub.notes?.planKey ?? "",
        currency: "INR",
        provider: "razorpay",
        ref: sub.id,
        paymentRef,
        periodStart: start,
        periodEnd: fromUnix(sub.current_end) ?? addMonth(start),
      });
      return { done: body.event };
    }
    if (body.event === "subscription.pending" || body.event === "subscription.halted") {
      await this.failed(agencyId);
      return { done: body.event };
    }
    if (body.event === "subscription.cancelled" || body.event === "subscription.completed") {
      await this.cancelled(agencyId);
      return { done: body.event };
    }
    return { ignored: body.event };
  }

  async stripe(raw: Buffer | undefined, signature: string | undefined, body: StripeEvent) {
    const secret = this.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new ConflictException("Billing webhooks are not switched on.");
    if (!raw || !stripeSigned(raw, signature, secret)) throw new ForbiddenException("Wrong signature.");
    const o = body.data?.object ?? {};
    // Stripe puts the subscription's metadata on the invoice in different places across versions.
    const meta = ((o.subscription_details as { metadata?: Record<string, string> } | undefined)?.metadata ??
      (o.parent as { subscription_details?: { metadata?: Record<string, string> } } | undefined)?.subscription_details?.metadata ??
      (o.metadata as Record<string, string> | undefined) ??
      {}) as Record<string, string>;
    const agencyId = meta.agencyId;
    if (!agencyId) return { ignored: body.type };
    if (body.type === "invoice.paid") {
      const line = (o.lines as { data?: { period?: { start?: number; end?: number } }[] } | undefined)?.data?.[0];
      const start = fromUnix(line?.period?.start) ?? new Date();
      await this.paid({
        agencyId,
        planKey: meta.planKey ?? "",
        currency: "USD",
        provider: "stripe",
        ref: String(o.subscription ?? ""),
        paymentRef: String(o.id),
        periodStart: start,
        periodEnd: fromUnix(line?.period?.end) ?? addMonth(start),
      });
      return { done: body.type };
    }
    if (body.type === "invoice.payment_failed") {
      await this.failed(agencyId);
      return { done: body.type };
    }
    if (body.type === "customer.subscription.deleted") {
      await this.cancelled(agencyId);
      return { done: body.type };
    }
    return { ignored: body.type };
  }

  // ─── Invoices ───────────────────────────────────────────────────────

  /** Every agency's invoices, for the platform console. */
  async all(): Promise<PlatformInvoiceRow[]> {
    const [rows, agencies] = await asPlatform(this.prisma.client, (tx) =>
      Promise.all([
        tx.platformInvoice.findMany({ orderBy: [{ issuedOn: "desc" }, { createdAt: "desc" }], take: 500 }),
        tx.agency.findMany({ select: { id: true, name: true } }),
      ]),
    );
    const names = new Map(agencies.map((a) => [a.id, a.name]));
    return rows.map((r) => invoiceRow(r, names.get(r.agencyId) ?? ""));
  }
}
