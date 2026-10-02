// Phase 5 exit gate (P5-23): the agency runs the business on the system, as one story on the sample agency. HR imports
// last month's attendance from the agency's own export and approves leave, and the owner runs that month's payroll and
// locks it, each person then seeing their own payslip; an expense is allocated to a client's video and the true cost of
// the video and the client shows it; a 45-day strategic review is held with its Round Table, whose results are released,
// and the review is locked; the goals and the revenue cascade come from the agency questionnaire; and the business
// diagnostic and the Strategic Road Map are taken from it and published. Another agency sees none of it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type CascadeView,
  type ClientCostRow,
  DEFAULT_PRODUCTION_SETTINGS,
  type DiagnosticView,
  type ExpenseRow,
  type GoalRow,
  type ImportResult,
  type LeaveRequestRow,
  type LeaveTypeRow,
  type MeetingRow,
  type PayrollRunRow,
  type PayslipRow,
  type RoadMapRow,
  type RtFeedback,
  type RtSessionRow,
  type VideoCostRow,
} from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner: salaries and payroll
let ashwin: Agent; // manager: goals, reviews and the Round Table
let karthik: Agent; // team leader: the diagnostic and the road map
let harini: Agent; // HR: attendance and leave
let anitha: Agent; // finance: expenses and costing
let divya: Agent; // editor
let surya: Agent; // editor
let run: PayrollRunRow;
let videoId: string;
let rt: RtSessionRow;
let review: MeetingRow;
let year: GoalRow;
let leads: GoalRow;
const DIVYA = seedUserId("divya@geniemagnet.test");
const SURYA = seedUserId("surya@geniemagnet.test");
const KARTHIK = seedUserId("karthik@geniemagnet.test");

// Last month and its working days (Sunday is the weekly off); this month, for costing.
const now = new Date();
const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const LAST = first.toISOString().slice(0, 7);
const D = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
const WD = Array.from({ length: D }, (_, i) => new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), i + 1)))
  .filter((d) => d.getUTCDay() !== 0)
  .map((d) => d.toISOString().slice(0, 10));
const M = now.toISOString().slice(0, 7);
const TODAY = now.toISOString().slice(0, 10);
const day = (offset: number) => new Date(Date.now() + 330 * 60_000 + offset * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, karthik, harini, anitha, divya, surya] = await Promise.all(
    ["jana", "ashwin", "karthik", "harini", "anitha", "divya", "surya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)),
  );
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("people and payroll", () => {
  it("HR imports last month's attendance from the agency's export and approves leave", async () => {
    // The export: one row per person and day; Divya was away on the third working day.
    const rows = WD.flatMap((date, i) => [
      ...(i === 2 ? [] : [{ employee: "divya@geniemagnet.test", date, firstIn: "09:20", lastOut: "18:30" }]),
      { employee: "Surya Prakash", date, firstIn: "09:15", lastOut: "18:45" },
    ]);
    const imported = (
      await harini
        .post("/imports/attendance")
        .send({ fileName: `attendance-${LAST}.csv`, rows })
        .expect(201)
    ).body as ImportResult;
    expect(imported.created).toBe(rows.length);
    const casual = ((await divya.get("/leave/types").expect(200)).body as LeaveTypeRow[]).find((x) => x.name === "Casual leave")!;
    const leave = (await divya.post("/leave").send({ typeId: casual.id, from: WD[2], to: WD[2], reason: "Family function" }).expect(201))
      .body as LeaveRequestRow;
    await divya.post(`/leave/${leave.id}/decision`).send({ approved: true }).expect(403);
    await harini.post(`/leave/${leave.id}/decision`).send({ approved: true }).expect(200);
  });

  it("the owner runs that month's payroll from it and locks it; each person sees only their own payslip", async () => {
    // The agency's own rules and salaries — nothing statutory is assumed.
    await jana
      .put("/payroll/settings")
      .send({
        dayBasis: "calendar",
        latesPerHalfDay: null,
        deductions: [{ name: "Provident fund", kind: "percent", of: ["Basic"], percent: 12, ceiling: 15000 }],
      })
      .expect(200);
    await jana
      .put(`/payroll/salaries/${DIVYA}`)
      .send({
        from: "2025-04-01",
        earnings: [
          { name: "Basic", amount: 20000 },
          { name: "House rent allowance", amount: 8000 },
        ],
      })
      .expect(200);
    await jana
      .put(`/payroll/salaries/${SURYA}`)
      .send({
        from: "2025-04-01",
        earnings: [
          { name: "Basic", amount: 15000 },
          { name: "Special allowance", amount: 3000 },
        ],
      })
      .expect(200);
    await harini.post("/payroll/runs").send({ month: LAST }).expect(403);
    run = (await jana.post("/payroll/runs").send({ month: LAST }).expect(201)).body as PayrollRunRow;
    const d = run.payslips!.find((p) => p.user.id === DIVYA)!;
    expect(d.days).toMatchObject({ absent: 0, lop: 0, paid: D }); // the day away was approved leave
    expect(d).toMatchObject({ gross: 28000, deductions: [{ name: "Provident fund", amount: 1800 }], net: 26200 });
    expect(run.payslips!.find((p) => p.user.id === SURYA)).toMatchObject({ gross: 18000, net: 16200 });
    run = (await jana.post(`/payroll/runs/${LAST}/lock`).expect(200)).body as PayrollRunRow;
    expect(run).toMatchObject({ status: "locked", lockedBy: "Janarthanan" });
    const mine = (await divya.get("/payslips").expect(200)).body as PayslipRow[];
    expect(mine).toEqual([expect.objectContaining({ month: LAST, gross: 28000, net: 26200 })]);
    await divya.get(`/payslips/${run.payslips!.find((p) => p.user.id === SURYA)!.id}`).expect(404);
    // The attendance it was paid on stays as it was.
    await harini
      .post("/imports/attendance")
      .send({ fileName: "late-fix.csv", rows: [{ employee: "Surya Prakash", date: WD[0], firstIn: "11:00", lastOut: "18:00" }] })
      .expect(409);
  });
});

describe("true costing", () => {
  it("an expense allocated to a client's video shows in the true cost of the video and the client", async () => {
    await jana
      .put(`/costing/rates/${DIVYA}`)
      .send({ monthlyCost: 52800, hoursPerMonth: 176, effectiveFrom: `${M}-01` })
      .expect(200);
    const kaveri = ((await ashwin.get("/clients").expect(200)).body as { id: string; code: string }[]).find((c) => c.code === "KVR")!.id;
    videoId = (
      (
        await ashwin
          .post("/videos")
          .send({ clientId: kaveri, title: "Harvest festival reel", format: "Reel", dueDate: `${M}-27`, editorId: DIVYA })
          .expect(201)
      ).body as { id: string }
    ).id;
    await divya.post(`/videos/${videoId}/move`).send({ to: "shot" }).expect(200);
    await divya.put(`/videos/${videoId}/protect`).send({ done: true }).expect(200);
    await divya.post(`/videos/${videoId}/move`).send({ to: "editing" }).expect(200);
    await divya.post(`/videos/${videoId}/time`).send({ date: TODAY, minutes: 120, note: "Edit" }).expect(201);
    for (const step of DEFAULT_PRODUCTION_SETTINGS.editSteps) await divya.put(`/videos/${videoId}/edit-steps`).send({ step, done: true }).expect(200);
    const props = (
      await divya
        .post("/expenses")
        .send({
          date: TODAY,
          vendor: "Erode Flower Market",
          category: "Props and set",
          description: "Marigold garlands for the set",
          amount: 1200,
          gst: 0,
          videoId,
        })
        .expect(201)
    ).body as ExpenseRow;
    expect(props).toMatchObject({ status: "submitted", video: { id: videoId }, client: { id: kaveri } });
    await anitha.post(`/expenses/${props.id}/decision`).send({ approved: true }).expect(200);

    const v = ((await anitha.get(`/costing/videos?month=${M}`).expect(200)).body as VideoCostRow[]).find((r) => r.id === videoId)!;
    expect(v).toMatchObject({ client: { code: "KVR" }, labour: 600, expenses: 1200, hours: 2 }); // two hours at ₹300 an hour
    expect(v.total).toBe(v.labour + v.shoots + v.expenses + v.overhead);
    const c = ((await ashwin.get(`/costing/clients?month=${M}`).expect(200)).body as ClientCostRow[]).find((r) => r.client.code === "KVR")!;
    expect(c.expenses).toBeGreaterThanOrEqual(1200);
    expect(c.labour).toBeGreaterThanOrEqual(600);
    expect(c.margin).toBe(c.revenue - c.total);
  });
});

describe("the 45-day strategic review", () => {
  it("is held with its Round Table: timed rounds, moderated and released, each person reading what was said about them", async () => {
    review = (
      await ashwin
        .post("/reviews/meetings")
        .send({ cadence: "strategic", startsAt: new Date(Date.now() + 3_600_000).toISOString(), venue: "Studio" })
        .expect(201)
    ).body as MeetingRow;
    expect(review).toMatchObject({ title: "Strategic review #1", status: "scheduled" });
    rt = (
      await ashwin
        .post("/round-tables")
        .send({ name: "Strategic review — Round Table", meetingId: review.id, participantIds: [DIVYA, SURYA, KARTHIK], secondsPerPerson: 60 })
        .expect(201)
    ).body as RtSessionRow;
    expect(rt.meeting).toEqual({ id: review.id, title: "Strategic review #1" });
    rt = (await ashwin.post(`/round-tables/${rt.id}/start`).expect(200)).body as RtSessionRow;
    const said: Record<string, [string, string, string]> = {
      [DIVYA]: ["Clean, fast edits", "Misses the brief sometimes", "Read the brief twice"],
      [SURYA]: ["Patient with clients", "Slow on revisions", "Turn revisions in a day"],
      [KARTHIK]: ["Clear direction", "Too many meetings", "Fewer, shorter meetings"],
    };
    for (let round = 0; round < 3; round++) {
      const subject = rt.current!.subject.id;
      for (const who of [divya, surya, karthik]) await who.put(`/round-tables/${rt.id}/answer`).send({ answers: said[subject] }).expect(200);
      rt = (await ashwin.post(`/round-tables/${rt.id}/next`).expect(200)).body as RtSessionRow;
    }
    expect(rt.status).toBe("moderation");
    await divya.get(`/round-tables/${rt.id}/mine`).expect(409); // not released yet
    await ashwin.post(`/round-tables/${rt.id}/release`).expect(200);
    const mine = (await divya.get(`/round-tables/${rt.id}/mine`).expect(200)).body as RtFeedback;
    expect(mine.peers).toHaveLength(2);
    expect(JSON.stringify(mine)).not.toMatch(/Surya|Karthik/);
    expect(
      ((await divya.post(`/round-tables/${rt.id}/commitment`).send({ text: "Read every brief twice before cutting" }).expect(201)).body as RtFeedback)
        .commitment,
    ).toMatchObject({ text: "Read every brief twice before cutting" });
  });

  it("is run with notes and decisions, and locked with its figures kept", async () => {
    await ashwin
      .put(`/reviews/meetings/${review.id}`)
      .send({ notes: { "0": "Round Table held and released; commitments made" }, attendance: { [DIVYA]: "present", [SURYA]: "present", [KARTHIK]: "present" } })
      .expect(200);
    await ashwin.post("/decisions").send({ text: "Revisions are turned in within a day", ownerId: KARTHIK, meetingId: review.id }).expect(201);
    review = (await ashwin.post(`/reviews/meetings/${review.id}/lock`).expect(200)).body as MeetingRow;
    expect(review).toMatchObject({
      status: "locked",
      lockedBy: "Ashwin",
      decisions: [expect.objectContaining({ text: "Revisions are turned in within a day" })],
    });
    expect(review.figures.length).toBeGreaterThan(0);
  });
});

describe("goals, the diagnostic and the road map from the agency questionnaire", () => {
  it("the owner answers the agency questionnaire", async () => {
    const o = (await jana.post("/onboarding/agency").expect(201)).body as { id: string };
    const answer = (key: string, value: unknown) => jana.put(`/onboarding/${o.id}/answers/${key}`).send({ value }).expect(200);
    await answer("a13", "The go-to video agency in Kongu Nadu, so the founder can step back from delivery");
    await answer("a14", "48,00,000");
    await answer("a14b", "72,00,000");
    await answer("a15", [
      { row: "Q1 Apr–Jun", revenue: "15,00,000", margin: "18" },
      { row: "Q2 Jul–Sep", revenue: "17,00,000", margin: "20" },
      { row: "Q3 Oct–Dec", revenue: "19,00,000", margin: "22" },
      { row: "Q4 Jan–Mar", revenue: "21,00,000", margin: "22" },
    ]);
    await answer("a7", [
      { row: "Sales", consistent: "No", owner: "Yes", results: "Low", leader: "No", action: "Hire" },
      { row: "Operations / delivery", consistent: "Yes", owner: "No", results: "High", leader: "Yes", action: "Develop" },
      { row: "HR", consistent: "Yes", owner: "Yes", results: "High", leader: "No", action: "Delegate" },
    ]);
    await answer("a23", [
      { row: "Sales", challenge: "Leads come only through referrals", rating: "9" },
      { row: "HR", challenge: "No hiring process", rating: "6" },
    ]);
    await answer("a10", "Delivery runs well; sales still depends on the founder.");
  });

  it("the year's revenue goal and its quarters come from it, and the revenue cascade sets the goals serving them", async () => {
    const made = (await ashwin.post("/goals/from-questionnaire").expect(200)).body as GoalRow[];
    [year] = made;
    expect(year).toMatchObject({ level: "company", target: 7_200_000, metric: "invoiced" });
    expect(made.slice(1).map((g) => g.target)).toEqual([1_500_000, 1_700_000, 1_900_000, 2_100_000]);
    leads = (
      await ashwin
        .post("/goals")
        .send({
          level: "department",
          parentId: year.id,
          title: "Leads for the year",
          unit: "count",
          target: 1,
          metric: "leads",
          startDate: year.startDate,
          dueDate: year.dueDate,
        })
        .expect(201)
    ).body as GoalRow;
    const view = (await jana.get("/goals/cascade").expect(200)).body as CascadeView;
    expect(view.history.revenueTarget).toBe(7_200_000);
    expect(view.basis.revenueTarget).toBe("The company's revenue goal");
    await jana
      .put("/goals/cascade")
      .send({ ...view.history, costPerLead: 450 })
      .expect(200);
    const applied = (
      await jana
        .post("/goals/cascade/apply")
        .send({ links: [{ goalId: leads.id, figure: "leads" }] })
        .expect(200)
    ).body as GoalRow[];
    const l = applied.find((g) => g.id === leads.id)!;
    expect(l.target).toBeGreaterThan(1);
    expect(l.checkIns[0]!.note).toBe(`Target set to ${l.target} from the revenue cascade.`);
  });

  it("the business diagnostic is taken from it and published, and the Strategic Road Map drafted from its challenges", async () => {
    let view = (await karthik.get("/diagnostic").expect(200)).body as DiagnosticView;
    expect(view.current).toMatchObject({ source: "questionnaire", notes: "Delivery runs well; sales still depends on the founder." });
    expect(view.scores!.founderDependency).toBeGreaterThan(0);
    view = (await karthik.post("/diagnostic").send({ rows: view.current!.rows, challenges: view.current!.challenges, notes: view.current!.notes }).expect(201))
      .body as DiagnosticView;
    expect(view.current).toMatchObject({ source: "review" });
    expect(view.history).toHaveLength(1);
    const items = (await karthik.post("/road-map/draft").expect(200)).body as RoadMapRow[];
    expect(items.map((i) => [i.function, i.title])).toEqual([
      ["Sales", "Leads come only through referrals"],
      ["HR", "No hiring process"],
    ]);
    expect(((await ashwin.get("/road-map").expect(200)).body as RoadMapRow[]).length).toBe(2);
    await divya.get("/road-map").expect(403); // published to those who see the reviews
  });
});

describe("another agency", () => {
  it("sees none of it", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    await zara.get(`/payroll/runs/${LAST}`).expect(404);
    expect((await zara.get("/payslips").expect(200)).body).toEqual([]);
    expect(((await zara.get(`/costing/videos?month=${M}`).expect(200)).body as VideoCostRow[]).some((v) => v.id === videoId)).toBe(false);
    await zara.get(`/reviews/meetings/${review.id}`).expect(404);
    await zara.get(`/round-tables/${rt.id}`).expect(404);
    expect((await zara.get("/goals").expect(200)).body).toEqual([]);
    expect((await zara.get("/road-map").expect(200)).body).toEqual([]);
  });
});
