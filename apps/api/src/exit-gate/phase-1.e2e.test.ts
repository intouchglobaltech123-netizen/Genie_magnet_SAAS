// Phase 1 exit gate (P1-30): a client is won and onboarded in the real app — the whole path, start to finish, as one
// story. Two-factor sign-in joins step 1 in the last step (P1-10).
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PERMISSIONS, type QuestionnaireDefinition } from "@gm/shared";
import { genieMagnet } from "@gm/db/seed";
import { JobRunner } from "../jobs/job-runner.js";
import { type Agent, ORIGIN, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // the owner
let kavya: Agent; // the new sales manager, invited in step 1
const publicApi = () => request(t.app.getHttpServer());
const iso = (d: Date) => d.toISOString().slice(0, 10);

let leadId: string;
let proposalId: string;
let onboardingId: string;
let clientId: string;
let token: string;

beforeAll(async () => {
  t = await startSeededApp();
  jana = await t.signInAs("jana@geniemagnet.test");
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("Phase 1: a client is won and onboarded", () => {
  it("1. the owner makes a Sales manager role whose discounts need approval, and invites a manager with it", async () => {
    await jana.post("/roles").send({ name: "Sales manager", copyFrom: "manager" }).expect(201);
    await jana
      .patch("/roles/sales_manager")
      .send({ permissions: { ...DEFAULT_PERMISSIONS.manager, crm: { level: "edit" } } })
      .expect(200);

    const invitation = (await jana.post("/team/invitations").send({ email: "kavya@geniemagnet.test", role: "sales_manager" }).expect(201)).body as {
      id: string;
    };
    kavya = request.agent(t.app.getHttpServer());
    await kavya
      .post("/api/auth/sign-up/email")
      .set("Origin", ORIGIN)
      .send({ name: "Kavya Raman", email: "kavya@geniemagnet.test", password: "a-long-test-password-1" })
      .expect(200);
    await kavya.post("/api/auth/organization/accept-invitation").set("Origin", ORIGIN).send({ invitationId: invitation.id }).expect(200);
    await kavya.post("/api/auth/organization/set-active").set("Origin", ORIGIN).send({ organizationId: genieMagnet.id }).expect(200);
    expect((await kavya.get("/me").expect(200)).body.role).toEqual({ key: "sales_manager", name: "Sales manager" });
  });

  it("2. the owner changes an onboarding question and the invoice number format; both apply at once", async () => {
    const q = (await jana.get("/questionnaires/client").expect(200)).body.published.definition as QuestionnaireDefinition;
    q.sections[0]!.questions[0]!.label = "Registered business name, as on your GST certificate";
    await jana.put("/questionnaires/client/draft").send(q).expect(200);
    expect((await jana.post("/questionnaires/client/publish").expect(200)).body.published.version).toBe(2);

    const { nextNumber: _n, nextNumberPreview: _p, ...settings } = (await jana.get("/invoice-settings").expect(200)).body;
    const saved = (
      await jana
        .put("/invoice-settings")
        .send({ ...settings, numberFormat: "GMM/{FY}/{0000}" })
        .expect(200)
    ).body;
    expect(saved.nextNumberPreview).toMatch(/^GMM\//);
  });

  it("3. the manager adds a lead, logs a call and proposes a discount that waits for the owner, who approves it", async () => {
    leadId = (await kavya.post("/leads").send({ name: "Meenakshi", company: "Madurai Mithai", phone: "+91 98431 40001", source: "Referral" }).expect(201)).body
      .id;
    await kavya
      .post(`/leads/${leadId}/activities`)
      .send({ kind: "call", summary: "Wants festive reels before Diwali; send a proposal", nextFollowUp: iso(new Date()) })
      .expect(201);
    const packages = (await kavya.get("/packages").expect(200)).body as { id: string; name: string }[];
    const growth = packages.find((p) => p.name === "Growth Video Pack")!;
    const proposal = (await kavya.post(`/leads/${leadId}/proposals`).send({ packageId: growth.id, discountPercent: 15, months: 12 }).expect(201)).body;
    expect(proposal.status).toBe("pending_approval");
    proposalId = proposal.id;
    await kavya.post(`/proposals/${proposalId}/approve`).send({ note: "Self" }).expect(403);

    const waiting = (await jana.get("/notifications").expect(200)).body.items as { kind: string }[];
    expect(waiting.some((n) => n.kind === "discount_approval")).toBe(true);
    expect((await jana.post(`/proposals/${proposalId}/approve`).send({ note: "Fine for a 12-month festive deal" }).expect(200)).body.status).toBe("approved");
    await kavya.post(`/proposals/${proposalId}/sent`).expect(200);
    await kavya.post(`/proposals/${proposalId}/answer`).send({ accepted: true }).expect(200);
  });

  it("4. the deal is won: the client, the agreement and the onboarding are set up in one go", async () => {
    const start = `${iso(new Date()).slice(0, 7)}-01`;
    const won = (
      await kavya
        .post(`/leads/${leadId}/win`)
        .send({
          client: { name: "Madurai Mithai", code: "MDM", city: "Madurai", contacts: [{ name: "Meenakshi", phone: "+91 98431 40001", approver: true }] },
          proposalId,
          startDate: start,
        })
        .expect(201)
    ).body as { clientId: string; agreementId: string; onboardingId: string };
    clientId = won.clientId;
    onboardingId = won.onboardingId;
    const agreement = (await kavya.get(`/agreements/${won.agreementId}`).expect(200)).body;
    expect(agreement).toMatchObject({ status: "active", title: "Madurai Mithai · Growth Video Pack" });
    const o = (await kavya.get(`/onboarding/${onboardingId}`).expect(200)).body;
    expect(o).toMatchObject({ version: 2, gate: { open: false } });
  });

  it("5. the client answers the required part by link; the 7-day part waits, and the day-2 reminder is asked for", async () => {
    const link = (await kavya.post(`/onboarding/${onboardingId}/link`).expect(200)).body as { link: string };
    token = link.link.split("/app/q/")[1]!;
    const view = (await publicApi().get(`/public/onboarding/${token}`).expect(200)).body;
    expect(JSON.stringify(view)).toContain("Registered business name, as on your GST certificate"); // the owner's change, at once

    const d = (await kavya.get(`/onboarding/${onboardingId}`).expect(200)).body.definition as QuestionnaireDefinition;
    for (const q of d.sections.filter((s) => s.when === "required").flatMap((s) => s.questions)) {
      const value =
        q.type === "multi"
          ? [q.options![0]]
          : q.type === "table"
            ? [{ [q.columns![0]!.key]: "Meenakshi" }]
            : q.type === "choice"
              ? q.options![0]
              : q.type === "number" || q.type === "currency"
                ? "10"
                : q.type === "file"
                  ? ["https://drive.example/madurai-mithai-brand"]
                  : "Madurai Mithai";
      await publicApi().put(`/public/onboarding/${token}/answers/${q.key}`).send({ value }).expect(200);
    }
    const o = (await kavya.get(`/onboarding/${onboardingId}`).expect(200)).body;
    expect(o.progress.required.complete).toBe(true);
    expect(o.progress.window.complete).toBe(false);

    // The clock moves on a day: the morning job asks whoever looks after the client to send the day-2 reminder.
    const tomorrow = new Date(Date.now() + 86_400_000);
    await t.app.get(JobRunner).tick(new Date(`${iso(tomorrow)}T03:00:00Z`));
    const [n] = await t.sql<{ title: string }>(`SELECT title FROM notifications WHERE title = $1`, ["Send Madurai Mithai's day-2 onboarding reminder"]);
    expect(n).toBeDefined();
  });

  it("6. the onboarding gate opens, and the audit log has every step", async () => {
    let o = (await kavya.get(`/onboarding/${onboardingId}`).expect(200)).body;
    expect(o.gate.missing).toEqual(["Deliverables confirmed"]); // the signed agreement and the approver ticked themselves
    o = (await kavya.put(`/onboarding/${onboardingId}/checklist/deliverables`).send({ done: true }).expect(200)).body;
    expect(o.gate).toEqual({ open: true, byException: false, missing: [] });

    const audit = (await jana.get("/audit?limit=200").expect(200)).body.items as { action: string; entity: string }[];
    const seen = new Set(audit.map((e) => `${e.action} ${e.entity}`));
    for (const step of [
      "create role",
      "update role",
      "create invitation",
      "publish questionnaire",
      "update invoice_settings",
      "create lead",
      "create proposal",
      "approve proposal",
      "create client",
      "create agreement",
    ])
      expect(seen, step).toContain(step);
  });

  it("7. a person in the other agency sees none of it", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    const names = (path: string, field: string) =>
      zara
        .get(path)
        .expect(200)
        .then((r) => (r.body as Record<string, unknown>[]).map((x) => JSON.stringify(x[field])));
    expect(await names("/clients", "name")).not.toContain(JSON.stringify("Madurai Mithai"));
    expect(await names("/leads", "company")).not.toContain(JSON.stringify("Madurai Mithai"));
    await zara.get(`/onboarding/${onboardingId}`).expect(404);
    await zara.get(`/clients/${clientId}`).expect(404);
    const audit = (await zara.get("/audit?limit=200").expect(200)).body.items as unknown[];
    expect(JSON.stringify(audit)).not.toContain("Madurai Mithai");
  });
});
