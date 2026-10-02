// Payroll (P5-09): salaries in parts and the agency's own deductions, seen only by those who may see salaries; the
// month's run worked out from attendance and leave, adjusted and locked; payslips for each person; the bank sheet.
// The rates below are made up for the tests — the app never assumes any.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ImportResult, LeaveTypeRow, PayrollRunRow, PayrollSettings, PayslipRow, SalaryRow } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner: salaries
let harini: Agent; // HR: attendance and leave, no salaries
let anitha: Agent; // finance: no salaries
let divya: Agent; // editor
let run: PayrollRunRow;
const DIVYA = seedUserId("divya@geniemagnet.test");
const SURYA = seedUserId("surya@geniemagnet.test");

// Last month, and its working days (Sunday is the weekly off).
const now = new Date();
const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const M = first.toISOString().slice(0, 7);
const D = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
const WD = Array.from({ length: D }, (_, i) => new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), i + 1)))
  .filter((d) => d.getUTCDay() !== 0)
  .map((d) => d.toISOString().slice(0, 10));
const paid = (amount: number, lop: number) => Math.round((amount * (D - lop)) / D);

beforeAll(async () => {
  t = await startSeededApp();
  [jana, harini, anitha, divya] = await Promise.all(["jana", "harini", "anitha", "divya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("salaries and payroll rules", () => {
  it("are for those who may see salaries — the owner by default — and the audit log never shows amounts", async () => {
    for (const who of [harini, anitha, divya]) await who.get("/payroll/salaries").expect(403);
    await harini.put("/payroll/settings").send({ deductions: [] }).expect(403);
    expect((await jana.get("/payroll/settings").expect(200)).body).toEqual({ dayBasis: "calendar", latesPerHalfDay: null, deductions: [] });

    const rules = (
      await jana
        .put("/payroll/settings")
        .send({
          dayBasis: "calendar",
          latesPerHalfDay: 3,
          deductions: [
            { name: "Provident fund", kind: "percent", of: ["Basic"], percent: 12, ceiling: 15000 },
            { name: "Provident fund (agency)", kind: "percent", of: ["Basic"], percent: 12, ceiling: 15000, employer: true },
            {
              name: "Professional tax",
              kind: "slabs",
              slabs: [
                { upTo: 21000, amount: 0 },
                { upTo: null, amount: 208 },
              ],
            },
            { name: "Income tax", kind: "each_person" },
          ],
        })
        .expect(200)
    ).body as PayrollSettings;
    expect(rules.deductions.map((d) => d.name)).toEqual(["Provident fund", "Provident fund (agency)", "Professional tax", "Income tax"]);

    await jana
      .put(`/payroll/salaries/${DIVYA}`)
      .send({
        from: "2025-04-01",
        earnings: [
          { name: "Basic", amount: 20000 },
          { name: "House rent allowance", amount: 8000 },
          { name: "Special allowance", amount: 2000 },
        ],
      })
      .expect(200);
    await jana
      .put(`/payroll/salaries/${SURYA}`)
      .send({ from: "2025-04-01", earnings: [{ name: "Consolidated", amount: 18000 }] })
      .expect(200);
    await jana
      .put(`/payroll/salaries/${SURYA}`)
      .send({
        from: "2025-04-01",
        earnings: [
          { name: "Basic", amount: 1 },
          { name: "basic", amount: 2 },
        ],
      })
      .expect(400);
    const rows = (await jana.get("/payroll/salaries").expect(200)).body as SalaryRow[];
    expect(rows.find((r) => r.user.id === DIVYA)!.current).toMatchObject({ from: "2025-04-01", total: 30000 });
    expect(rows.find((r) => r.user.id === seedUserId("meena@geniemagnet.test"))!.current).toBeNull();

    const logged = await t.sql<{ after: unknown }>(`SELECT after FROM audit_logs WHERE entity = 'salary'`);
    expect(logged).toHaveLength(2);
    expect(JSON.stringify(logged)).not.toMatch(/20000|18000/);
  });
});

describe("the month's run", () => {
  it("is worked out from attendance and leave: absences, half days, lateness by the agency's rule and unpaid leave", async () => {
    await harini.put(`/people/${DIVYA}`).send({ employeeCode: "GM101", designation: "Video Editor" }).expect(200);
    // Divya's first 12 working days: two absent, a half day and three late days.
    const rows = WD.slice(0, 12)
      .map((date, i) => {
        if (i === 3 || i === 7) return null;
        if (i === 4) return { employee: "GM101", date, firstIn: "09:30", lastOut: "12:00" };
        if (i === 5 || i === 6 || i === 8) return { employee: "GM101", date, firstIn: "10:00", lastOut: "19:00" };
        return { employee: "GM101", date, firstIn: "09:20", lastOut: "18:30" };
      })
      .filter((r) => r !== null);
    const imported = (await harini.post("/imports/attendance").send({ fileName: "last-month.csv", rows }).expect(201)).body as ImportResult;
    expect(imported.created).toBe(10);

    // A day of unpaid leave after the export's last day, which does not make the day between absent.
    const types = (await divya.get("/leave/types").expect(200)).body as LeaveTypeRow[];
    const unpaid = types.find((x) => !x.paid)!;
    const leave = (await divya.post("/leave").send({ typeId: unpaid.id, from: WD[13], to: WD[13], reason: "Personal work" }).expect(201)).body as {
      id: string;
    };
    await harini.post(`/leave/${leave.id}/decision`).send({ approved: true }).expect(200);

    await harini.post("/payroll/runs").send({ month: M }).expect(403);
    const future = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
    await jana.post("/payroll/runs").send({ month: future }).expect(400);
    run = (await jana.post("/payroll/runs").send({ month: M }).expect(201)).body as PayrollRunRow;
    await jana.post("/payroll/runs").send({ month: M }).expect(409);
    expect(run).toMatchObject({ status: "draft", people: 2 });
    expect(run.notes).toEqual([expect.stringMatching(/^No salary set for .*Janarthanan.* — left out\.$/)]);

    const d = run.payslips!.find((p) => p.user.id === DIVYA)!;
    expect(d.days).toMatchObject({ basis: D, employed: D, absent: 2, halfDays: 1, lates: 3, latePenalty: 0.5, unpaidLeave: 1, lop: 4, paid: D - 4 });
    expect(d.earnings).toEqual([
      { name: "Basic", amount: 20000, paid: paid(20000, 4) },
      { name: "House rent allowance", amount: 8000, paid: paid(8000, 4) },
      { name: "Special allowance", amount: 2000, paid: paid(2000, 4) },
    ]);
    const gross = paid(20000, 4) + paid(8000, 4) + paid(2000, 4);
    expect(d.deductions).toEqual([
      { name: "Provident fund", amount: 1800 },
      { name: "Professional tax", amount: 208 },
    ]);
    expect(d.contributions).toEqual([{ name: "Provident fund (agency)", amount: 1800 }]);
    expect(d).toMatchObject({ employeeCode: "GM101", designation: "Video Editor", gross, net: gross - 2008 });

    const s = run.payslips!.find((p) => p.user.id === SURYA)!;
    expect(s).toMatchObject({ gross: 18000, deductions: [], net: 18000 });
    expect(s.notes[0]).toBe("No attendance this month: paid for every day unless you add days without pay.");
    await harini.get(`/payroll/runs/${M}`).expect(403);
  });

  it("is adjusted by payroll and locked; each person then sees their own payslip", async () => {
    await jana
      .put(`/payroll/runs/${M}/payslips/${SURYA}`)
      .send({ adjustments: [{ name: "Advance recovered", amount: -30000 }] })
      .expect(200);
    expect((await jana.post(`/payroll/runs/${M}/lock`).expect(409)).body.message).toBe(
      "Net pay is below zero for Surya Prakash — change their payslips first.",
    );
    run = (
      await jana
        .put(`/payroll/runs/${M}/payslips/${SURYA}`)
        .send({ adjustments: [{ name: "Festival bonus", amount: 2000 }], entries: { "Income tax": 500 }, extraLop: 1 })
        .expect(200)
    ).body as PayrollRunRow;
    const s = run.payslips!.find((p) => p.user.id === SURYA)!;
    expect(s).toMatchObject({ gross: paid(18000, 1), deductions: [{ name: "Income tax", amount: 500 }], net: paid(18000, 1) - 500 + 2000 });

    expect((await divya.get("/payslips").expect(200)).body).toEqual([]);
    await anitha.post(`/payroll/runs/${M}/lock`).expect(403);
    run = (await jana.post(`/payroll/runs/${M}/lock`).expect(200)).body as PayrollRunRow;
    expect(run).toMatchObject({ status: "locked", lockedBy: "Janarthanan" });
    await jana.put(`/payroll/runs/${M}/payslips/${SURYA}`).send({ extraLop: 0 }).expect(409);

    const mine = (await divya.get("/payslips").expect(200)).body as PayslipRow[];
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ month: M, user: { id: DIVYA }, netInWords: expect.stringMatching(/^Rupees .* only$/) });
    await divya.get(`/payslips/${s.id}`).expect(404);
    const n = (await divya.get("/notifications").expect(200)).body.items as { kind: string; link: string }[];
    expect(n.find((x) => x.kind === "payslip_ready")).toMatchObject({ link: `/app/payslips/${mine[0]!.id}` });
  });

  it("keeps the attendance it was paid on while it is locked", async () => {
    const refused = await harini
      .post("/imports/attendance")
      .send({ fileName: "late.csv", rows: [{ employee: "GM101", date: WD[3], firstIn: "09:20", lastOut: "18:00" }] })
      .expect(409);
    expect(refused.body.message).toMatch(/^Payroll for .* is locked — unlock it before its attendance changes\.$/);
    await divya.post("/attendance/corrections").send({ date: WD[7], firstIn: "09:15", lastOut: "18:00", reason: "Forgot to punch" }).expect(201);
    const [c] = (await harini.get("/attendance/corrections?state=pending").expect(200)).body as { id: string }[];
    await harini.post(`/attendance/corrections/${c!.id}/decision`).send({ approved: true }).expect(409);
  });

  it("gives the bank's transfer sheet to those who approve payroll, saying who has no account", async () => {
    await jana.put(`/people/${DIVYA}/bank`).send({ bankAccount: "123456789012", ifsc: "SBIN0001234" }).expect(200);
    await anitha.get(`/payroll/runs/${M}/bank-sheet`).expect(403);
    const sheet = (await jana.get(`/payroll/runs/${M}/bank-sheet`).expect(200)).body as { fileName: string; csv: string; missing: string[] };
    const divyaNet = run.payslips!.find((p) => p.user.id === DIVYA)!.net;
    expect(sheet.fileName).toBe(`salaries-${M}.csv`);
    expect(sheet.csv.split("\n")[0]).toBe("Name,Employee code,Account number,IFSC,Net pay");
    expect(sheet.csv).toContain(`Divya Lakshmi,GM101,123456789012,SBIN0001234,${divyaNet}`);
    expect(sheet.missing).toEqual(["Surya Prakash"]);
  });

  it("is unlocked with a reason and worked out again, keeping what payroll entered", async () => {
    await jana.post(`/payroll/runs/${M}/unlock`).send({}).expect(400);
    await jana.post(`/payroll/runs/${M}/unlock`).send({ reason: "Divya's missed punch" }).expect(200);
    const [c] = (await harini.get("/attendance/corrections?state=pending").expect(200)).body as { id: string }[];
    await harini.post(`/attendance/corrections/${c!.id}/decision`).send({ approved: true }).expect(200);
    run = (await jana.post(`/payroll/runs/${M}/refresh`).expect(200)).body as PayrollRunRow;
    expect(run.payslips!.find((p) => p.user.id === DIVYA)!.days).toMatchObject({ absent: 1, lop: 3 });
    expect(run.payslips!.find((p) => p.user.id === SURYA)).toMatchObject({ adjustments: [{ name: "Festival bonus", amount: 2000 }], extraLop: 1 });
    const history = (await jana.get("/audit?entity=payroll").expect(200)).body.items as { action: string; after: { reason?: string } }[];
    expect(history.find((h) => h.action === "reopen")!.after.reason).toBe("Divya's missed punch");
  });

  it("belongs to its agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get("/payroll/runs").expect(200)).body).toEqual([]);
    await zara.get(`/payslips/${run.payslips![0]!.id}`).expect(404);
    await zara.get(`/payroll/runs/${M}`).expect(404);
  });
});
