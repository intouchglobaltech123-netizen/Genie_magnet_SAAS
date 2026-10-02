// Invoice settings and GST invoices (P1-20), on the sample agencies.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatInvoiceNumber, type Invoice, type InvoiceSettings } from "@gm/shared";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner
let ashwin: Agent; // manager: drafts invoices, cannot issue them
let anitha: Agent; // finance: issues invoices and keeps the invoice details
let priya: Agent; // team leader: no access to invoices
const ids: Record<string, string> = {};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = iso(new Date());
const month = today.slice(0, 7);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000));
const plusDays = (d: string, n: number) => iso(new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000));

/** A running agreement for a seeded client, starting this month. */
async function agreementFor(code: string, monthlyFee: number) {
  const clients = (await jana.get("/clients").expect(200)).body as { id: string; code: string }[];
  const clientId = clients.find((c) => c.code === code)!.id;
  const a = (
    await jana
      .post(`/clients/${clientId}/agreements`)
      .send({
        title: `${code} · retainer`,
        startDate: `${month}-01`,
        months: 12,
        monthlyFee,
        billing: "Monthly advance",
        revisionsPerDeliverable: 2,
        shootDays: 1,
        deliverables: [{ name: "Reels", perMonth: 8, kind: "video" }],
      })
      .expect(201)
  ).body;
  await jana.post(`/agreements/${a.id}/sign-off`).expect(200);
  return { clientId, agreementId: a.id as string };
}

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, anitha, priya] = await Promise.all(["jana", "ashwin", "anitha", "priya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  Object.assign(ids, Object.fromEntries(Object.entries(await agreementFor("KVR", 85000)).map(([k, v]) => [`kvr.${k}`, v])));
  Object.assign(ids, Object.fromEntries(Object.entries(await agreementFor("BPA", 30000)).map(([k, v]) => [`bpa.${k}`, v])));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("invoice settings", () => {
  it("are kept by finance and settings editors, and hidden from roles without invoices", async () => {
    const s = (await anitha.get("/invoice-settings").expect(200)).body as InvoiceSettings;
    expect(s).toMatchObject({
      legalName: "Genie Magnet Media LLP",
      state: "33",
      numberFormat: "GM/{FY}/{0000}",
      nextNumberPreview: formatInvoiceNumber("GM/{FY}/{0000}", 1, today),
    });
    await priya.get("/invoice-settings").expect(403);
    await priya.get("/invoices").expect(403);

    const { nextNumber: _n, nextNumberPreview: _p, ...body } = s;
    await anitha
      .put("/invoice-settings")
      .send({ ...body, paymentTermsDays: 10 })
      .expect(200);
    await ashwin
      .put("/invoice-settings")
      .send({ ...body, paymentTermsDays: 7 })
      .expect(200);
    const res = await anitha
      .put("/invoice-settings")
      .send({ ...body, state: "29" })
      .expect(400);
    expect(res.body.issues).toEqual([{ path: "state", message: "The GSTIN is registered in another state" }]);
  });

  it("keep the bank account number out of the audit log", async () => {
    const s = (await anitha.get("/invoice-settings").expect(200)).body as InvoiceSettings;
    const { nextNumber: _n, nextNumberPreview: _p, ...body } = s;
    await anitha
      .put("/invoice-settings")
      .send({ ...body, accountNumber: "123456789012" })
      .expect(200);
    const [entry] = (await jana.get("/audit?entity=invoice_settings&limit=1").expect(200)).body.items;
    expect(entry.after).toEqual({ accountNumber: "…9012" });
  });
});

describe("invoices", () => {
  let kvr: Invoice;
  let bpa: Invoice;

  it("are drafted for a month of an agreement, with CGST and SGST within the state", async () => {
    kvr = (await ashwin.post(`/agreements/${ids["kvr.agreementId"]}/invoices`).send({ period: month }).expect(201)).body;
    expect(kvr).toMatchObject({
      status: "draft",
      number: null,
      intraState: true,
      registered: true,
      taxable: 85000,
      cgst: 7650,
      sgst: 7650,
      igst: 0,
      total: 100300,
    });
    expect(kvr.totalInWords).toBe("Rupees one lakh three hundred only");
    expect(kvr.lines[0]).toMatchObject({ sac: "999612", taxRate: 18, quantity: 1, rate: 85000 });
    const again = await ashwin.post(`/agreements/${ids["kvr.agreementId"]}/invoices`).send({ period: month }).expect(409);
    expect(again.body.message).toMatch(/already a draft/);
  });

  it("charge IGST to a client in another state", async () => {
    bpa = (await ashwin.post(`/agreements/${ids["bpa.agreementId"]}/invoices`).send({ period: month }).expect(201)).body;
    expect(bpa).toMatchObject({ intraState: false, placeOfSupply: "29", cgst: 0, sgst: 0, igst: 5400, total: 35400 });
  });

  it("change only while a draft", async () => {
    const changed = (
      await ashwin
        .patch(`/invoices/${kvr.id}`)
        .send({
          lines: [...kvr.lines.map(({ amount: _a, ...l }) => l), { description: "Extra shoot day", sac: "999612", quantity: 1, rate: 5000, taxRate: 18 }],
        })
        .expect(200)
    ).body as Invoice;
    expect(changed).toMatchObject({ taxable: 90000, cgst: 8100, sgst: 8100, total: 106200 });
  });

  it("are issued by someone who may approve them: numbered in order, due after the payment terms", async () => {
    await ashwin.post(`/invoices/${kvr.id}/issue`).send({}).expect(403);
    const first = (await anitha.post(`/invoices/${kvr.id}/issue`).send({}).expect(200)).body as Invoice;
    expect(first).toMatchObject({ status: "sent", number: formatInvoiceNumber("GM/{FY}/{0000}", 1, today), issueDate: today, dueDate: plusDays(today, 7) });
    expect(first.billedTo).toMatchObject({ name: "Kaveri Organics LLP", gstin: "33AAKFK4821M1Z5", state: "33" });
    const second = (await anitha.post(`/invoices/${bpa.id}/issue`).send({}).expect(200)).body as Invoice;
    expect(second.number).toBe(formatInvoiceNumber("GM/{FY}/{0000}", 2, today));

    await anitha.patch(`/invoices/${kvr.id}`).send({ notes: "x" }).expect(409);
    await anitha.post(`/invoices/${kvr.id}/issue`).send({}).expect(409);
    await anitha.delete(`/invoices/${kvr.id}`).expect(409);
  });

  it("keep the client's details as they were when issued", async () => {
    await jana.patch(`/clients/${ids["kvr.clientId"]}`).send({ legalName: "Kaveri Organics Pvt Ltd" }).expect(200);
    expect(((await jana.get(`/invoices/${kvr.id}`).expect(200)).body as Invoice).billedTo.name).toBe("Kaveri Organics LLP");
  });

  it("carry on from a starting number set in the settings", async () => {
    const s = (await anitha.get("/invoice-settings").expect(200)).body as InvoiceSettings;
    const { nextNumberPreview: _p, ...body } = s;
    await anitha
      .put("/invoice-settings")
      .send({ ...body, nextNumber: 137 })
      .expect(200);
    const draft = (
      await ashwin
        .post("/invoices")
        .send({ clientId: ids["kvr.clientId"], lines: [{ description: "Festive ad film", sac: "999612", quantity: 1, rate: 40000, taxRate: 18 }] })
        .expect(201)
    ).body as Invoice;
    const issued = (
      await anitha
        .post(`/invoices/${draft.id}/issue`)
        .send({ issueDate: daysAgo(30) })
        .expect(200)
    ).body as Invoice;
    expect(issued.number).toBe(formatInvoiceNumber("GM/{FY}/{0000}", 137, daysAgo(30)));
    // Issued a month ago with 7 days to pay: overdue now.
    expect(issued.overdue).toBe(true);
    const overdue = (await jana.get("/invoices?overdue=1").expect(200)).body as Invoice[];
    expect(overdue.map((i) => i.id)).toEqual([draft.id]);
  });

  it("are marked as paid, not before they were issued", async () => {
    const res = await ashwin
      .post(`/invoices/${kvr.id}/paid`)
      .send({ paidOn: daysAgo(400) })
      .expect(400);
    expect(res.body.issues[0].path).toBe("paidOn");
    const paid = (await ashwin.post(`/invoices/${kvr.id}/paid`).send({ paidOn: today, note: "UPI ref 6612" }).expect(200)).body;
    expect(paid).toMatchObject({ status: "paid", paidOn: today, paymentNote: "UPI ref 6612" });
    await anitha.post(`/invoices/${kvr.id}/cancel`).send({ reason: "Mistake" }).expect(409);
  });

  it("are cancelled with a reason, keeping their number; the month can then be invoiced again", async () => {
    await ashwin.post(`/invoices/${bpa.id}/cancel`).send({ reason: "Wrong amount" }).expect(403);
    const cancelled = (await anitha.post(`/invoices/${bpa.id}/cancel`).send({ reason: "Wrong amount" }).expect(200)).body as Invoice;
    expect(cancelled).toMatchObject({
      status: "cancelled",
      number: bpa.number ?? formatInvoiceNumber("GM/{FY}/{0000}", 2, today),
      cancelReason: "Wrong amount",
    });
    const redo = (await ashwin.post(`/agreements/${ids["bpa.agreementId"]}/invoices`).send({ period: month }).expect(201)).body as Invoice;
    await ashwin.delete(`/invoices/${redo.id}`).expect(204);
  });

  it("refuse a month outside the agreement, and a draft agreement", async () => {
    const res = await ashwin.post(`/agreements/${ids["kvr.agreementId"]}/invoices`).send({ period: "2001-01" }).expect(400);
    expect(res.body.issues[0].path).toBe("period");
  });

  it("are listed per client, and stop the client being deleted", async () => {
    const list = (await jana.get(`/invoices?clientId=${ids["kvr.clientId"]}`).expect(200)).body as Invoice[];
    expect(list.map((i) => i.status).sort()).toEqual(["paid", "sent"]);
    expect((await jana.get(`/clients/${ids["kvr.clientId"]}`).expect(200)).body.canDelete).toBe(false);
  });
});

describe("an agency without invoice settings or a GSTIN", () => {
  it("cannot issue until it sets them up, and then charges no GST without a GSTIN", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    // Not set up yet: an empty answer, which the web app reads as null.
    expect((await zara.get("/invoice-settings").expect(200)).text).toBe("");
    const clients = (await zara.get("/clients").expect(200)).body as { id: string; code: string }[];
    const draft = (
      await zara
        .post("/invoices")
        .send({
          clientId: clients.find((c) => c.code === "MBC")!.id,
          lines: [{ description: "Reels for October", sac: "998361", quantity: 4, rate: 6000, taxRate: 18 }],
        })
        .expect(201)
    ).body as Invoice;
    const refused = await zara.post(`/invoices/${draft.id}/issue`).send({}).expect(409);
    expect(refused.body.message).toMatch(/invoice details first/);

    await zara
      .put("/invoice-settings")
      .send({
        legalName: "Zen Studio",
        gstin: "",
        state: "33",
        address: "4 Beach Road, Chennai 600001",
        services: [{ name: "Content", sac: "998361", rate: 18 }],
        numberFormat: "ZEN-{0000}",
        paymentTermsDays: 15,
      })
      .expect(200);
    const issued = (await zara.post(`/invoices/${draft.id}/issue`).send({}).expect(200)).body as Invoice;
    expect(issued).toMatchObject({ number: "ZEN-0001", registered: false, taxable: 24000, cgst: 0, sgst: 0, igst: 0, total: 24000 });

    // And Genie Magnet's invoices stay out of sight.
    expect(((await zara.get("/invoices").expect(200)).body as Invoice[]).map((i) => i.number)).toEqual(["ZEN-0001"]);
    await zara.get(`/invoices/${ids["kvr.agreementId"]}`).expect(404);
  });
});
