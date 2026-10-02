/** How messages reach WhatsApp (P3-07): the Cloud API with each agency's own number, or an outbox for development. */
export interface WhatsAppNumber {
  phoneNumberId: string;
  accessToken: string;
}

export interface WhatsAppProvider {
  readonly kind: "cloud" | "outbox";
  /** The number's display phone and verified name — proves the details work. */
  check(n: WhatsAppNumber): Promise<{ displayPhone: string; verifiedName: string | null }>;
  /** An approved template with its values in order, and quick-reply payloads for its buttons in order. */
  sendTemplate(n: WhatsAppNumber, to: string, template: { name: string; language: string }, values: string[], buttons: string[]): Promise<{ id: string }>;
  /** Free text — only within 24 hours of the person's last message to the number (WhatsApp's rule). */
  sendText(n: WhatsAppNumber, to: string, text: string): Promise<{ id: string }>;
}

export const WHATSAPP_PROVIDER = Symbol("WHATSAPP_PROVIDER");

/** A refusal that trying again will not change (a wrong token, an unknown template): the message fails at once. */
export class PermanentWhatsAppError extends Error {}

/** WhatsApp Cloud API (graph.facebook.com), with the agency's own phone number ID and token. */
export class CloudApiProvider implements WhatsAppProvider {
  readonly kind = "cloud" as const;
  constructor(private readonly baseUrl: string) {}

  private async call<T>(n: WhatsAppNumber, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/${path}`, {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Bearer ${n.accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new Error(`WhatsApp could not be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
    if (res.ok) return data;
    const message = data.error?.message ?? `WhatsApp answered ${res.status}`;
    // Too many messages or WhatsApp's own trouble: try again later. Anything else will not get better by itself.
    if (res.status === 429 || res.status >= 500) throw new Error(message);
    throw new PermanentWhatsAppError(message);
  }

  async check(n: WhatsAppNumber) {
    const r = await this.call<{ display_phone_number?: string; verified_name?: string }>(n, `${n.phoneNumberId}?fields=display_phone_number,verified_name`);
    return { displayPhone: r.display_phone_number ?? "", verifiedName: r.verified_name ?? null };
  }

  async sendTemplate(n: WhatsAppNumber, to: string, template: { name: string; language: string }, values: string[], buttons: string[]) {
    const components: unknown[] = [];
    if (values.length) components.push({ type: "body", parameters: values.map((text) => ({ type: "text", text })) });
    buttons.forEach((payload, index) =>
      components.push({ type: "button", sub_type: "quick_reply", index: String(index), parameters: [{ type: "payload", payload }] }),
    );
    const r = await this.call<{ messages?: { id: string }[] }>(n, `${n.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template.name, language: { code: template.language }, components },
    });
    return { id: r.messages?.[0]?.id ?? "" };
  }

  async sendText(n: WhatsAppNumber, to: string, text: string) {
    const r = await this.call<{ messages?: { id: string }[] }>(n, `${n.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    });
    return { id: r.messages?.[0]?.id ?? "" };
  }
}

export interface OutboxMessage {
  to: string;
  template?: { name: string; language: string };
  values?: string[];
  buttons?: string[];
  text?: string;
  id: string;
}

/** Keeps messages in memory instead of sending them: development, tests, and servers without real WhatsApp use. */
export class OutboxProvider implements WhatsAppProvider {
  readonly kind = "outbox" as const;
  readonly sent: OutboxMessage[] = [];
  private n = 0;

  async check(n: WhatsAppNumber) {
    if (n.accessToken.startsWith("bad")) throw new PermanentWhatsAppError("Invalid OAuth access token.");
    return { displayPhone: "+91 90000 00000", verifiedName: "Outbox (nothing is sent)" };
  }

  async sendTemplate(_n: WhatsAppNumber, to: string, template: { name: string; language: string }, values: string[], buttons: string[]) {
    if (template.name.startsWith("missing")) throw new PermanentWhatsAppError(`Template name does not exist in the translation (${template.name})`);
    const id = `wamid.outbox.${++this.n}`;
    this.sent.push({ to, template, values, buttons, id });
    return { id };
  }

  async sendText(_n: WhatsAppNumber, to: string, text: string) {
    const id = `wamid.outbox.${++this.n}`;
    this.sent.push({ to, text, id });
    return { id };
  }
}
