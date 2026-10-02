// Phase 3 exit gate (P3-14): one client's month through their portal, WhatsApp and online payment, as one story: the
// client opens their portal, picks topics and approves a script; gets a WhatsApp approval request for the video and
// asks for changes, which appear on the video; the month's report is released and they are told on WhatsApp; an
// invoice is paid through its payment link and marked paid by itself; and a person in another agency sees none of it.
import { createHmac } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PRODUCTION_SETTINGS, type Invoice, type MonthlyReport, type PaymentSettings, type WhatsAppSettings } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { JobRunner } from "../jobs/job-runner.js";
import { type OutboxPaymentsProvider, PAYMENTS_PROVIDER } from "../payments/provider.js";
import { draftInvoice } from "../test/draft-invoice.js";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";
import { type OutboxProvider, WHATSAPP_PROVIDER } from "../whatsapp/provider.js";

let t: SeededApp;
let jana: Agent; // owner: settings, signs off agreements
let ashwin: Agent; // manager: clients and reports
let karthik: Agent; // team leader: topics, scripts, quality check
let divya: Agent; // editor
let anitha: Agent; // finance: issues invoices
let whatsapp: OutboxProvider;
let payments: OutboxPaymentsProvider;
let runner: JobRunner;
let wa: WhatsAppSettings;
let rzp: PaymentSettings;
let clientId: string;
let agreementId: string;
let contactId: string;
let token: string;
let contentId: string;
let videoId: string;
let reportId: string;
let invoice: Invoice;
const M = new Date().toISOString().slice(0, 7);
const PHONE = "919840055005";
const APP_SECRET = "gate-three-app-secret-0001";
const anon = () => request(t.app.getHttpServer());
const portal = (path = "") => `/portal/${token}${path}`;
/** Runs what is queued, a day from now (past any quiet hours). */
const runJobs = () => runner.tick(new Date(Date.now() + 86_400_000));
const toMeera = () => whatsapp.sent.filter((s) => s.to === PHONE);
/** The video's approval request (the script's has "the script for …" instead of the video's code). */
const videoRequest = () => toMeera().find((s) => s.template?.name === "approval_request" && s.values![1]!.startsWith("TJA-"));
const fromMeera = (message: object) => {
  const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: PHONE, ...message }] } }] }] });
  return anon()
    .post(new URL(wa.connection!.webhookUrl).pathname)
    .set("Content-Type", "application/json")
    .set("X-Hub-Signature-256", `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`)
    .send(body);
};

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, karthik, divya, anitha] = await Promise.all(["jana", "ashwin", "karthik", "divya", "anitha"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  whatsapp = t.app.get<OutboxProvider>(WHATSAPP_PROVIDER);
  payments = t.app.get<OutboxPaymentsProvider>(PAYMENTS_PROVIDER);
  runner = t.app.get(JobRunner);
  const c = (
    await ashwin
      .post("/clients")
      .send({ name: "Thanjavur Arts", code: "TJA", contacts: [{ name: "Meera Iyer", phone: "+91 98400 55005", approver: true }] })
      .expect(201)
  ).body as { id: string; contacts: { id: string }[] };
  clientId = c.id;
  contactId = c.contacts[0]!.id;
  agreementId = (
    await ashwin
      .post(`/clients/${clientId}/agreements`)
      .send({
        title: "Thanjavur Arts · Reels",
        startDate: `${M}-01`,
        months: 12,
        monthlyFee: 40000,
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

describe("Phase 3: a client's month through their portal, WhatsApp and online payment", () => {
  it("0. the agency connects its own WhatsApp number and Razorpay account, and the client agrees to WhatsApp", async () => {
    wa = (
      await jana
        .put("/whatsapp/connection")
        .send({ phoneNumberId: "1098765400001", accessToken: "EAAG-gate-three-permanent-token-0001", appSecret: APP_SECRET })
        .expect(200)
    ).body;
    expect(wa.connection).toMatchObject({ status: "connected", hasAppSecret: true });
    for (const purpose of ["approval_request", "report_ready", "invoice_issued"])
      await jana.put("/whatsapp/templates").send({ purpose, name: purpose }).expect(200);
    rzp = (await jana.put("/payments/connection").send({ keyId: "rzp_test_GATE3KEY01", keySecret: "gate-three-secret-0001" }).expect(200)).body;
    expect(rzp.connection).toMatchObject({ status: "connected", mode: "test" });
    await ashwin.put(`/clients/${clientId}/contacts/${contactId}/whatsapp`).send({ optIn: true, source: "Agreed when signing" }).expect(200);
  });

  it("1. the client opens their portal from their own private link, in the agency's name", async () => {
    const link = ((await ashwin.post(`/clients/${clientId}/contacts/${contactId}/portal-link`).expect(201)).body as { link: string }).link;
    token = link.split("/app/c/")[1]!;
    expect((await anon().get(portal()).expect(200)).body).toMatchObject({
      agency: { name: "Genie Magnet" },
      client: { name: "Thanjavur Arts" },
      contact: { name: "Meera Iyer" },
    });
  });

  it("2. picks the month's topics in the portal; the team is told", async () => {
    const ids: string[] = [];
    for (const title of ["Gold leaf, step by step", "Inside a Tanjore studio"])
      ids.push((await karthik.post("/content").send({ clientId, title, pillar: "Craft", format: "Reel", month: M }).expect(201)).body.id);
    const [list] = (await karthik.put("/topic-lists").send({ clientId, month: M, needed: 1 }).expect(200)).body as { id: string }[];
    await karthik.post(`/topic-lists/${list!.id}/send`).expect(200);
    const [shown] = (await anon().get(portal("/topics")).expect(200)).body as { id: string; items: { id: string; title: string }[] }[];
    const pick = shown!.items.find((i) => i.title === "Gold leaf, step by step")!;
    await anon()
      .put(portal(`/topics/${pick.id}`))
      .send({ pick: "picked" })
      .expect(200);
    expect(
      (
        await anon()
          .post(portal(`/topic-lists/${list!.id}/done`))
          .expect(200)
      ).body.picked,
    ).toBe(1);
    const n = (await karthik.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.some((x) => x.kind === "client_portal" && x.title.startsWith("Thanjavur Arts picked 1 topic"))).toBe(true);
    await karthik.post(`/topic-lists/${list!.id}/confirm`).expect(200);
    contentId = pick.id;
  });

  it("3. approves its script in the portal, and it becomes a video", async () => {
    await karthik.post(`/content/${contentId}/research-done`).expect(200);
    await karthik
      .put(`/content/${contentId}/script`)
      .send({ hook: "Real gold, thinner than paper.", body: "Watch it settle.", cta: "Visit the studio", onScreen: "" })
      .expect(200);
    await karthik.post(`/content/${contentId}/script/send`).expect(200);
    const [s] = (await anon().get(portal("/scripts")).expect(200)).body as { contentId: string; script: { hook: string } }[];
    expect(s).toMatchObject({ contentId, script: { hook: "Real gold, thinner than paper." } });
    await anon()
      .post(portal(`/scripts/${contentId}/decision`))
      .send({ approved: true })
      .expect(200);
    const item = (await karthik.get(`/content/${contentId}`).expect(200)).body as { stage: string; video: { id: string } | null };
    expect(item.stage).toBe("ready");
    videoId = item.video!.id;
  });

  it("4. the finished video's approval request reaches the client on WhatsApp", async () => {
    await ashwin
      .patch(`/videos/${videoId}`)
      .send({ dueDate: `${M}-26`, editorId: seedUserId("divya@geniemagnet.test") })
      .expect(200);
    await divya.post(`/videos/${videoId}/move`).send({ to: "shot" }).expect(200);
    await divya.put(`/videos/${videoId}/protect`).send({ done: true }).expect(200);
    await divya.post(`/videos/${videoId}/move`).send({ to: "editing" }).expect(200);
    for (const step of DEFAULT_PRODUCTION_SETTINGS.editSteps) await divya.put(`/videos/${videoId}/edit-steps`).send({ step, done: true }).expect(200);
    await divya.post(`/videos/${videoId}/move`).send({ to: "internal_qc" }).expect(200);
    for (const q of DEFAULT_PRODUCTION_SETTINGS.qcChecks) await karthik.put(`/videos/${videoId}/qc`).send({ check: q.key, result: "pass" }).expect(200);
    await divya.post(`/videos/${videoId}/versions`).send({ link: "https://drive.example/tja-gold-v1" }).expect(201);
    await divya.post(`/videos/${videoId}/versions/send`).expect(200);
    await runJobs();
    // The script's request went out too, when the script was sent to the client.
    expect(toMeera().some((s) => s.values?.[1] === "the script for “Gold leaf, step by step”")).toBe(true);
    const sent = videoRequest()!;
    expect(sent.values![0]).toBe("Meera");
    expect(sent.values![1]).toMatch(/^TJA-\d{4}-01 “Gold leaf, step by step” \(v1\)$/);
    expect(sent.values![2]).toContain(`/app/c/`);
    expect(sent.buttons).toHaveLength(2);
  });

  it("5. the client asks for changes on WhatsApp, and their words appear on the video", async () => {
    const changes = videoRequest()!.buttons![1]!;
    await fromMeera({ id: "wamid.gate3.1", type: "button", button: { payload: changes, text: "Request changes" } }).expect(200);
    await runJobs();
    expect(toMeera().at(-1)!.text).toBe("Thank you. What would you like changed? Reply here and the team will see it.");
    await fromMeera({ id: "wamid.gate3.2", type: "text", text: { body: "Slow down the gold leaf part, please" } }).expect(200);

    const v = (await divya.get(`/videos/${videoId}`).expect(200)).body as { stage: string; versions: { comments: { author: string; text: string }[] }[] };
    expect(v.stage).toBe("revision");
    expect(v.versions[0]!.comments.map((c) => `${c.author}: ${c.text}`)).toEqual([
      "Meera Iyer: Asked for changes on WhatsApp",
      "Meera Iyer: Slow down the gold leaf part, please",
    ]);
    const n = (await divya.get("/notifications").expect(200)).body.items as { title: string }[];
    expect(n.some((x) => x.title.startsWith("Meera Iyer on WhatsApp about"))).toBe(true);
  });

  it("6. the month's report is released to the portal, and the client is told on WhatsApp", async () => {
    const r = (await ashwin.post("/reports").send({ clientId, month: M }).expect(201)).body as MonthlyReport;
    reportId = r.id;
    expect(r.data).toMatchObject({ promised: 4 });
    await ashwin.put(`/reports/${reportId}/note`).send({ note: "A good start: the gold leaf reel is nearly there." }).expect(200);
    await ashwin.post(`/reports/${reportId}/release`).expect(200);
    await runJobs();
    expect(toMeera().at(-1)).toMatchObject({ template: { name: "report_ready" } });
    const seen = (
      await anon()
        .get(portal(`/reports/${reportId}`))
        .expect(200)
    ).body as MonthlyReport;
    expect(seen).toMatchObject({ status: "released", note: "A good start: the gold leaf reel is nearly there." });
  });

  it("7. an invoice is issued with a payment link, paid online, and marked paid by itself", async () => {
    const draft = await draftInvoice<Invoice>(ashwin, agreementId, M); // drafted by itself on the billing day
    invoice = (await anitha.post(`/invoices/${draft.id}/issue`).send({}).expect(200)).body;
    await runJobs();
    invoice = (await anitha.get(`/invoices/${invoice.id}`).expect(200)).body;
    expect(invoice.payLink).toMatchObject({ status: "created" });
    expect(toMeera().at(-1)).toMatchObject({ template: { name: "invoice_issued" } });
    const [shown] = (await anon().get(portal("/invoices")).expect(200)).body as { number: string; payUrl: string | null }[];
    expect(shown).toMatchObject({ number: invoice.number, payUrl: invoice.payLink!.url });

    // Razorpay says the link was paid, signed with the agency's webhook secret.
    const body = JSON.stringify({
      event: "payment_link.paid",
      payload: {
        payment_link: { entity: { id: payments.links.at(-1)!.id, status: "paid" } },
        payment: { entity: { id: "pay_GATE3", amount: invoice.total * 100, method: "upi", created_at: Math.floor(Date.now() / 1000) } },
      },
    });
    await anon()
      .post(new URL(rzp.connection!.webhookUrl).pathname)
      .set("Content-Type", "application/json")
      .set("X-Razorpay-Signature", createHmac("sha256", rzp.connection!.webhookSecret).update(body).digest("hex"))
      .send(body)
      .expect(200);
    invoice = (await anitha.get(`/invoices/${invoice.id}`).expect(200)).body;
    expect(invoice).toMatchObject({ status: "paid", payLink: { status: "paid" } });
    expect(invoice.payments).toEqual([expect.objectContaining({ amount: invoice.total, reference: "pay_GATE3" })]);
  });

  it("8. everything the client did is in the audit log as theirs", async () => {
    const items = (await jana.get(`/audit?entity=content&entityId=${contentId}&limit=20`).expect(200)).body.items as { after: { byClient?: string } | null }[];
    expect(items.some((e) => e.after?.byClient === "Meera Iyer")).toBe(true);
    const video = (await jana.get(`/audit?entity=video&entityId=${videoId}&limit=20`).expect(200)).body.items as {
      action: string;
      after: { stage?: string; byClient?: string } | null;
    }[];
    expect(video.find((e) => e.action === "move" && e.after?.stage === "revision")?.after?.byClient).toBe("Meera Iyer");
  });

  it("9. a person in another agency sees none of it", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    await zara.get(`/clients/${clientId}`).expect(404);
    await zara.get(`/videos/${videoId}`).expect(404);
    await zara.get(`/reports/${reportId}`).expect(404);
    await zara.get(`/invoices/${invoice.id}`).expect(404);
    expect((await zara.get("/whatsapp/messages").expect(200)).body).toEqual([]);
    expect((await zara.get("/whatsapp").expect(200)).body).toMatchObject({ connection: null });
    expect((await zara.get("/payments").expect(200)).body).toMatchObject({ connection: null });
    expect((await zara.get(`/clients/${clientId}/platforms`).expect(200)).body).toEqual([]);
  });
});
