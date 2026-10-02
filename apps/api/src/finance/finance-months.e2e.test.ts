// Collections and the month's money (P5-04, P5-05): invoices drafted by themselves on each agreement's billing day,
// what clients owe by how late, the month's figures, and closing a month.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AgeingReport, type FinanceMonthRow, type Invoice } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { JobRunner } from "../jobs/job-runner.js";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";
import { billingDue } from "./collections.service.js";

let t: SeededApp;
let jana: Agent; // owner
let ashwin: Agent; // manager
let divya: Agent; // editor
let anitha: Agent; // finance
let runner: JobRunner;
let clientId: string;
const agreements: Record<string, string> = {};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (m: string, by: number) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
};
const M = new Date().toISOString().slice(0, 7);
const NEXT = shift(M, 1);
const PREV = shift(M, -1);
const FIRST = `${M}-01`;
const invoicesOf = async (agreementId: string) =>
  ((await anitha.get(`/invoices?clientId=${clientId}`).expect(200)).body as Invoice[]).filter(
    (i) => i.agreement?.id === agreementId && i.status !== "cancelled",
  );

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, divya, anitha] = await Promise.all(["jana", "ashwin", "divya", "anitha"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  runner = t.app.get(JobRunner);
  clientId = (
    await ashwin
      .post("/clients")
      .send({ name: "Trichy Textiles", code: "TRT", contacts: [{ name: "Lakshmi", phone: "+91 98400 99009", approver: true }] })
      .expect(201)
  ).body.id;
  for (const [billing, fee] of [
    ["Monthly advance", 30000],
    ["Monthly arrears", 20000],
    ["Quarterly advance", 10000],
  ] as const) {
    const a = (
      await ashwin
        .post(`/clients/${clientId}/agreements`)
        .send({
          title: `Trichy · ${billing}`,
          startDate: FIRST,
          months: 6,
          monthlyFee: fee,
          billing,
          revisionsPerDeliverable: 2,
          shootDays: 1,
          deliverables: [{ name: "Reels", perMonth: 2, kind: "video" }],
          platforms: ["instagram"],
        })
        .expect(201)
    ).body as { id: string };
    await jana.post(`/agreements/${a.id}/sign-off`).expect(200);
    agreements[billing] = a.id;
  }
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("billing days", () => {
  const a = (billing: string) => ({ billing, startDate: new Date("2027-01-15T00:00:00Z"), endDate: new Date("2027-12-14T00:00:00Z") });
  it("follow each agreement's billing terms", () => {
    expect(billingDue(a("Monthly advance"), "2027-01-10")).toBeNull(); // not started yet
    expect(billingDue(a("Monthly advance"), "2027-01-15")).toEqual({ period: "2027-01", months: 1 });
    expect(billingDue(a("Monthly advance"), "2027-02-01")).toEqual({ period: "2027-02", months: 1 });
    expect(billingDue(a("Monthly arrears"), "2027-02-01")).toEqual({ period: "2027-01", months: 1 });
    expect(billingDue(a("Monthly arrears"), "2027-01-20")).toBeNull();
    expect(billingDue(a("Quarterly advance"), "2027-01-15")).toEqual({ period: "2027-01", months: 3 });
    expect(billingDue(a("Quarterly advance"), "2027-02-01")).toBeNull();
    expect(billingDue(a("Quarterly advance"), "2027-04-01")).toEqual({ period: "2027-04", months: 3 });
    expect(billingDue(a("Quarterly advance"), "2027-10-01")).toEqual({ period: "2027-10", months: 3 });
    expect(billingDue(a("50% advance"), "2027-01-15")).toBeNull(); // invoiced by hand
  });
});

describe("invoices drafted by themselves", () => {
  it("on each agreement's billing day, once, for finance to issue", async () => {
    await runner.tick(new Date(`${iso(new Date())}T03:00:00Z`));
    expect((await invoicesOf(agreements["Monthly advance"]!)).map((i) => i.period)).toEqual([M]);
    expect(await invoicesOf(agreements["Monthly arrears"]!)).toEqual([]); // billed after the month
    const [quarter] = await invoicesOf(agreements["Quarterly advance"]!);
    expect(quarter).toMatchObject({ period: M, status: "draft" });
    expect(quarter!.lines[0]).toMatchObject({ quantity: 3, rate: 10000, description: expect.stringContaining(" to ") });

    await runner.tick(new Date(`${NEXT}-01T03:00:00Z`));
    await runner.tick(new Date(`${NEXT}-01T04:00:00Z`));
    expect((await invoicesOf(agreements["Monthly advance"]!)).map((i) => i.period).sort()).toEqual([M, NEXT]);
    expect((await invoicesOf(agreements["Monthly arrears"]!)).map((i) => i.period)).toEqual([M]);
    expect(await invoicesOf(agreements["Quarterly advance"]!)).toHaveLength(1);
    const n = (await anitha.get("/notifications").expect(200)).body.items as { kind: string }[];
    expect(n.filter((x) => x.kind === "invoice_to_issue").length).toBeGreaterThanOrEqual(4);
  });

  it("not when the agency switches it off", async () => {
    await t.sql(`UPDATE invoice_settings SET auto_draft = false`);
    await t.sql(`DELETE FROM invoices WHERE agreement_id = $1 AND period = $2`, [agreements["Monthly advance"], NEXT]);
    await runner.tick(new Date(`${NEXT}-02T03:00:00Z`));
    expect((await invoicesOf(agreements["Monthly advance"]!)).map((i) => i.period)).toEqual([M]);
    await t.sql(`UPDATE invoice_settings SET auto_draft = true`);
  });
});

describe("what clients owe", () => {
  it("shows each client's unpaid invoices by how late they are, with who to remind", async () => {
    const [draft] = await invoicesOf(agreements["Monthly advance"]!);
    const issued = (await anitha.post(`/invoices/${draft!.id}/issue`).send({}).expect(200)).body as Invoice;
    await divya.get("/collections/ageing").expect(403);
    let r = (await anitha.get("/collections/ageing").expect(200)).body as AgeingReport;
    let mine = r.clients.find((c) => c.client.code === "TRT")!;
    expect(mine).toMatchObject({ contact: { name: "Lakshmi", phone: "+91 98400 99009" }, buckets: { notDue: issued.total, total: issued.total } });

    await t.sql(`UPDATE invoices SET due_date = $1 WHERE id = $2`, [iso(new Date(Date.now() - 45 * 86_400_000)), issued.id]);
    r = (await anitha.get("/collections/ageing").expect(200)).body as AgeingReport;
    mine = r.clients.find((c) => c.client.code === "TRT")!;
    expect(mine.buckets).toMatchObject({ notDue: 0, d31to60: issued.total });
    expect(mine.invoices[0]).toMatchObject({ number: issued.number, balance: issued.total, daysOverdue: 45 });
    expect(r.totals.d31to60).toBeGreaterThanOrEqual(issued.total);
  });
});

describe("the month's money", () => {
  it("adds up what was contracted, invoiced, collected and spent", async () => {
    await divya.get("/finance/months").expect(403);
    const before = ((await anitha.get(`/finance/months?from=${M}&to=${M}`).expect(200)).body as FinanceMonthRow[])[0]!;
    expect(before.contracted).toBeGreaterThanOrEqual(60000); // the three Trichy agreements, and others
    const [draft] = await invoicesOf(agreements["Quarterly advance"]!);
    const issued = (await anitha.post(`/invoices/${draft!.id}/issue`).send({}).expect(200)).body as Invoice;
    await anitha
      .post(`/invoices/${issued.id}/paid`)
      .send({ paidOn: iso(new Date()), note: "NEFT" })
      .expect(200);
    const after = ((await anitha.get(`/finance/months?from=${M}&to=${M}`).expect(200)).body as FinanceMonthRow[])[0]!;
    expect(after.invoiced - before.invoiced).toBe(issued.taxable);
    expect(after.collected - before.collected).toBe(issued.total);
    expect(after.margin).toBe(after.earned - after.costs);
    expect(after.closed).toBe(false);
    const six = (await anitha.get("/finance/months").expect(200)).body as FinanceMonthRow[];
    expect(six.map((m) => m.month)[0]).toBe(M);
    expect(six).toHaveLength(6);
  });

  it("is closed once a month has ended: its figures stay, and nothing dated in it changes until it is reopened", async () => {
    await anitha.post(`/finance/months/${M}/close`).expect(409); // not ended yet
    await divya.post(`/finance/months/${PREV}/close`).expect(403);
    const closed = (await anitha.post(`/finance/months/${PREV}/close`).expect(200)).body as FinanceMonthRow;
    expect(closed).toMatchObject({ month: PREV, closed: true, closedBy: "Anitha Rajan" });
    await anitha.post(`/finance/months/${PREV}/close`).expect(409);

    const late = `${PREV}-20`;
    const refused = await divya.post("/expenses").send({ date: late, category: "Travel", description: "Old cab bill", amount: 400 }).expect(409);
    expect(refused.body.message).toMatch(/is closed — finance reopens it/);
    // Time too: a video's time dated in the closed month.
    const v = (
      await ashwin
        .post("/videos")
        .send({ clientId, title: "Silk weaving", format: "Reel", dueDate: `${M}-25`, editorId: seedUserId("divya@geniemagnet.test") })
        .expect(201)
    ).body as { id: string };
    await divya.post(`/videos/${v.id}/move`).send({ to: "shot" }).expect(200);
    await divya.put(`/videos/${v.id}/protect`).send({ done: true }).expect(200);
    await divya.post(`/videos/${v.id}/move`).send({ to: "editing" }).expect(200);
    await divya.post(`/videos/${v.id}/time`).send({ date: late, minutes: 60 }).expect(409);
    await divya
      .post(`/videos/${v.id}/time`)
      .send({ date: iso(new Date()), minutes: 60 })
      .expect(201);

    await anitha.post(`/finance/months/${PREV}/reopen`).send({ reason: "" }).expect(400);
    const open = (await anitha.post(`/finance/months/${PREV}/reopen`).send({ reason: "A late cab bill" }).expect(200)).body as FinanceMonthRow;
    expect(open.closed).toBe(false);
    await divya.post("/expenses").send({ date: late, category: "Travel", description: "Old cab bill", amount: 400 }).expect(201);
  });

  it("belongs to its agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect(((await zara.get("/collections/ageing").expect(200)).body as AgeingReport).clients.some((c) => c.client.code === "TRT")).toBe(false);
  });
});
