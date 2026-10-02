// Payments (P3-10): an agency's own Razorpay, payment links on issued invoices, and paid by Razorpay's signed notice.
import { createHmac } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Invoice, PaymentSettings } from "@gm/shared";
import { JobRunner } from "../jobs/job-runner.js";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";
import { type OutboxPaymentsProvider, PAYMENTS_PROVIDER } from "./provider.js";

let t: SeededApp;
let jana: Agent; // owner: settings
let ashwin: Agent; // manager: invoices edit
let anitha: Agent; // finance: issues invoices
let divya: Agent; // editor
let outbox: OutboxPaymentsProvider;
let runner: JobRunner;
let settings: PaymentSettings;
let agreementId: string;
let clientId: string;
let invoice: Invoice;
const M = new Date().toISOString().slice(0, 7);
const anon = () => request(t.app.getHttpServer());
const runJobs = () => runner.tick(new Date(Date.now() + 60_000));
const notice = (body: object, secret = settings.connection!.webhookSecret) => {
  const raw = JSON.stringify(body);
  return anon()
    .post(new URL(settings.connection!.webhookUrl).pathname)
    .set("Content-Type", "application/json")
    .set("X-Razorpay-Signature", createHmac("sha256", secret).update(raw).digest("hex"))
    .send(raw);
};
const paid = (linkId: string, paymentId: string, rupees: number) => ({
  event: "payment_link.paid",
  payload: {
    payment_link: { entity: { id: linkId, status: "paid" } },
    payment: { entity: { id: paymentId, amount: rupees * 100, method: "upi", created_at: Math.floor(Date.now() / 1000) } },
  },
});

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, anitha, divya] = await Promise.all(["jana", "ashwin", "anitha", "divya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  outbox = t.app.get<OutboxPaymentsProvider>(PAYMENTS_PROVIDER);
  runner = t.app.get(JobRunner);
  const c = (
    await ashwin
      .post("/clients")
      .send({ name: "Karur Linens", code: "KRL", contacts: [{ name: "Mani", phone: "+91 98400 88001", approver: true }] })
      .expect(201)
  ).body as {
    id: string;
    contacts: { id: string }[];
  };
  clientId = c.id;
  agreementId = (
    await ashwin
      .post(`/clients/${clientId}/agreements`)
      .send({
        title: "Karur · Reels",
        startDate: `${M}-01`,
        months: 6,
        monthlyFee: 30000,
        billing: "Monthly advance",
        revisionsPerDeliverable: 2,
        shootDays: 1,
        deliverables: [{ name: "Reels", perMonth: 4, kind: "video" }],
        platforms: ["instagram"],
      })
      .expect(201)
  ).body.id;
  await jana.post(`/agreements/${agreementId}/sign-off`).expect(200);
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("connecting Razorpay", () => {
  it("is for people who may change settings; keys Razorpay refuses show why", async () => {
    await divya.put("/payments/connection").send({ keyId: "rzp_test_ABCDEF123", keySecret: "secret-1234567890" }).expect(403);
    await jana.put("/payments/connection").send({ keyId: "not-a-key", keySecret: "secret-1234567890" }).expect(400);
    settings = (await jana.put("/payments/connection").send({ keyId: "rzp_test_ABCDEF123", keySecret: "bad-secret-12345" }).expect(200)).body;
    expect(settings.connection).toMatchObject({ status: "error", lastError: "Razorpay did not accept these keys.", mode: "test" });
    settings = (await jana.put("/payments/connection").send({ keyId: "rzp_test_ABCDEF123", keySecret: "the-real-secret-9876" }).expect(200)).body;
    expect(settings.connection).toMatchObject({ status: "connected", secretHint: "…9876" });
    expect(settings.connection!.webhookUrl).toMatch(/\/webhooks\/razorpay\/[0-9a-f-]{36}$/);
    expect(settings.connection!.webhookSecret.length).toBeGreaterThan(20);
    const [row] = await t.sql<{ key_secret: string }>(`SELECT key_secret FROM payment_connections`);
    expect(row!.key_secret).not.toContain("the-real-secret");
  });
});

describe("an issued invoice", () => {
  it("gets a payment link by itself, which the client sees in their portal", async () => {
    const draft = (await ashwin.post(`/agreements/${agreementId}/invoices`).send({ period: M }).expect(201)).body as Invoice;
    invoice = (await anitha.post(`/invoices/${draft.id}/issue`).send({}).expect(200)).body;
    await runJobs();
    invoice = (await anitha.get(`/invoices/${invoice.id}`).expect(200)).body;
    expect(invoice.payLink).toMatchObject({ status: "created", url: expect.stringMatching(/^https:\/\/rzp\.io\//) });
    expect(outbox.links.at(-1)).toMatchObject({
      amount: invoice.total,
      reference: invoice.number,
      customer: { name: "Karur Linens", contact: "+919840088001" },
    });

    const contacts = (await ashwin.get(`/clients/${clientId}/portal-links`).expect(200)).body as { contactId: string }[];
    const link = ((await ashwin.post(`/clients/${clientId}/contacts/${contacts[0]!.contactId}/portal-link`).expect(201)).body as { link: string }).link;
    const rows = (
      await anon()
        .get(`/portal/${link.split("/app/c/")[1]}/invoices`)
        .expect(200)
    ).body as { payUrl: string | null }[];
    expect(rows[0]!.payUrl).toBe(invoice.payLink!.url);
  });

  it("is marked paid by itself when Razorpay says so — once, however often it says it", async () => {
    await anon()
      .post(new URL(settings.connection!.webhookUrl).pathname)
      .set("Content-Type", "application/json")
      .send(paid("x", "y", 1))
      .expect(403);
    await notice(paid(outbox.links.at(-1)!.id, "pay_TEST1", invoice.total), "someone-elses-secret").expect(403);
    await notice(paid(outbox.links.at(-1)!.id, "pay_TEST1", invoice.total)).expect(200);
    await notice(paid(outbox.links.at(-1)!.id, "pay_TEST1", invoice.total)).expect(200);
    invoice = (await anitha.get(`/invoices/${invoice.id}`).expect(200)).body;
    expect(invoice).toMatchObject({ status: "paid", payLink: { status: "paid" }, paymentNote: "Paid online (upi, pay_TEST1)" });
    expect(invoice.payments).toEqual([expect.objectContaining({ amount: invoice.total, method: "upi", reference: "pay_TEST1" })]);
    const n = (await anitha.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.filter((x) => x.kind === "invoice_paid").map((x) => x.title)).toEqual([`Paid online: ${invoice.number} · Karur Linens`]);
  });

  it("is not marked paid for part of the amount, and its link is switched off when it is cancelled", async () => {
    const next = new Date(`${M}-01T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const draft = (
      await ashwin
        .post(`/agreements/${agreementId}/invoices`)
        .send({ period: next.toISOString().slice(0, 7) })
        .expect(201)
    ).body as Invoice;
    let second = (await anitha.post(`/invoices/${draft.id}/issue`).send({}).expect(200)).body as Invoice;
    await runJobs();
    const linkId = outbox.links.at(-1)!.id;
    await notice(paid(linkId, "pay_PART", 1000)).expect(200);
    second = (await anitha.get(`/invoices/${second.id}`).expect(200)).body;
    expect(second.status).toBe("sent");
    expect(second.payments.map((p) => p.amount)).toEqual([1000]);

    const third = (
      await ashwin
        .post("/invoices")
        .send({ clientId, lines: [{ description: "Extra shoot day", sac: "998389", quantity: 1, rate: 8000, taxRate: 18 }] })
        .expect(201)
    ).body as Invoice;
    await anitha.post(`/invoices/${third.id}/issue`).send({}).expect(200);
    await runJobs();
    await anitha.post(`/invoices/${third.id}/cancel`).send({ reason: "Raised by mistake" }).expect(200);
    await runJobs();
    expect(outbox.links.at(-1)).toMatchObject({ cancelled: true });
    expect(((await anitha.get(`/invoices/${third.id}`).expect(200)).body as Invoice).payLink).toMatchObject({ status: "cancelled" });
  });

  it("belongs to its agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get("/payments").expect(200)).body).toMatchObject({ connection: null });
    await zara.post(`/invoices/${invoice.id}/pay-link`).expect(404);
  });
});
