// Billing with our real providers (P6-04), against recorded answers: rupees through our Razorpay subscriptions and
// dollars through Stripe Checkout; the plan starts when the signed webhook says the payment came in, with our invoice,
// once however often the webhook comes; a failed payment opens the grace period, after which the workspace is read-only;
// a new subscription stops the one before it.
import { createHmac } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ChoosePlanResult, Me, PlanPage, PlatformSettings } from "@gm/shared";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let zara: Agent; // owner of Zen Studio
let anitha: Agent; // the platform's own team on this server
let zen: string;
const RZP = "rzp-webhook-secret";
const STRIPE = "whsec_test_secret";
const calls: { url: string; method: string; body: string }[] = [];
const now = () => Math.floor(Date.now() / 1000);
const anon = () => request(t.app.getHttpServer());
const me = async () => ((await zara.get("/me").expect(200)).body as Me).entitlements!;

/** Razorpay's and Stripe's answers; anything else goes out as usual. */
function stubProviders() {
  const real = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    if (!url.startsWith("https://api.razorpay.com/") && !url.startsWith("https://api.stripe.com/")) return real(input, init);
    calls.push({ url, method: init.method ?? "GET", body: String(init.body ?? "") });
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/v1/plans")) return json({ id: "plan_rzp_1" });
    if (url.endsWith("/v1/subscriptions")) return json({ id: "sub_rzp_1", short_url: "https://rzp.io/i/pay-growth" });
    if (url.endsWith("/cancel")) return json({ id: "sub_rzp_1", status: "cancelled" });
    if (url.endsWith("/v1/checkout/sessions")) return json({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    if (url.includes("/v1/subscriptions/")) return json({ id: "sub_str_1", status: "canceled" });
    return new Response("{}", { status: 404 });
  });
}

const razorpay = (body: object, secret = RZP) => {
  const raw = JSON.stringify(body);
  return anon()
    .post("/webhooks/billing/razorpay")
    .set("Content-Type", "application/json")
    .set("X-Razorpay-Signature", createHmac("sha256", secret).update(raw).digest("hex"))
    .send(raw);
};
const stripe = (body: object, at = now()) => {
  const raw = JSON.stringify(body);
  return anon()
    .post("/webhooks/billing/stripe")
    .set("Content-Type", "application/json")
    .set("Stripe-Signature", `t=${at},v1=${createHmac("sha256", STRIPE).update(`${at}.${raw}`).digest("hex")}`)
    .send(raw);
};
const charged = (payment: string) => ({
  event: "subscription.charged",
  payload: {
    subscription: { entity: { id: "sub_rzp_1", notes: { agencyId: zen, planKey: "growth" }, current_start: now(), current_end: now() + 30 * 86_400 } },
    payment: { entity: { id: payment } },
  },
});

beforeAll(async () => {
  t = await startSeededApp({
    BILLING_PROVIDER: "live",
    RAZORPAY_BILLING_KEY_ID: "rzp_test_key",
    RAZORPAY_BILLING_KEY_SECRET: "rzp_test_secret",
    RAZORPAY_BILLING_WEBHOOK_SECRET: RZP,
    STRIPE_SECRET_KEY: "sk_test_key",
    STRIPE_WEBHOOK_SECRET: STRIPE,
    PLATFORM_ADMIN_EMAILS: "anitha@geniemagnet.test",
  });
  [zara, anitha] = await Promise.all(["zara@zenstudio.test", "anitha@geniemagnet.test"].map((e) => t.signInAs(e)));
  [{ agency_id: zen }] = (await t.sql(`SELECT m.agency_id FROM memberships m JOIN users u ON u.id = m.user_id WHERE u.email = 'zara@zenstudio.test'`)) as {
    agency_id: string;
  }[];
  const settings = (await anitha.get("/platform/settings").expect(200)).body as PlatformSettings;
  await anitha
    .put("/platform/settings")
    .send({
      ...settings,
      plans: settings.plans.map((p) => (p.key === "growth" ? { ...p, priceInr: 4999 } : p.key === "enterprise" ? { ...p, priceUsd: 199 } : p)),
    })
    .expect(200);
  stubProviders();
}, 180_000);

afterAll(async () => {
  vi.unstubAllGlobals();
  await t?.stop();
}, 60_000);

describe("rupees, through our Razorpay subscriptions", () => {
  it("start the plan when the signed webhook says the payment came in, with our invoice — once", async () => {
    const chosen = (await zara.post("/plan/choose").send({ plan: "growth", currency: "INR" }).expect(200)).body as ChoosePlanResult;
    expect(chosen).toMatchObject({ payUrl: "https://rzp.io/i/pay-growth", billing: { provider: "live", currencies: ["INR", "USD"] } });
    expect(chosen.entitlements.plan).toBeNull(); // nothing changes until it is paid
    const plan = JSON.parse(calls.find((c) => c.url.endsWith("/v1/plans"))!.body) as { item: { amount: number }; notes: Record<string, string> };
    expect(plan).toMatchObject({ item: { amount: 589_900 }, notes: { agencyId: zen, planKey: "growth" } }); // ₹4,999 and 18% GST, in paise

    await razorpay(charged("pay_1"), "not-the-secret").expect(403);
    await anon().post("/webhooks/billing/razorpay").send(charged("pay_1")).expect(403);
    await razorpay(charged("pay_1")).expect(200);
    await razorpay(charged("pay_1")).expect(200); // Razorpay may send it twice
    expect(await me()).toMatchObject({ plan: { key: "growth" }, status: "active", readOnly: false });
    const page = (await zara.get("/plan").expect(200)).body as PlanPage;
    expect(page.invoices).toHaveLength(1);
    expect(page.invoices[0]).toMatchObject({ provider: "razorpay", amount: 4999, igst: 900, total: 5899 });
  });

  it("open the grace period when a payment fails, after which the workspace is read-only until it is paid", async () => {
    await razorpay({
      event: "subscription.halted",
      payload: { subscription: { entity: { id: "sub_rzp_1", notes: { agencyId: zen, planKey: "growth" } } } },
    }).expect(200);
    const ent = await me();
    expect(ent).toMatchObject({ status: "past_due", readOnly: false });
    const days = (new Date(ent.graceUntil!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    const n = (await zara.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.find((x) => x.kind === "billing")!.title).toBe("A payment for the plan failed");

    await t.sql(`UPDATE subscriptions SET grace_until = now() - interval '1 minute' WHERE agency_id = '${zen}'`);
    expect(
      (
        await zara
          .post("/clients")
          .send({ name: "Late Client", code: "LTC", contacts: [{ name: "A", phone: "+91 98400 77002", approver: true }] })
          .expect(403)
      ).body.message,
    ).toMatch(/^A payment is still due after the grace period/);
    await razorpay(charged("pay_2")).expect(200);
    expect(await me()).toMatchObject({ status: "active", readOnly: false, graceUntil: null });
  });
});

describe("dollars, through Stripe Checkout", () => {
  it("start the plan on the paid invoice, with ours (no GST on an export), and stop the earlier subscription", async () => {
    const chosen = (await zara.post("/plan/choose").send({ plan: "enterprise", currency: "USD" }).expect(200)).body as ChoosePlanResult;
    expect(chosen.payUrl).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
    const session = decodeURIComponent(calls.find((c) => c.url.endsWith("/v1/checkout/sessions"))!.body);
    expect(session).toContain("line_items[0][price_data][unit_amount]=19900");
    expect(session).toContain(`client_reference_id=${zen}`);

    const paid = {
      type: "invoice.paid",
      data: {
        object: {
          id: "in_test_1",
          subscription: "sub_str_1",
          subscription_details: { metadata: { agencyId: zen, planKey: "enterprise" } },
          lines: { data: [{ period: { start: now(), end: now() + 30 * 86_400 } }] },
        },
      },
    };
    await stripe(paid, now() - 600).expect(403); // too old to trust
    await stripe(paid).expect(200);
    expect(await me()).toMatchObject({ plan: { key: "enterprise" }, status: "active" });
    const page = (await zara.get("/plan").expect(200)).body as PlanPage;
    expect(page.invoices[0]).toMatchObject({ provider: "stripe", currency: "USD", amount: 199, igst: 0, total: 199 });
    expect(calls.some((c) => c.url.endsWith("/v1/subscriptions/sub_rzp_1/cancel"))).toBe(true);
  });
});
