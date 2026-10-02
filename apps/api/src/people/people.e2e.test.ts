// People (P5-06 to P5-08): employee records kept by HR with payroll's details encrypted, attendance imported from the
// agency's own export and read by its own rules, corrections, and leave with clashes and balances.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AttendanceMonth, EmployeeRow, ImportResult, LeaveBalanceRow, LeaveRequestRow, LeaveTypeRow } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner: payroll
let ashwin: Agent; // manager
let harini: Agent; // HR: attendance, leave and hiring (approve)
let divya: Agent; // editor
let surya: Agent; // editor
let importId: string;
let casual: LeaveTypeRow;
let leave: LeaveRequestRow;
const DIVYA = seedUserId("divya@geniemagnet.test");
const SURYA = seedUserId("surya@geniemagnet.test");
const NEXT_YEAR = new Date().getUTCFullYear() + 1;
// A Monday and Tuesday next year, for leave.
const firstMonday = (() => {
  const d = new Date(Date.UTC(NEXT_YEAR, 1, 1));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d;
})();
const MON = firstMonday.toISOString().slice(0, 10);
const TUE = new Date(firstMonday.getTime() + 86_400_000).toISOString().slice(0, 10);
const SUN = new Date(firstMonday.getTime() - 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, harini, divya, surya] = await Promise.all(["jana", "ashwin", "harini", "divya", "surya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("employee records", () => {
  it("are kept by HR, with departments; each person sees their own", async () => {
    const deps = (await harini.post("/people/departments").send({ name: "Post-production" }).expect(201)).body as { id: string; name: string }[];
    await harini.post("/people/departments").send({ name: "Post-production" }).expect(409);
    const post = deps.find((d) => d.name === "Post-production")!;
    await surya.put(`/people/${DIVYA}`).send({ employeeCode: "GM007" }).expect(403);
    const row = (
      await harini
        .put(`/people/${DIVYA}`)
        .send({ employeeCode: "GM007", departmentId: post.id, designation: "Senior Video Editor", joiningDate: "2024-06-03", phone: "98400 70007" })
        .expect(200)
    ).body as EmployeeRow;
    expect(row).toMatchObject({ employeeCode: "GM007", department: { name: "Post-production" }, joiningDate: "2024-06-03" });
    await harini.put(`/people/${SURYA}`).send({ employeeCode: "GM007" }).expect(409);
    await harini.put(`/people/${SURYA}`).send({ employeeCode: "GM008" }).expect(200);
    expect(((await divya.get("/people").expect(200)).body as EmployeeRow[]).map((r) => r.user.id)).toEqual([DIVYA]);
    expect(((await harini.get("/people").expect(200)).body as EmployeeRow[]).length).toBeGreaterThan(5);
  });

  it("keep bank account and PAN encrypted, for payroll and the person only", async () => {
    await harini.put(`/people/${DIVYA}/bank`).send({ bankAccount: "123456789012" }).expect(403);
    const row = (await jana.put(`/people/${DIVYA}/bank`).send({ bankAccount: "123456789012", ifsc: "sbin0001234", pan: "abcde1234f" }).expect(200))
      .body as EmployeeRow;
    expect(row.bank).toEqual({ account: "…9012", ifsc: "SBIN0001234", pan: "…234F", uan: null, esiNumber: null });
    expect(((await harini.get(`/people/${DIVYA}`).expect(200)).body as EmployeeRow).bank).toBeNull(); // HR is not payroll
    expect(((await divya.get(`/people/${DIVYA}`).expect(200)).body as EmployeeRow).bank).toMatchObject({ account: "…9012" });
    const [db] = await t.sql<{ bank_account: string; pan: string }>(`SELECT bank_account, pan FROM employee_profiles WHERE user_id = $1`, [DIVYA]);
    expect(db!.bank_account).toMatch(/^v1:/);
    expect(db!.pan).not.toContain("ABCDE");
    const [audit] = (await jana.get("/audit?entity=employee_bank&limit=1").expect(200)).body.items as object[];
    expect(JSON.stringify(audit)).not.toContain("123456789012");
  });
});

describe("attendance", () => {
  it("follows the agency's own rules", async () => {
    await divya
      .put("/attendance/settings")
      .send({ workdayStart: "09:30", lateAfter: 15, halfDayBelow: 240, weeklyOffs: [0], holidays: [] })
      .expect(403);
    await harini
      .put("/attendance/settings")
      .send({ workdayStart: "09:30", lateAfter: 15, halfDayBelow: 240, weeklyOffs: [0], holidays: [{ date: "2026-09-07", name: "Local festival" }] })
      .expect(200);
  });

  it("is imported from the attendance export, matching people by code, email or name", async () => {
    const bad = await harini
      .post("/imports/attendance")
      .send({
        fileName: "device.csv",
        rows: [
          { employee: "GM999", date: "2026-09-01", firstIn: "09:10", lastOut: "18:30" },
          { employee: "GM007", date: "2026-09-01", firstIn: "09:10" },
          { employee: "gm007", date: "2026-09-01", firstIn: "09:12" },
        ],
      })
      .expect(400);
    expect(bad.body.issues).toEqual([
      { path: "rows.0.employee", message: "No one in your team has this code, email or name" },
      { path: "rows.2.date", message: "Same person and day as row 3" },
    ]);
    await divya
      .post("/imports/attendance")
      .send({ fileName: "x.csv", rows: [{ employee: "GM007", date: "2026-09-01" }] })
      .expect(403);

    const r = (
      await harini
        .post("/imports/attendance")
        .send({
          fileName: "september.csv",
          lines: [2, 3, 4, 5, 6, 7, 8],
          fileRows: 15, // one row per punch, put together into days by the importer
          rows: [
            { employee: "GM007", date: "2026-09-01", firstIn: "09:10", lastOut: "18:30" },
            { employee: "GM007", date: "2026-09-02", firstIn: "09:55", lastOut: "18:40" },
            { employee: "GM007", date: "2026-09-03", firstIn: "09:20", lastOut: "12:05" },
            { employee: "GM007", date: "2026-09-05", firstIn: "09:25", lastOut: "17:30" },
            { employee: "GM007", date: "2026-09-08", firstIn: "09:05", lastOut: "18:00" },
            { employee: "surya@geniemagnet.test", date: "2026-09-01", firstIn: "10:30", lastOut: "19:00" },
            { employee: "Surya Prakash", date: "2026-09-06", firstIn: "11:00", lastOut: "15:00" },
          ],
        })
        .expect(201)
    ).body as ImportResult;
    importId = r.id;
    expect(Object.fromEntries(r.report.totals.map((x) => [x.label, x.value]))).toMatchObject({
      Days: "7",
      People: "2",
      Present: "3",
      Late: "3", // 11:00 to 15:00 is late; four hours is not under a half day
      "Half day": "1",
    });
    expect(r.report.notes.map((n) => n.text)).toEqual([expect.stringContaining("came in on 6 Sept 2026, a weekly off")]);
    expect(r.report).toMatchObject({ rows: 7, imported: 7, grouped: { fileRows: 15, into: "days" } });
  });

  it("shows each person's month: absences between imported days, weekly offs and holidays", async () => {
    const m = (await harini.get("/attendance?month=2026-09").expect(200)).body as AttendanceMonth;
    const d = m.people.find((p) => p.user.id === DIVYA)!;
    expect(Object.fromEntries(Object.entries(d.days).map(([k, v]) => [k, v.status]))).toEqual({
      "2026-09-01": "present",
      "2026-09-02": "late",
      "2026-09-03": "half_day",
      "2026-09-04": "absent",
      "2026-09-05": "present",
      "2026-09-08": "present",
    });
    expect(m.offDays).toContainEqual({ date: "2026-09-07", name: "Local festival" });
    expect(m.offDays).toContainEqual({ date: "2026-09-06", name: null });
    const mine = (await divya.get("/attendance?month=2026-09").expect(200)).body as AttendanceMonth;
    expect(mine.people.map((p) => p.user.id)).toEqual([DIVYA]);
  });

  it("is corrected when HR approves what the person asks, and a later import keeps the correction", async () => {
    await divya
      .post("/attendance/corrections")
      .send({ date: "2026-09-04", firstIn: "09:15", lastOut: "18:00", reason: "Field shoot at the client's farm" })
      .expect(201);
    const [c] = (await harini.get("/attendance/corrections?state=pending").expect(200)).body as { id: string }[];
    await divya.post(`/attendance/corrections/${c!.id}/decision`).send({ approved: true }).expect(403);
    await harini.post(`/attendance/corrections/${c!.id}/decision`).send({ approved: true }).expect(200);
    const n = (await divya.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.some((x) => x.kind === "leave_decided" && x.title === "Attendance for 2026-09-04 corrected")).toBe(true);

    const again = (
      await harini
        .post("/imports/attendance")
        .send({ fileName: "september-again.csv", rows: [{ employee: "GM007", date: "2026-09-04" }] })
        .expect(201)
    ).body as ImportResult;
    expect(again.report.notes[0]!.text).toMatch(/kept as HR corrected it/);
    const m = (await harini.get("/attendance?month=2026-09").expect(200)).body as AttendanceMonth;
    expect(m.people.find((p) => p.user.id === DIVYA)!.days["2026-09-04"]).toMatchObject({ status: "present", source: "correction" });
  });

  it("is undone with its import, leaving corrections", async () => {
    await harini.delete(`/imports/${importId}`).expect(200);
    const m = (await harini.get("/attendance?month=2026-09").expect(200)).body as AttendanceMonth;
    const days = m.people.find((p) => p.user.id === DIVYA)!.days;
    expect(days["2026-09-04"]).toMatchObject({ status: "present", source: "correction" });
    expect(Object.values(days).filter((d) => d.source === "import")).toEqual([]);
    expect(await t.sql(`SELECT 1 FROM attendance_records WHERE import_id = $1`, [importId])).toEqual([]);
  });
});

describe("leave", () => {
  it("starts from the usual kinds, which HR changes", async () => {
    const types = (await divya.get("/leave/types").expect(200)).body as LeaveTypeRow[];
    expect(types.map((x) => `${x.name}:${x.daysPerYear}:${x.paid}`)).toEqual(["Casual leave:12:true", "Sick leave:6:true", "Unpaid leave:0:false"]);
    const saved = (
      await harini
        .put("/leave/types")
        .send({
          types: [
            ...types.map((x) => ({ ...x, carryForward: x.name === "Casual leave" ? 5 : 0 })),
            { name: "Comp off", daysPerYear: 4, paid: true, carryForward: 0 },
          ],
        })
        .expect(200)
    ).body as LeaveTypeRow[];
    expect(saved.map((x) => x.name)).toEqual(["Casual leave", "Sick leave", "Unpaid leave", "Comp off"]);
    casual = saved[0]!;
  });

  it("is asked for, shows the work it clashes with, and is approved by HR — and shows on the attendance", async () => {
    await ashwin
      .post("/videos")
      .send({ clientId: (await ashwin.get("/clients").expect(200)).body[0].id, title: "Clash test", format: "Reel", dueDate: TUE, editorId: DIVYA })
      .expect(201);
    await divya.post("/leave").send({ typeId: casual.id, from: SUN, to: SUN, reason: "Family" }).expect(400); // a weekly off
    leave = (await divya.post("/leave").send({ typeId: casual.id, from: MON, to: TUE, reason: "Sister's wedding" }).expect(201)).body as LeaveRequestRow;
    expect(leave).toMatchObject({ status: "pending", days: 2 });
    await divya.post("/leave").send({ typeId: casual.id, from: TUE, to: TUE, reason: "Again" }).expect(409); // overlaps

    const waiting = (await harini.get("/leave?status=pending").expect(200)).body as LeaveRequestRow[];
    expect(waiting.find((x) => x.id === leave.id)!.clashes).toEqual([
      expect.objectContaining({ kind: "video", label: expect.stringMatching(/ due$/), date: TUE }),
    ]);
    await divya.post(`/leave/${leave.id}/decision`).send({ approved: true }).expect(403);
    await harini.post(`/leave/${leave.id}/decision`).send({ approved: false }).expect(400); // needs a reason
    await harini.post(`/leave/${leave.id}/decision`).send({ approved: true }).expect(200);
    const m = (await divya.get(`/attendance?month=${MON.slice(0, 7)}`).expect(200)).body as AttendanceMonth;
    expect(m.people[0]!.days[MON]).toMatchObject({ status: "leave" });
    expect(m.people[0]!.days[TUE]).toMatchObject({ status: "leave" });
  });

  it("keeps balances: what is left this year, with carried days", async () => {
    const [b] = (await divya.get(`/leave/balances?year=${NEXT_YEAR}`).expect(200)).body as LeaveBalanceRow[];
    expect(b!.types.find((x) => x.name === "Casual leave")).toMatchObject({ allowance: 12, carried: 5, taken: 2, pending: 0, left: 15 });
    expect(b!.types.find((x) => x.name === "Unpaid leave")).toMatchObject({ allowance: null, left: null });
    const too = await divya
      .post("/leave")
      .send({ typeId: casual.id, from: `${NEXT_YEAR}-06-01`, to: `${NEXT_YEAR}-06-30`, reason: "Long trip" })
      .expect(409);
    expect(too.body.message).toMatch(/^Only 15 days of Casual leave are left/);
    // A request that waits can be withdrawn.
    const mine = (
      await divya
        .post("/leave")
        .send({ typeId: casual.id, from: `${NEXT_YEAR}-06-02`, to: `${NEXT_YEAR}-06-02`, reason: "Errand" })
        .expect(201)
    ).body as LeaveRequestRow;
    await surya.post(`/leave/${mine.id}/cancel`).expect(404);
    expect(((await divya.post(`/leave/${mine.id}/cancel`).expect(200)).body as LeaveRequestRow).status).toBe("cancelled");
  });

  it("is decided by someone else when it is your own; the owner, with no one above, decides their own", async () => {
    const own = (
      await harini
        .post("/leave")
        .send({ typeId: casual.id, from: `${NEXT_YEAR}-07-06`, to: `${NEXT_YEAR}-07-06`, reason: "Errand" })
        .expect(201)
    ).body as LeaveRequestRow;
    const refused = await harini.post(`/leave/${own.id}/decision`).send({ approved: true }).expect(403);
    expect(refused.body.message).toBe("Someone else decides your own leave.");
    await jana.post(`/leave/${own.id}/decision`).send({ approved: true }).expect(200);

    await harini.post("/attendance/corrections").send({ date: "2026-09-09", firstIn: "09:00", lastOut: "18:00", reason: "Forgot to punch" }).expect(201);
    const [c] = (await harini.get("/attendance/corrections?state=pending").expect(200)).body as { id: string }[];
    await harini.post(`/attendance/corrections/${c!.id}/decision`).send({ approved: true }).expect(403);
    const boss = (
      await jana
        .post("/leave")
        .send({ typeId: casual.id, from: `${NEXT_YEAR}-07-07`, to: `${NEXT_YEAR}-07-07`, reason: "Errand" })
        .expect(201)
    ).body as LeaveRequestRow;
    await jana.post(`/leave/${boss.id}/decision`).send({ approved: true }).expect(200);
  });

  it("belongs to its agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect(((await zara.get("/people").expect(200)).body as EmployeeRow[]).some((r) => r.user.id === DIVYA)).toBe(false);
    expect(((await zara.get("/leave").expect(200)).body as LeaveRequestRow[]).some((r) => r.id === leave.id)).toBe(false);
    await zara.post(`/leave/${leave.id}/cancel`).expect(404);
  });
});
