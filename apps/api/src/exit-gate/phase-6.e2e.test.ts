// Phase 6 exit gate (P6-16): a new agency signs up, answers the required questions and has a working workspace within
// minutes; it invites a user, connects WhatsApp and Instagram, and adds a client; the trial ends, the subscription is
// charged and a GST invoice is issued; a downgrade hides an add-on suite without losing data; and the platform admin
// sees the agency's usage and health but cannot open its data without consent.
// Left for the last step, with our own apps, accounts and hosting: signing up with Google, live billing accounts (the
// payment here is the pretend one), and Genie Magnet running as tenant number 1 on the cloud after its migration.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Me, PlanPage, PlatformAgencyRow, PlatformInvoiceRow, PlatformSettings, SetupWizard } from "@gm/shared";
import { JobRunner } from "../jobs/job-runner.js";
import { type Agent, ORIGIN, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // on the platform's team
let owner: Agent; // Lakshmi, who signs up the new agency
let agencyId: string;
let clientId: string;
const PASSWORD = "a-long-test-password-1";
const me = async (a: Agent) => (await a.get("/me").expect(200)).body as Me;
const anon = () => request(t.app.getHttpServer());
const count = async (sql: string) => ((await t.sql(sql)) as { n: number }[])[0]!.n;

/** A person signing up in their own browser. */
async function signUp(name: string, email: string) {
  const agent = request.agent(t.app.getHttpServer());
  await agent.post("/api/auth/sign-up/email").set("Origin", ORIGIN).send({ name, email, password: PASSWORD }).expect(200);
  return agent;
}

beforeAll(async () => {
  t = await startSeededApp({ PLATFORM_ADMIN_EMAILS: "jana@geniemagnet.test" });
  jana = await t.signInAs("jana@geniemagnet.test");
  // The platform admin's own settings: plan prices and our invoice details.
  const s = (await jana.get("/platform/settings").expect(200)).body as PlatformSettings;
  await jana
    .put("/platform/settings")
    .send({
      ...s,
      plans: s.plans.map((p) => (p.key === "growth" ? { ...p, priceInr: 4999 } : p.key === "scale" ? { ...p, priceInr: 9999 } : p)),
      invoice: { ...s.invoice, legalName: "Platform Test Pvt Ltd", gstin: "33AAKFK4821M1Z5", stateCode: "33", address: "Coimbatore", sac: "998314" },
    })
    .expect(200);
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("Phase 6: a new agency signs up, sets itself up, pays and is looked after", () => {
  it("1. signs up, answers the required questions and has a working workspace within minutes", async () => {
    const started = Date.now();
    owner = await signUp("Lakshmi Narayanan", "lakshmi@lotusmedia.test");
    const org = (await owner.post("/api/auth/organization/create").set("Origin", ORIGIN).send({ name: "Lotus Media", slug: "lotus-media" }).expect(200))
      .body as { id: string };
    agencyId = org.id;
    await owner.post("/api/auth/organization/set-active").set("Origin", ORIGIN).send({ organizationId: agencyId }).expect(200);
    expect((await me(owner)).entitlements).toMatchObject({ plan: { key: "scale" }, status: "trialing", readOnly: false });

    const o = (await owner.post("/onboarding/agency").expect(201)).body as { id: string };
    const answers: [string, unknown][] = [
      ["a1", "Lotus Media, Lakshmi Narayanan (founder), lakshmi@lotusmedia.test"],
      ["a1b", "Two years, video agency, Madurai"],
      ["a2", "Survival"],
      ["a3", ["Video production", "Social media management"]],
      ["a4", [{ name: "Reels Starter", price: "30,000", videos: "8", posts: "8", shootDays: "1", revisions: "2" }]],
      ["a13", "Fifteen retainer clients in two years"],
      ["a14", "18,00,000"],
      ["a14b", "36,00,000"],
      [
        "a20",
        [
          { name: "Lakshmi", role: "Founder", approves: "Everything" },
          { name: "Arun", role: "Editor", approves: "Nothing" },
          { name: "Bala", role: "Shooter", approves: "Nothing" },
        ],
      ],
    ];
    for (const [key, value] of answers) await owner.put(`/onboarding/${o.id}/answers/${key}`).send({ value }).expect(200);
    await owner.post(`/onboarding/${o.id}/packages`).send({}).expect(200);
    await owner.post("/goals/from-questionnaire").expect(200);

    const w = (await owner.get("/agency/setup/wizard").expect(200)).body as SetupWizard;
    expect(w.questionnaire?.requiredDone).toBe(true);
    expect(w.packages).toEqual({ inAnswers: 1, made: 1 });
    expect(w.goals.target).toBe(3_600_000);
    expect(w.goals.made).toBeGreaterThan(0);
    expect(w.suites.map((s) => s.key)).toEqual(["management", "people", "finance", "operations", "genie"]);
    expect(Date.now() - started).toBeLessThan(5 * 60_000);
  });

  it("2. invites a user, connects WhatsApp and Instagram, and adds a client", async () => {
    const invitation = (await owner.post("/team/invitations").send({ email: "arun@lotusmedia.test", role: "editor" }).expect(201)).body as { id: string };
    const arun = await signUp("Arun Kumar", "arun@lotusmedia.test");
    await arun.post("/api/auth/organization/accept-invitation").set("Origin", ORIGIN).send({ invitationId: invitation.id }).expect(200);
    expect((await me(arun)).agencies.map((a) => a.name)).toEqual(["Lotus Media"]);

    const wa = (
      await owner
        .put("/whatsapp/connection")
        .send({ phoneNumberId: "1098765400006", accessToken: "EAAG-gate-six-permanent-token-0001", appSecret: "gate-six-app-secret" })
        .expect(200)
    ).body as { connection: { status: string } };
    expect(wa.connection.status).toBe("connected");

    clientId = (
      (
        await owner
          .post("/clients")
          .send({ name: "Madurai Sweets", code: "MDS", contacts: [{ name: "Kavitha", phone: "+91 98400 77001", approver: true }] })
          .expect(201)
      ).body as { id: string }
    ).id;
    const rows = (await owner.post(`/clients/${clientId}/platforms`).send({ platform: "instagram", handle: "@maduraisweets" }).expect(201)).body as {
      id: string;
      platform: string;
    }[];
    const ig = rows.find((r) => r.platform === "instagram")!;
    const { url } = (await owner.post(`/clients/${clientId}/platforms/${ig.id}/connect`).expect(200)).body as { url: string };
    const u = new URL(url);
    expect((await anon().get(`${u.pathname}${u.search}`).expect(302)).headers.location).toBe(
      `${ORIGIN}/app/clients/${clientId}?social=linked&platform=instagram`,
    );
    const platforms = (await owner.get(`/clients/${clientId}/platforms`).expect(200)).body as { platform: string; status: string }[];
    expect(platforms.find((p) => p.platform === "instagram")?.status).toBe("linked");
  });

  it("3. the trial ends, the subscription is charged and a GST invoice is issued", async () => {
    await t.sql(`UPDATE subscriptions SET trial_ends_at = now() - interval '1 hour' WHERE agency_id = '${agencyId}'`);
    await t.app.get(JobRunner).tick(new Date(`${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}T03:00:00Z`));
    expect((await me(owner)).entitlements).toMatchObject({ status: "expired", readOnly: true });
    await owner
      .post("/clients")
      .send({ name: "Not now", code: "NOW", contacts: [{ name: "X", phone: "+91 98400 77002", approver: true }] })
      .expect(403);

    await owner.post("/plan/choose").send({ plan: "scale", currency: "INR" }).expect(200);
    const plan = (await owner.get("/plan").expect(200)).body as PlanPage;
    expect(plan.entitlements).toMatchObject({ plan: { key: "scale" }, status: "active", readOnly: false });
    const invoices = ((await jana.get("/platform/invoices").expect(200)).body as PlatformInvoiceRow[]).filter((i) => i.agency.id === agencyId);
    expect(invoices).toHaveLength(1);
    // Lotus Media has no state on record yet, so it is billed across states: IGST at 18%.
    expect(invoices[0]).toMatchObject({
      plan: { name: "Scale" },
      currency: "INR",
      amount: 9999,
      cgst: 0,
      sgst: 0,
      gstRate: 18,
      seller: { gstin: "33AAKFK4821M1Z5" },
      buyer: { name: "Lotus Media" },
    });
    expect(invoices[0]!.igst).toBe(1800);
    expect(invoices[0]!.total).toBe(11_799);
    expect(invoices[0]!.number).toMatch(/^INV\/\d{2}-\d{2}\/\d{4}$/);
  });

  it("4. a downgrade hides an add-on suite without losing data", async () => {
    const goals = await count(`SELECT count(*)::int AS n FROM goals WHERE agency_id = '${agencyId}'`);
    expect(goals).toBeGreaterThan(0);
    await owner.post("/plan/choose").send({ plan: "growth", currency: "INR" }).expect(200);
    expect((await owner.get("/goals").expect(403)).body.message).toMatch(/^Management is not in your plan \(Growth\)/);
    expect((await me(owner)).entitlements?.suites).not.toContain("management");
    expect(await count(`SELECT count(*)::int AS n FROM goals WHERE agency_id = '${agencyId}'`)).toBe(goals);
    // Back on the larger plan, everything is where it was.
    await owner.post("/plan/choose").send({ plan: "scale", currency: "INR" }).expect(200);
    expect(((await owner.get("/goals").expect(200)).body as unknown[]).length).toBeGreaterThan(0);
  });

  it("5. the platform admin sees its usage and health, but not its data without consent", async () => {
    const row = ((await jana.get("/platform/agencies").expect(200)).body as PlatformAgencyRow[]).find((a) => a.id === agencyId)!;
    expect(row).toMatchObject({ name: "Lotus Media", plan: { key: "scale" }, status: "active", readOnly: false, people: 2, clients: 1, failedJobs: 0 });
    expect(row.lastActivityAt).not.toBeNull();
    expect((await jana.post(`/platform/agencies/${agencyId}/support`).expect(409)).body.message).toBe(
      "This agency has not let support in, or its access has ended.",
    );
    expect((await me(jana)).activeAgencyId).not.toBe(agencyId);

    const [grant] = (await owner.post("/support-access").send({ hours: 1, level: "view", reason: "Instagram posts" }).expect(201)).body as { id: string }[];
    await jana.post(`/platform/agencies/${agencyId}/support`).expect(200);
    expect(((await jana.get("/clients").expect(200)).body as { code: string }[]).map((c) => c.code)).toEqual(["MDS"]);
    await owner.post(`/support-access/${grant!.id}/revoke`).expect(200);
    expect((await me(jana)).support).toBeNull();
  });
});
