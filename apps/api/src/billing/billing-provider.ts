import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { PlanCurrency } from "@gm/shared";

/**
 * How agencies pay us for their plans (P6-04, ADR 0011): our own Razorpay account's subscriptions in rupees, Stripe
 * Checkout in dollars for agencies abroad; or an outbox that takes every payment at once (development, tests, and until
 * our accounts are set up).
 */
export interface SubscribeInput {
  agencyId: string;
  agencyName: string;
  email: string;
  plan: { key: string; name: string };
  currency: PlanCurrency;
  /** What is charged each month, tax included, in whole rupees or dollars. */
  charge: number;
  /** Where the payer comes back to. */
  returnUrl: string;
}

export interface BillingProvider {
  readonly kind: "outbox" | "live";
  /** The currencies this server can take payment in. */
  currencies(): PlanCurrency[];
  /** Starts the agency's subscription: a page to pay on, or (outbox) paid at once. */
  subscribe(input: SubscribeInput): Promise<{ provider: "outbox" | "razorpay" | "stripe"; ref: string; payUrl: string | null; paidNow: boolean }>;
  /** Stops the earlier subscription when the agency changes plan. */
  cancel(provider: string, ref: string): Promise<void>;
}

export const BILLING_PROVIDER = Symbol("BILLING_PROVIDER");

/** A refusal that trying again will not change. */
export class PermanentBillingError extends Error {}

async function call<T>(url: string, init: RequestInit & { label: string }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    throw new Error(`${init.label} could not be reached: ${e instanceof Error ? e.message : String(e)}`);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { description?: string; message?: string } } & T;
  if (res.ok) return data;
  const message = `${init.label}: ${data.error?.description ?? data.error?.message ?? `answered ${res.status}`}`;
  if (res.status === 429 || res.status >= 500) throw new Error(message);
  throw new PermanentBillingError(message);
}

/** Stripe's form encoding, with nested keys in brackets. */
function form(o: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) return [];
    if (typeof v === "object") return form(v as Record<string, unknown>, key);
    return [`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`];
  });
}

export class LiveBillingProvider implements BillingProvider {
  readonly kind = "live" as const;
  constructor(
    private readonly keys: {
      razorpayUrl: string;
      razorpayKeyId?: string;
      razorpayKeySecret?: string;
      stripeUrl: string;
      stripeSecret?: string;
    },
  ) {}

  currencies(): PlanCurrency[] {
    return [...(this.keys.razorpayKeyId && this.keys.razorpayKeySecret ? (["INR"] as const) : []), ...(this.keys.stripeSecret ? (["USD"] as const) : [])];
  }

  private razorpay<T>(method: "GET" | "POST", path: string, body?: unknown) {
    const auth = Buffer.from(`${this.keys.razorpayKeyId}:${this.keys.razorpayKeySecret}`).toString("base64");
    return call<T>(`${this.keys.razorpayUrl}/${path}`, {
      label: "Razorpay",
      method,
      headers: { Authorization: `Basic ${auth}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private stripe<T>(method: "POST" | "DELETE", path: string, body?: Record<string, unknown>) {
    return call<T>(`${this.keys.stripeUrl}/${path}`, {
      label: "Stripe",
      method,
      headers: { Authorization: `Bearer ${this.keys.stripeSecret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: body ? form(body).join("&") : undefined,
    });
  }

  async subscribe(i: SubscribeInput) {
    if (!this.currencies().includes(i.currency)) throw new PermanentBillingError(`Paying in ${i.currency} is not switched on yet.`);
    const notes = { agencyId: i.agencyId, planKey: i.plan.key };
    if (i.currency === "INR") {
      // A Razorpay plan for this price, then the agency's subscription to it; Razorpay's page takes the first payment.
      const plan = await this.razorpay<{ id: string }>("POST", "plans", {
        period: "monthly",
        interval: 1,
        item: { name: i.plan.name, amount: Math.round(i.charge * 100), currency: "INR", description: `${i.plan.name}, a month, GST included` },
        notes,
      });
      const sub = await this.razorpay<{ id: string; short_url: string }>("POST", "subscriptions", {
        plan_id: plan.id,
        total_count: 120,
        customer_notify: 1,
        notes,
      });
      return { provider: "razorpay" as const, ref: sub.id, payUrl: sub.short_url, paidNow: false };
    }
    const session = await this.stripe<{ id: string; url: string }>("POST", "checkout/sessions", {
      mode: "subscription",
      client_reference_id: i.agencyId,
      customer_email: i.email,
      success_url: i.returnUrl,
      cancel_url: i.returnUrl,
      line_items: {
        0: {
          quantity: 1,
          price_data: { currency: "usd", unit_amount: Math.round(i.charge * 100), recurring: { interval: "month" }, product_data: { name: i.plan.name } },
        },
      },
      metadata: notes,
      subscription_data: { metadata: notes },
    });
    return { provider: "stripe" as const, ref: session.id, payUrl: session.url, paidNow: false };
  }

  async cancel(provider: string, ref: string) {
    if (provider === "razorpay" && ref.startsWith("sub_")) await this.razorpay("POST", `subscriptions/${ref}/cancel`, { cancel_at_cycle_end: 0 });
    if (provider === "stripe" && ref.startsWith("sub_")) await this.stripe("DELETE", `subscriptions/${ref}`);
  }
}

export class OutboxBillingProvider implements BillingProvider {
  readonly kind = "outbox" as const;
  readonly subscribed: SubscribeInput[] = [];

  currencies(): PlanCurrency[] {
    return ["INR", "USD"];
  }

  async subscribe(i: SubscribeInput) {
    this.subscribed.push(i);
    return { provider: "outbox" as const, ref: `outbox-${randomUUID()}`, payUrl: null, paidNow: true };
  }

  async cancel() {}
}

// ─── Webhook signatures ──────────────────────────────────────────────

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Razorpay signs the raw body with the webhook's secret. */
export function razorpaySigned(raw: Buffer, signature: string | undefined, secret: string) {
  return !!signature && same(createHmac("sha256", secret).update(raw).digest("hex"), signature);
}

/** Stripe signs "<timestamp>.<raw body>"; a signature older than five minutes is refused. */
export function stripeSigned(raw: Buffer, header: string | undefined, secret: string, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300 || !parts.v1) return false;
  return same(
    createHmac("sha256", secret)
      .update(`${t}.${raw.toString("utf8")}`)
      .digest("hex"),
    parts.v1,
  );
}
