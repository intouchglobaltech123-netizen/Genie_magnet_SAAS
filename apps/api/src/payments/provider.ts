/** How payment links are made (P3-10): the agency's own Razorpay account, or an outbox for development and tests. */
export interface PaymentKeys {
  keyId: string;
  keySecret: string;
}

export interface LinkInput {
  /** Rupees. */
  amount: number;
  /** Shown to the payer and unique per link, e.g. the invoice number. */
  reference: string;
  description: string;
  customer: { name: string; contact?: string; email?: string };
  notes: Record<string, string>;
}

export interface PaymentsProvider {
  readonly kind: "razorpay" | "outbox";
  /** Proves the keys work. */
  check(k: PaymentKeys): Promise<void>;
  createLink(k: PaymentKeys, input: LinkInput): Promise<{ id: string; url: string }>;
  cancelLink(k: PaymentKeys, id: string): Promise<void>;
}

export const PAYMENTS_PROVIDER = Symbol("PAYMENTS_PROVIDER");

/** A refusal that trying again will not change (wrong keys, a bad request). */
export class PermanentPaymentError extends Error {}

/** Razorpay Payment Links, with the agency's own keys. */
export class RazorpayProvider implements PaymentsProvider {
  readonly kind = "razorpay" as const;
  constructor(private readonly baseUrl: string) {}

  private async call<T>(k: PaymentKeys, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/${path}`, {
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${k.keyId}:${k.keySecret}`).toString("base64")}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new Error(`Razorpay could not be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
    const data = (await res.json().catch(() => ({}))) as { error?: { description?: string } } & T;
    if (res.ok) return data;
    const message = res.status === 401 ? "Razorpay did not accept these keys." : (data.error?.description ?? `Razorpay answered ${res.status}`);
    if (res.status === 429 || res.status >= 500) throw new Error(message);
    throw new PermanentPaymentError(message);
  }

  async check(k: PaymentKeys) {
    await this.call(k, "GET", "payment_links?count=1");
  }

  async createLink(k: PaymentKeys, input: LinkInput) {
    const r = await this.call<{ id: string; short_url: string }>(k, "POST", "payment_links", {
      amount: input.amount * 100,
      currency: "INR",
      accept_partial: false,
      reference_id: input.reference.slice(0, 40),
      description: input.description.slice(0, 2048),
      customer: input.customer,
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: input.notes,
    });
    return { id: r.id, url: r.short_url };
  }

  async cancelLink(k: PaymentKeys, id: string) {
    await this.call(k, "POST", `payment_links/${id}/cancel`);
  }
}

/** Pretend links kept in memory: development, tests, and servers that must not take real money. */
export class OutboxPaymentsProvider implements PaymentsProvider {
  readonly kind = "outbox" as const;
  readonly links: (LinkInput & { id: string; url: string; cancelled?: boolean })[] = [];
  private n = 0;

  async check(k: PaymentKeys) {
    if (k.keySecret.startsWith("bad")) throw new PermanentPaymentError("Razorpay did not accept these keys.");
  }

  async createLink(_k: PaymentKeys, input: LinkInput) {
    const n = ++this.n;
    const link = { ...input, id: `plink_outbox${n}`, url: `https://rzp.io/i/outbox${n}` };
    this.links.push(link);
    return { id: link.id, url: link.url };
  }

  async cancelLink(_k: PaymentKeys, id: string) {
    const link = this.links.find((l) => l.id === id);
    if (link) link.cancelled = true;
  }
}
