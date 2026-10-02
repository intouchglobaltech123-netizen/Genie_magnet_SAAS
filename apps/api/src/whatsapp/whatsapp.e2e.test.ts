// WhatsApp (P3-06 to P3-08): an agency's own number, templates, opt-in, sending as jobs, and what comes back.
import { createHmac } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PRODUCTION_SETTINGS, type WhatsAppMessageRow, type WhatsAppSettings } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { JobRunner } from "../jobs/job-runner.js";
import { draftInvoice } from "../test/draft-invoice.js";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";
import { type OutboxProvider, WHATSAPP_PROVIDER } from "./provider.js";
import { afterQuietHours } from "./whatsapp.service.js";

let t: SeededApp;
let jana: Agent; // owner: settings
let ashwin: Agent; // manager
let karthik: Agent; // team leader
let divya: Agent; // editor
let outbox: OutboxProvider;
let runner: JobRunner;
let clientId: string;
let approverId: string;
let videoId: string;
let settings: WhatsAppSettings;
const TOKEN = "EAAG-a-long-permanent-access-token-1234";
const APP_SECRET = "an-app-secret-from-meta-0123";
const PHONE = "919840066001";
const M = new Date().toISOString().slice(0, 7);
const anon = () => request(t.app.getHttpServer());
/** Runs the queued jobs a day from now (outside any quiet hours). */
const runJobs = () => runner.tick(new Date(Date.now() + 86_400_000));
const sign = (body: string, secret = APP_SECRET) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
const webhook = (payload: object, secret?: string) => {
  const body = JSON.stringify(payload);
  return anon()
    .post(new URL(settings.connection!.webhookUrl).pathname)
    .set("Content-Type", "application/json")
    .set("X-Hub-Signature-256", sign(body, secret))
    .send(body);
};
const messages = async () => (await ashwin.get(`/whatsapp/messages?clientId=${clientId}`).expect(200)).body as WhatsAppMessageRow[];

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, karthik, divya] = await Promise.all(["jana", "ashwin", "karthik", "divya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  outbox = t.app.get<OutboxProvider>(WHATSAPP_PROVIDER);
  runner = t.app.get(JobRunner);
  const c = (
    await ashwin
      .post("/clients")
      .send({
        name: "Madurai Mills",
        code: "MDM",
        contacts: [
          { name: "Selvi Raman", phone: "+91 98400 66001", approver: true },
          { name: "Ravi", phone: "+91 98400 66002" },
        ],
      })
      .expect(201)
  ).body as { id: string; contacts: { id: string; name: string }[] };
  clientId = c.id;
  approverId = c.contacts.find((x) => x.name === "Selvi Raman")!.id;
  const a = (
    await ashwin
      .post(`/clients/${clientId}/agreements`)
      .send({
        title: "Madurai Mills · Reels",
        startDate: `${M}-01`,
        months: 6,
        monthlyFee: 25000,
        billing: "Monthly advance",
        revisionsPerDeliverable: 2,
        shootDays: 1,
        deliverables: [{ name: "Reels", perMonth: 4, kind: "video" }],
        platforms: ["instagram"],
      })
      .expect(201)
  ).body as { id: string };
  await jana.post(`/agreements/${a.id}/sign-off`).expect(200);
  // A video ready to send to the client.
  const v = (
    await ashwin
      .post("/videos")
      .send({ clientId, title: "Spinning mill at dawn", format: "Reel", dueDate: `${M}-27`, editorId: seedUserId("divya@geniemagnet.test") })
      .expect(201)
  ).body as { id: string };
  videoId = v.id;
  await divya.post(`/videos/${videoId}/move`).send({ to: "shot" }).expect(200);
  await divya.put(`/videos/${videoId}/protect`).send({ done: true }).expect(200);
  await divya.post(`/videos/${videoId}/move`).send({ to: "editing" }).expect(200);
  for (const step of DEFAULT_PRODUCTION_SETTINGS.editSteps) await divya.put(`/videos/${videoId}/edit-steps`).send({ step, done: true }).expect(200);
  await divya.post(`/videos/${videoId}/move`).send({ to: "internal_qc" }).expect(200);
  for (const q of DEFAULT_PRODUCTION_SETTINGS.qcChecks) await karthik.put(`/videos/${videoId}/qc`).send({ check: q.key, result: "pass" }).expect(200);
  await divya.post(`/videos/${videoId}/versions`).send({ link: "https://drive.example/mdm-v1" }).expect(201);
}, 300_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("quiet hours", () => {
  it("hold a message until they end (India time), across midnight too", () => {
    // 22:00 IST is 16:30 UTC; quiet 21:00–08:00 → 08:00 IST is 02:30 UTC next day.
    expect(afterQuietHours(new Date("2030-01-01T16:30:00Z"), "21:00", "08:00").toISOString()).toBe("2030-01-02T02:30:00.000Z");
    expect(afterQuietHours(new Date("2030-01-01T23:00:00Z"), "21:00", "08:00").toISOString()).toBe("2030-01-02T02:30:00.000Z");
    expect(afterQuietHours(new Date("2030-01-01T06:00:00Z"), "21:00", "08:00").toISOString()).toBe("2030-01-01T06:00:00.000Z");
  });
});

describe("connecting a number", () => {
  it("is for people who may change settings; a token WhatsApp refuses shows why", async () => {
    await divya.put("/whatsapp/connection").send({ phoneNumberId: "1098765432101", accessToken: TOKEN }).expect(403);
    settings = (await jana.put("/whatsapp/connection").send({ phoneNumberId: "1098765432101", accessToken: "bad-token-from-somewhere-else" }).expect(200)).body;
    expect(settings.connection).toMatchObject({ status: "error", lastError: "Invalid OAuth access token." });
    settings = (await jana.put("/whatsapp/connection").send({ phoneNumberId: "1098765432101", accessToken: TOKEN }).expect(200)).body;
    expect(settings.connection).toMatchObject({ status: "connected", tokenHint: "…1234", hasAppSecret: false, quietFrom: "21:00", quietTo: "08:00" });
    expect(settings.connection!.webhookUrl).toMatch(/\/webhooks\/whatsapp\/[0-9a-f-]{36}$/);
  });

  it("never shows or stores the token in the clear", async () => {
    expect(JSON.stringify((await jana.get("/whatsapp").expect(200)).body)).not.toContain(TOKEN);
    const [row] = await t.sql<{ access_token: string }>(`SELECT access_token FROM whatsapp_connections`);
    expect(row!.access_token).toMatch(/^v1:/);
    expect(row!.access_token).not.toContain(TOKEN.slice(5));
    const [audit] = (await jana.get("/audit?entity=whatsapp&limit=1").expect(200)).body.items as { after: Record<string, unknown> }[];
    expect(JSON.stringify(audit)).not.toContain(TOKEN);
  });

  it("registers the agency's approved templates, and sends a test", async () => {
    for (const purpose of ["approval_request", "invoice_issued", "onboarding_reminder"])
      await jana.put("/whatsapp/templates").send({ purpose, name: purpose }).expect(200);
    await jana.put("/whatsapp/templates").send({ purpose: "approval_request", name: "Approval Request" }).expect(400);
    const test = (await jana.post("/whatsapp/test").send({ phone: "98400 66009" }).expect(200)).body;
    expect(test).toMatchObject({ sent: true, template: "approval_request" });
    expect(outbox.sent.at(-1)).toMatchObject({ to: "919840066009", template: { name: "approval_request", language: "en" } });
  });
});

describe("messages to clients", () => {
  it("go only to contacts who agreed; the rest are logged with the reason", async () => {
    await divya.post(`/videos/${videoId}/versions/send`).expect(200);
    const [m] = await messages();
    expect(m).toMatchObject({
      purpose: "approval_request",
      status: "skipped",
      reason: "Has not agreed to WhatsApp messages",
      contact: { name: "Selvi Raman" },
    });
  });

  it("are sent by the background job, with the contact's own portal link and Approve / Request changes buttons", async () => {
    await divya.put(`/clients/${clientId}/contacts/${approverId}/whatsapp`).send({ optIn: true, source: "Said yes on the call" }).expect(403);
    await ashwin.put(`/clients/${clientId}/contacts/${approverId}/whatsapp`).send({ optIn: true, source: "Said yes on the call" }).expect(200);
    // The client asks for a new version first, so it is sent again — this time to Selvi.
    await karthik.post(`/videos/${videoId}/decision`).send({ approved: false, note: "Brighter, please" }).expect(200);
    await divya.post(`/videos/${videoId}/move`).send({ to: "internal_qc" }).expect(200);
    for (const q of DEFAULT_PRODUCTION_SETTINGS.qcChecks) await karthik.put(`/videos/${videoId}/qc`).send({ check: q.key, result: "pass" }).expect(200);
    await divya.post(`/videos/${videoId}/versions`).send({ link: "https://drive.example/mdm-v2" }).expect(201);
    await divya.post(`/videos/${videoId}/versions/send`).expect(200);
    expect((await messages())[0]).toMatchObject({ status: "queued" });

    await runJobs();
    const [sent] = await messages();
    expect(sent).toMatchObject({
      status: "sent",
      text: expect.stringMatching(/^Hello Selvi, MDM-\d{4}-01 “Spinning mill at dawn” \(v2\) is ready for your approval\. See it here: http.*\/app\/c\//),
    });
    const out = outbox.sent.at(-1)!;
    expect(out).toMatchObject({ to: PHONE, template: { name: "approval_request" } });
    expect(out.buttons).toEqual([`approve:${sent!.id}`, `changes:${sent!.id}`]);
    // The link in the message opens Selvi's portal.
    const link = out.values![2]!;
    expect(
      (
        (
          await anon()
            .get(`/portal/${link.split("/app/c/")[1]}`)
            .expect(200)
        ).body as { contact: { name: string } }
      ).contact.name,
    ).toBe("Selvi Raman");
  });

  it("tell the client an invoice is ready", async () => {
    const [agreement] = (await ashwin.get(`/agreements?clientId=${clientId}`).expect(200)).body as { id: string }[];
    const inv = await draftInvoice(ashwin, agreement!.id, M);
    await jana.post(`/invoices/${inv.id}/issue`).send({}).expect(200);
    await runJobs();
    expect(outbox.sent.at(-1)).toMatchObject({ to: PHONE, template: { name: "invoice_issued" } });
  });
});

describe("what WhatsApp sends back", () => {
  it("must come from Meta: the address is checked with the verify token, and every notice is signed", async () => {
    const path = new URL(settings.connection!.webhookUrl).pathname;
    const ok = await anon().get(`${path}?hub.mode=subscribe&hub.verify_token=${settings.connection!.verifyToken}&hub.challenge=4242`).expect(200);
    expect(ok.text).toBe("4242");
    await anon().get(`${path}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=4242`).expect(403);
    await webhook({ entry: [] }).expect(403); // no app secret saved yet
    settings = (await jana.put("/whatsapp/connection").send({ phoneNumberId: "1098765432101", appSecret: APP_SECRET }).expect(200)).body;
    expect(settings.connection).toMatchObject({ hasAppSecret: true, status: "connected" });
    await webhook({ entry: [] }, "someone-elses-secret-0000").expect(403);
    await webhook({ entry: [] }).expect(200);
  });

  it("updates delivery and reading, never stepping back", async () => {
    const id = outbox.sent.find((s) => s.template?.name === "approval_request" && s.to === PHONE)!.id;
    const status = (status: string, ts: number) => ({ entry: [{ changes: [{ value: { statuses: [{ id, status, timestamp: String(ts) }] } }] }] });
    await webhook(status("read", 1_900_000_100)).expect(200);
    await webhook(status("delivered", 1_900_000_050)).expect(200);
    expect((await messages()).find((m) => m.purpose === "approval_request" && m.status !== "skipped")!.status).toBe("read");
  });

  it("turns Request changes into a revision, and the client's next words into their comment", async () => {
    const msg = (await messages()).find((m) => m.purpose === "approval_request" && m.status === "read")!;
    const button = (wamid: string, payload: string) => ({
      entry: [{ changes: [{ value: { messages: [{ from: PHONE, id: wamid, type: "button", button: { payload, text: "Request changes" } }] } }] }],
    });
    await webhook(button("wamid.in.1", `changes:${msg.id}`)).expect(200);
    await webhook(button("wamid.in.1", `changes:${msg.id}`)).expect(200); // WhatsApp sends again: nothing twice
    const v = (await ashwin.get(`/videos/${videoId}`).expect(200)).body as {
      stage: string;
      versions: { label: string; comments: { author: string; text: string }[] }[];
    };
    expect(v.stage).toBe("revision");
    expect(v.versions[0]!.comments.map((c) => `${c.author}: ${c.text}`)).toEqual(["Selvi Raman: Asked for changes on WhatsApp"]);
    await runJobs();
    expect(outbox.sent.at(-1)).toMatchObject({ to: PHONE, text: "Thank you. What would you like changed? Reply here and the team will see it." });

    await webhook({
      entry: [{ changes: [{ value: { messages: [{ from: PHONE, id: "wamid.in.2", type: "text", text: { body: "The logo should be bigger" } }] } }] }],
    }).expect(200);
    const after = (await ashwin.get(`/videos/${videoId}`).expect(200)).body as typeof v;
    expect(after.versions[0]!.comments.at(-1)).toMatchObject({ author: "Selvi Raman", text: "The logo should be bigger" });
    const n = (await divya.get("/notifications").expect(200)).body.items as { title: string }[];
    expect(n.some((x) => x.title.startsWith("Selvi Raman on WhatsApp about"))).toBe(true);
    // The audit log says the client did it.
    const audit = (await jana.get(`/audit?entity=video&entityId=${videoId}&limit=20`).expect(200)).body.items as {
      action: string;
      after: { stage?: string; byClient?: string };
    }[];
    expect(audit.find((e) => e.action === "move" && e.after.stage === "revision")?.after.byClient).toBe("Selvi Raman");
  });

  it("stops messages to a contact who replies STOP", async () => {
    await webhook({ entry: [{ changes: [{ value: { messages: [{ from: PHONE, id: "wamid.in.3", type: "text", text: { body: "STOP" } }] } }] }] }).expect(200);
    const [row] = await t.sql<{ whatsapp_opt_in: boolean; whatsapp_opt_in_source: string }>(
      `SELECT whatsapp_opt_in, whatsapp_opt_in_source FROM contacts WHERE id = $1`,
      [approverId],
    );
    expect(row).toEqual({ whatsapp_opt_in: false, whatsapp_opt_in_source: "Replied STOP on WhatsApp" });
  });
});

describe("onboarding reminders", () => {
  it("are sent by the app itself on their day, with the onboarding link, and recorded", async () => {
    await ashwin.put(`/clients/${clientId}/contacts/${approverId}/whatsapp`).send({ optIn: true }).expect(200);
    const o = (await ashwin.post(`/clients/${clientId}/onboarding`).send({}).expect(201)).body as { id: string };
    await ashwin.post(`/onboarding/${o.id}/link`).expect(200);
    await t.sql(`UPDATE questionnaire_responses SET sent_at = '2031-05-01T09:00:00Z' WHERE id = $1`, [o.id]);
    await runner.tick(new Date("2031-05-02T05:00:00Z")); // day 2, after quiet hours
    await runner.tick(new Date("2031-05-02T05:01:00Z"));
    const sent = outbox.sent.filter((s) => s.template?.name === "onboarding_reminder");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.values).toEqual(["Selvi", "Genie Magnet", expect.stringMatching(/\/app\/q\/[A-Za-z0-9_-]+$/)]);
    expect(((await ashwin.get(`/onboarding/${o.id}`).expect(200)).body as { remindersDue: number[] }).remindersDue).toEqual([]);
  });
});

describe("the portal and other agencies", () => {
  it("lets the contact switch WhatsApp on or off themselves", async () => {
    const link = ((await ashwin.post(`/clients/${clientId}/contacts/${approverId}/portal-link`).expect(201)).body as { link: string }).link;
    const token = link.split("/app/c/")[1];
    expect(((await anon().get(`/portal/${token}`).expect(200)).body as { whatsapp: unknown }).whatsapp).toEqual({ available: true, optIn: true });
    await anon().put(`/portal/${token}/whatsapp`).send({ optIn: false }).expect(200);
    const [row] = await t.sql<{ whatsapp_opt_in_source: string }>(`SELECT whatsapp_opt_in_source FROM contacts WHERE id = $1`, [approverId]);
    expect(row!.whatsapp_opt_in_source).toBe("Turned off in their portal");
  });

  it("keeps each agency's number, templates and messages to itself", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get("/whatsapp").expect(200)).body).toMatchObject({ connection: null, templates: [] });
    expect((await zara.get("/whatsapp/messages").expect(200)).body).toEqual([]);
  });
});
