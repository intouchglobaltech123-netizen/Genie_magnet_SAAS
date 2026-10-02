// Plans, subscriptions and the platform console (P6-01 to P6-03, ADR 0011): agencies without a plan have everything;
// the platform's team sees each agency's numbers, never its records, and keeps the plans; a plan's suites decide what an
// agency has and a downgrade keeps its data; limits stop adding people and clients; an unpaid trial turns the workspace
// read-only until a plan is chosen; and signing up starts a trial that the daily check ends.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type ChoosePlanResult,
  financialYear,
  type Me,
  type PlanPage,
  type PlatformAgencyRow,
  type PlatformInvoiceRow,
  type PlatformSettings,
  SUITE_KEYS,
} from "@gm/shared";
import { JobRunner } from "../jobs/job-runner.js";
import { type Agent, ORIGIN, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner of Genie Magnet
let divya: Agent; // editor
let anitha: Agent; // finance — and, on this server, on the platform's own team
let zara: Agent; // owner of Zen Studio
let zen: string;
let settings: PlatformSettings;
const day = (offset: number) => new Date(Date.now() + 330 * 60_000 + offset * 86_400_000).toISOString().slice(0, 10);
const me = async (a: Agent) => (await a.get("/me").expect(200)).body as Me;

beforeAll(async () => {
  t = await startSeededApp({ PLATFORM_ADMIN_EMAILS: "anitha@geniemagnet.test" });
  [jana, divya, anitha, zara] = await Promise.all(
    ["jana@geniemagnet.test", "divya@geniemagnet.test", "anitha@geniemagnet.test", "zara@zenstudio.test"].map((e) => t.signInAs(e)),
  );
  [{ agency_id: zen }] = (await t.sql(`SELECT m.agency_id FROM memberships m JOIN users u ON u.id = m.user_id WHERE u.email = 'zara@zenstudio.test'`)) as {
    agency_id: string;
  }[];
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("without a plan", () => {
  it("an agency has every suite and no limits — Genie Magnet and the agencies made before plans", async () => {
    expect((await me(jana)).entitlements).toMatchObject({
      plan: null,
      status: null,
      suites: [...SUITE_KEYS],
      readOnly: false,
      limits: { users: null, clients: null },
    });
    expect((await me(jana)).platformAdmin).toBe(false);
    expect((await me(anitha)).platformAdmin).toBe(true);
  });
});

describe("the platform console", () => {
  it("is for the platform's own team, and shows each agency's numbers — never its records", async () => {
    await divya.get("/platform/agencies").expect(403);
    await jana.get("/platform/agencies").expect(403); // an agency's owner is not the platform
    const rows = (await anitha.get("/platform/agencies").expect(200)).body as PlatformAgencyRow[];
    const gm = rows.find((r) => r.slug === "genie-magnet")!;
    expect(gm).toMatchObject({ plan: null, status: null, readOnly: false, failedJobs: 0 });
    expect(gm.people).toBeGreaterThan(5);
    expect(gm.clients).toBe(5);
    expect(rows.some((r) => r.id === zen)).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/Kaveri|Nova Dental|geniemagnet\.test/);
  });

  it("keeps the plans: their suites, limits and prices", async () => {
    settings = (await anitha.get("/platform/settings").expect(200)).body as PlatformSettings;
    expect(settings.plans.map((p) => p.key)).toEqual(["starter", "growth", "scale", "enterprise"]);
    expect(settings.plans.every((p) => p.priceInr === null)).toBe(true); // prices start unset
    await jana.put("/platform/settings").send(settings).expect(403);
    await anitha
      .put("/platform/settings")
      .send({ ...settings, trialPlan: "nope" })
      .expect(400);
    const tiny = {
      key: "tiny",
      name: "Tiny",
      description: "",
      suites: ["people"],
      limits: { users: 2, clients: 2, aiDrafts: 0, storageGb: 1 },
      priceInr: 999,
      priceUsd: 12,
      offered: true,
    };
    settings = (
      await anitha
        .put("/platform/settings")
        .send({ ...settings, brandName: "Agency OS", plans: [...settings.plans.map((p) => (p.key === "growth" ? { ...p, priceInr: 4999 } : p)), tiny] })
        .expect(200)
    ).body as PlatformSettings;
    const page = (await jana.get("/plan").expect(200)).body as PlanPage;
    expect(page.brandName).toBe("Agency OS");
    expect(page.plans.find((p) => p.key === "growth")).toMatchObject({ priceInr: 4999 });
    expect(page.plans.find((p) => p.key === "tiny")).toMatchObject({ name: "Tiny", suites: ["people"], priceInr: 999 });
    expect(page.usage.clients).toBe(5);
  });
});

describe("a plan", () => {
  it("decides the suites an agency has; a downgrade hides the rest and keeps their data", async () => {
    const goal = (
      await zara
        .post("/goals")
        .send({
          level: "company",
          title: "₹30 lakh revenue this year",
          type: "financial",
          unit: "inr",
          target: 3_000_000,
          startDate: day(-10),
          dueDate: day(300),
        })
        .expect(201)
    ).body as { id: string };
    await jana.put(`/platform/agencies/${zen}/subscription`).send({ plan: "tiny" }).expect(403);
    const row = (await anitha.put(`/platform/agencies/${zen}/subscription`).send({ plan: "tiny", status: "active" }).expect(200)).body as PlatformAgencyRow;
    expect(row).toMatchObject({ plan: { key: "tiny", name: "Tiny" }, status: "active", readOnly: false });
    expect((await me(zara)).entitlements).toMatchObject({ plan: { name: "Tiny" }, suites: ["people"], limits: { clients: 2 } });
    expect((await zara.get("/goals").expect(403)).body.message).toBe(
      "Management is not in your plan (Tiny). The owner can change the plan in Settings → Plan; nothing is lost meanwhile.",
    );
    await zara.get("/people").expect(200);
    // The agency's own audit log says what the platform did.
    expect(await t.sql(`SELECT 1 FROM audit_logs WHERE agency_id = '${zen}' AND entity = 'subscription'`)).toHaveLength(1);
    // Back on a larger plan, the goal is still there.
    await anitha.put(`/platform/agencies/${zen}/subscription`).send({ plan: "scale", status: "active" }).expect(200);
    expect(((await zara.get("/goals").expect(200)).body as { id: string }[]).map((g) => g.id)).toContain(goal.id);
  });

  it("limits the people and clients the agency adds", async () => {
    await anitha.put(`/platform/agencies/${zen}/subscription`).send({ plan: "tiny", status: "active" }).expect(200);
    const used = ((await zara.get("/plan").expect(200)).body as PlanPage).usage;
    expect(used.clients).toBe(2);
    expect(
      (
        await zara
          .post("/clients")
          .send({ name: "Third Client", code: "TRD", contacts: [{ name: "Owner", phone: "+91 98400 77001", approver: true }] })
          .expect(403)
      ).body.message,
    ).toMatch(/^Your plan \(Tiny\) allows 2 clients, and 2 are already taken\. The owner can choose a larger plan in Settings → Plan\.$/);
    if (used.users >= 2) await zara.post("/team/invitations").send({ email: "new.editor@zenstudio.test", role: "editor" }).expect(403);
    else {
      await zara.post("/team/invitations").send({ email: "new.editor@zenstudio.test", role: "editor" }).expect(201);
      await zara.post("/team/invitations").send({ email: "another.editor@zenstudio.test", role: "editor" }).expect(403);
    }
  });

  it("turns the workspace read-only when the trial has ended unpaid, until a plan is chosen", async () => {
    await anitha
      .put(`/platform/agencies/${zen}/subscription`)
      .send({ plan: "scale", status: "trialing", trialEndsAt: day(-1) })
      .expect(200);
    const ent = (await me(zara)).entitlements!;
    expect(ent).toMatchObject({ status: "trialing", readOnly: true, readOnlyReason: expect.stringMatching(/^The trial has ended/) });
    expect(
      (
        await zara
          .post("/clients")
          .send({ name: "Fourth", code: "FTH", contacts: [{ name: "Owner", phone: "+91 98400 77001", approver: true }] })
          .expect(403)
      ).body.message,
    ).toMatch(/^The trial has ended/);
    await zara.get("/clients").expect(200); // everything can still be read
    await divya.get("/clients").expect(200); // another agency is untouched
    await anitha.get("/platform/agencies").expect(200);
    const page = (await zara.post("/plan/choose").send({ plan: "growth" }).expect(200)).body as PlanPage;
    expect(page.entitlements).toMatchObject({ plan: { key: "growth" }, status: "active", readOnly: false, trialEndsAt: null });
    await zara
      .post("/clients")
      .send({ name: "Fourth Client", code: "FTH", contacts: [{ name: "Owner", phone: "+91 98400 77001", approver: true }] })
      .expect(201);
    await zara.post("/plan/choose").send({ plan: "nope" }).expect(400);
  });
});

describe("signing up", () => {
  it("starts a trial of the trial plan, which the daily check ends when it runs out unpaid", async () => {
    const agent = request.agent(t.app.getHttpServer());
    const post = (path: string, body: object) => agent.post(path).set("Origin", ORIGIN).send(body);
    await post("/api/auth/sign-up/email", { name: "Ravi Kumar", email: "ravi@newagency.test", password: "a-long-test-password-1" }).expect(200);
    const org = (await post("/api/auth/organization/create", { name: "New Agency", slug: "new-agency" }).expect(200)).body as { id: string };
    await post("/api/auth/organization/set-active", { organizationId: org.id }).expect(200);
    const ent = (await me(agent)).entitlements!;
    expect(ent).toMatchObject({ plan: { key: "scale" }, status: "trialing", readOnly: false });
    const days = (new Date(ent.trialEndsAt!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThan(14.1);

    // The trial runs out: the morning's check ends it and tells the owner.
    await t.sql(`UPDATE subscriptions SET trial_ends_at = now() - interval '1 hour' WHERE agency_id = '${org.id}'`);
    await t.app.get(JobRunner).tick(new Date(`${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}T03:00:00Z`));
    expect((await me(agent)).entitlements).toMatchObject({ status: "expired", readOnly: true });
    const n = (await agent.get("/notifications").expect(200)).body.items as { kind: string; title: string; link: string }[];
    expect(n.find((x) => x.kind === "billing")).toMatchObject({ title: "The trial has ended", link: "/app/settings/plan" });
  });
});

describe("our invoices (pretend payments)", () => {
  const fy = financialYear(day(0)).short;
  const morning = (days: number) => new Date(`${new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)}T03:00:00Z`);

  it("are issued for each payment with our details and the agency's, GST split by state, numbered across agencies", async () => {
    // Zen chose Growth (₹4,999) before our invoice details were set; Zen has no state on record, so it is IGST.
    const zen1 = ((await zara.get("/plan").expect(200)).body as PlanPage).invoices;
    expect(zen1).toEqual([
      expect.objectContaining({
        number: `INV/${fy}/0001`,
        plan: { key: "growth", name: "Growth" },
        currency: "INR",
        amount: 4999,
        cgst: 0,
        sgst: 0,
        igst: 900,
        total: 5899,
        provider: "outbox",
        buyer: expect.objectContaining({ name: "Zen Studio (test agency)" }),
      }),
    ]);

    settings = (
      await anitha
        .put("/platform/settings")
        .send({
          ...settings,
          invoice: {
            legalName: "Agency OS Technologies Pvt Ltd",
            gstin: "33AAACA1234B1Z5",
            stateCode: "33",
            address: "1 Mount Road, Chennai 600002",
            sac: "998314",
            prefix: "AOS",
            gstRate: 18,
          },
          plans: settings.plans.map((p) => (p.key === "scale" ? { ...p, priceInr: 9999 } : p.key === "enterprise" ? { ...p, priceUsd: 199 } : p)),
        })
        .expect(200)
    ).body as PlatformSettings;
    expect((await jana.post("/plan/choose").send({ plan: "starter" }).expect(409)).body.message).toBe("Starter's price in rupees is not set yet.");

    // Genie Magnet is in Tamil Nadu, like us: CGST and SGST.
    const chosen = (await jana.post("/plan/choose").send({ plan: "scale", currency: "INR" }).expect(200)).body as ChoosePlanResult;
    expect(chosen).toMatchObject({ payUrl: null, entitlements: { plan: { key: "scale" }, status: "active" }, billing: { provider: "outbox" } });
    expect(chosen.invoices[0]).toMatchObject({
      number: `AOS/${fy}/0001`,
      amount: 9999,
      cgst: 900,
      sgst: 900,
      igst: 0,
      total: 11799,
      gstRate: 18,
      sac: "998314",
      totalInWords: "Rupees eleven thousand seven hundred and ninety-nine only",
      seller: { name: "Agency OS Technologies Pvt Ltd", gstin: "33AAACA1234B1Z5", address: "1 Mount Road, Chennai 600002", state: "Tamil Nadu" },
      buyer: { name: "Genie Magnet Media LLP", gstin: "33AAKFG5512R1Z1", address: "12 Bhavani Main Road, Appakudal, Erode 638315", state: "Tamil Nadu" },
    });

    // An agency abroad pays in dollars: an export, with no GST.
    const usd = (await zara.post("/plan/choose").send({ plan: "enterprise", currency: "USD" }).expect(200)).body as ChoosePlanResult;
    expect(usd.invoices[0]).toMatchObject({ number: `AOS/${fy}/0002`, currency: "USD", amount: 199, igst: 0, total: 199, totalInWords: "US dollars 199 only" });
  });

  it("renew each period with a new invoice, once", async () => {
    const gm = (await t.sql(`SELECT agency_id FROM subscriptions WHERE plan_key = 'scale' AND provider = 'outbox' AND status = 'active'`)) as {
      agency_id: string;
    }[];
    await t.sql(`UPDATE subscriptions SET current_period_end = now() - interval '1 hour' WHERE agency_id = '${gm[0]!.agency_id}'`);
    await t.app.get(JobRunner).tick(morning(2));
    await t.app.get(JobRunner).tick(morning(2));
    const invoices = ((await jana.get("/plan").expect(200)).body as PlanPage).invoices;
    expect(invoices.map((i) => i.number)).toEqual([`AOS/${fy}/0003`, `AOS/${fy}/0001`]);
    expect(((await me(jana)).entitlements!.currentPeriodEnd ?? "") > new Date().toISOString()).toBe(true);
  });

  it("are the agency's own, and all of them are listed in the platform console", async () => {
    const mine = ((await jana.get("/plan").expect(200)).body as PlanPage).invoices[0]!;
    expect(((await jana.get(`/plan/invoices/${mine.id}`).expect(200)).body as PlatformInvoiceRow).number).toBe(mine.number);
    const zens = ((await zara.get("/plan").expect(200)).body as PlanPage).invoices[0]!;
    await jana.get(`/plan/invoices/${zens.id}`).expect(404);
    await divya.get("/platform/invoices").expect(403);
    const all = (await anitha.get("/platform/invoices").expect(200)).body as PlatformInvoiceRow[];
    expect(all.map((i) => [i.number, i.agency.name])).toEqual(
      expect.arrayContaining([
        [`AOS/${fy}/0001`, "Genie Magnet"],
        [`AOS/${fy}/0002`, "Zen Studio (test agency)"],
        [`INV/${fy}/0001`, "Zen Studio (test agency)"],
      ]),
    );
  });
});
