// Proposals with discount approval (P1-16) and winning the deal (P1-17), on the sample agencies.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { genieMagnet, seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent;
let ashwin: Agent;
let priya: Agent;
let balaji: { id: string };
let growth: { id: string; monthlyFee: number };

type Proposal = { id: string; status: string; monthlyFee: number; discountPercent: number; decisionNote: string | null };

beforeAll(async () => {
  t = await startSeededApp();
  jana = await t.signInAs("jana@geniemagnet.test");
  ashwin = await t.signInAs("ashwin@geniemagnet.test"); // manager: may approve sales
  priya = await t.signInAs("priya@geniemagnet.test"); // team leader: proposes, cannot approve
  const leads = (await priya.get("/leads").expect(200)).body as { id: string; company: string }[];
  balaji = leads.find((l) => l.company === "Balaji Textiles")!;
  const packages = (await priya.get("/packages").expect(200)).body as { id: string; name: string; monthlyFee: number }[];
  growth = packages.find((p) => p.name === "Growth Video Pack")!;
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("proposals and discount approval", () => {
  let proposal: Proposal;

  it("approves a discount within the agency's limit at once", async () => {
    const small = (await priya.post(`/leads/${balaji.id}/proposals`).send({ packageId: growth.id, discountPercent: 5, months: 12 }).expect(201))
      .body as Proposal;
    expect(small).toMatchObject({ status: "approved", monthlyFee: 80750, decisionNote: "Within the sales limit" });
  });

  it("holds a discount above the limit for someone who may approve", async () => {
    proposal = (await priya.post(`/leads/${balaji.id}/proposals`).send({ packageId: growth.id, discountPercent: 12, months: 12 }).expect(201)).body;
    expect(proposal).toMatchObject({ status: "pending_approval", monthlyFee: 74800 });
    await priya.post(`/proposals/${proposal.id}/sent`).expect(409); // not before approval
    await priya.post(`/proposals/${proposal.id}/approve`).send({}).expect(403); // team leaders cannot approve

    const waiting = (await ashwin.get("/proposals?status=pending_approval").expect(200)).body as (Proposal & { leadName: string })[];
    expect(waiting.map((p) => p.leadName)).toEqual(["Balaji"]);
    const approved = (await ashwin.post(`/proposals/${proposal.id}/approve`).send({ note: "Fine for a 12-month deal" }).expect(200)).body;
    expect(approved).toMatchObject({ status: "approved", decisionNote: "Fine for a 12-month deal", decidedBy: seedUserId("ashwin@geniemagnet.test") });
  });

  it("needs a reason to reject, and records it", async () => {
    const big = (await priya.post(`/leads/${balaji.id}/proposals`).send({ packageId: growth.id, discountPercent: 30, months: 6 }).expect(201)).body as Proposal;
    await jana.post(`/proposals/${big.id}/reject`).send({}).expect(400);
    const rejected = (await jana.post(`/proposals/${big.id}/reject`).send({ note: "Too deep; offer 12% with a 12-month term" }).expect(200)).body;
    expect(rejected).toMatchObject({ status: "rejected", decisionNote: "Too deep; offer 12% with a 12-month term" });
  });

  it("is sent, then the client's answer is recorded", async () => {
    await priya.post(`/proposals/${proposal.id}/sent`).expect(200);
    expect((await priya.post(`/proposals/${proposal.id}/answer`).send({ accepted: true }).expect(200)).body.status).toBe("accepted");
    const detail = (await priya.get(`/leads/${balaji.id}`).expect(200)).body as { proposals: Proposal[] };
    expect(detail.proposals.map((p) => p.status)).toEqual(["rejected", "accepted", "approved"]);
  });

  it("follows the agency's own limit", async () => {
    await jana.patch("/agency").send({ discountLimit: 15 }).expect(200);
    const p = (await priya.post(`/leads/${balaji.id}/proposals`).send({ packageId: growth.id, discountPercent: 12, months: 12 }).expect(201)).body;
    expect(p.status).toBe("approved");
    await jana.patch("/agency").send({ discountLimit: 10 }).expect(200);
  });
});

describe("winning the deal", () => {
  const client = {
    name: "Balaji Textiles",
    code: "BLJ",
    city: "Tiruppur",
    contacts: [{ name: "Balaji", phone: "+91 98941 30009", email: "info@balajitex.test", approver: true }],
  };

  it("cannot happen by dragging the lead to Won", async () => {
    const res = await priya.patch(`/leads/${balaji.id}`).send({ stage: "won" }).expect(400);
    expect(res.body.message).toBe("Mark the deal as won from the lead, so the client and agreement are set up.");
  });

  it("needs edit on clients as well as sales", async () => {
    await jana
      .post("/roles")
      .send({ name: "Lead caller", permissions: { crm: { level: "edit" } } })
      .expect(201);
    const team = (await jana.get("/team").expect(200)).body as { members: { id: string; user: { email: string } }[] };
    await jana
      .patch(`/team/members/${team.members.find((m) => m.user.email === "meena@geniemagnet.test")!.id}`)
      .send({ role: "lead_caller" })
      .expect(200);
    const caller = await t.signInAs("meena@geniemagnet.test");
    const res = await caller.post(`/leads/${balaji.id}/win`).send({ client, startDate: "2026-11-01" }).expect(403);
    expect(res.body.message).toMatch(/cannot add clients/);
  });

  it("sets up the client, contact and agreement from the accepted proposal, in one go", async () => {
    const proposals = ((await priya.get(`/leads/${balaji.id}`).expect(200)).body as { proposals: Proposal[] }).proposals;
    const accepted = proposals.find((p) => p.status === "accepted")!;
    const won = (await priya.post(`/leads/${balaji.id}/win`).send({ client, proposalId: accepted.id, startDate: "2026-11-01" }).expect(201)).body;

    const [row] = await t.sql<{ code: string; owner: string; contacts: number; fee: number; start: string; end: string; status: string; title: string }>(
      `SELECT c.code, c.account_owner_id AS owner, (SELECT count(*)::int FROM contacts WHERE client_id = c.id) AS contacts,
              a.monthly_fee AS fee, to_char(a.start_date, 'YYYY-MM-DD') AS start, to_char(a.end_date, 'YYYY-MM-DD') AS end, a.status, a.title
         FROM clients c JOIN agreements a ON a.client_id = c.id WHERE c.id = $1`,
      [won.clientId],
    );
    expect(row).toMatchObject({
      code: "BLJ",
      owner: seedUserId("jana@geniemagnet.test"),
      contacts: 1,
      fee: 74800,
      status: "active",
      title: "Balaji Textiles · Growth Video Pack",
    });
    expect([row!.start, row!.end]).toEqual(["2026-11-01", "2027-10-31"]);

    const lead = (await priya.get(`/leads/${balaji.id}`).expect(200)).body;
    expect(lead).toMatchObject({ stage: "won", clientId: won.clientId, nextFollowUp: null });
    await priya
      .post(`/leads/${balaji.id}/win`)
      .send({ client: { ...client, code: "BLX" }, startDate: "2026-11-01" })
      .expect(409);

    const audit = (await jana.get("/audit?limit=6").expect(200)).body.items as { action: string; entity: string }[];
    expect(audit.map((e) => `${e.action} ${e.entity}`)).toEqual(expect.arrayContaining(["create client", "create agreement", "update lead"]));
  });

  it("is refused when the client code is already used, saving nothing", async () => {
    const leads = (await priya.get("/leads").expect(200)).body as { id: string; company: string }[];
    const revathi = leads.find((l) => l.company === "Revathi Jewellers")!;
    const res = await priya
      .post(`/leads/${revathi.id}/win`)
      .send({ client: { ...client, name: "Revathi Jewellers", code: "KVR" }, startDate: "2026-11-01" })
      .expect(400);
    expect(res.body.issues).toEqual([{ path: "client.code", message: "Already used by another client" }]);
    const [{ n }] = await t.sql<{ n: number }>(`SELECT count(*)::int AS n FROM clients WHERE agency_id = $1 AND name = 'Revathi Jewellers'`, [genieMagnet.id]);
    expect(n).toBe(0);
  });
});
