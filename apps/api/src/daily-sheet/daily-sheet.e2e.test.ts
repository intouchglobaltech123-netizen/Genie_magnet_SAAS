// The daily data sheet (P5-12): the usual sheets to start; a person fills in their day, submits it (late after the
// cut-off); their manager and HR sign it in the sheet's order or send it back; managers see the team's day.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DailySheetRow, SheetTeamRow } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let harini: Agent; // HR: signs
let karthik: Agent; // Divya's manager
let divya: Agent; // editor
let surya: Agent; // editor, no sheet
let sheet: DailySheetRow;
const DIVYA = seedUserId("divya@geniemagnet.test");
const KARTHIK = seedUserId("karthik@geniemagnet.test");
const day = (back: number) => new Date(Date.now() + 330 * 60_000 - back * 86_400_000).toISOString().slice(0, 10);
const ROWS = [
  { id: "r1", task: "Edit the festival reel", start: "09:30", end: "13:30" },
  { id: "r2", task: "Colour and sound", start: "14:00", end: "17:50" },
];

beforeAll(async () => {
  t = await startSeededApp();
  [harini, karthik, divya, surya] = await Promise.all(["harini", "karthik", "divya", "surya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("the daily sheet", () => {
  it("starts from the usual sheets, given to people on their employee record", async () => {
    const templates = (await harini.get("/daily-sheets/templates").expect(200)).body as { id: string; name: string; signers: string[] }[];
    expect(templates.map((x) => x.name)).toEqual(["Video Editing", "Social Media", "Technical Support", "HR"]);
    const editing = templates[0]!;
    expect(editing.signers).toEqual(["hr", "manager"]);
    await harini.put(`/people/${DIVYA}`).send({ managerId: KARTHIK, sheetTemplateId: editing.id }).expect(200);
    expect((await surya.get(`/daily-sheets/day/${day(1)}`).expect(409)).body.message).toBe("HR has not given a daily sheet for this person yet.");
  });

  it("is filled in and submitted by the person — checked first, and late when it is for an earlier day", async () => {
    await divya
      .put(`/daily-sheets/day/${day(-1)}`)
      .send({ rows: ROWS })
      .expect(400); // not a day that has come
    await divya
      .put(`/daily-sheets/day/${day(1)}`)
      .send({ rows: [{ ...ROWS[0], status: "pending" }] })
      .expect(200);
    const refused = await divya.post(`/daily-sheets/day/${day(1)}/submit`).expect(400);
    expect(refused.body.issues.map((i: { message: string }) => i.message)).toEqual(["Row 1: why it is pending", "Short of the day's shift — say why"]);
    sheet = (
      await divya
        .put(`/daily-sheets/day/${day(1)}`)
        .send({ rows: ROWS, counters: {} })
        .expect(200)
    ).body as DailySheetRow;
    expect(sheet.totals).toMatchObject({ minutes: 470, gap: 10 });
    sheet = (await divya.post(`/daily-sheets/day/${day(1)}/submit`).expect(200)).body as DailySheetRow;
    expect(sheet).toMatchObject({ status: "submitted", late: true, waitingFor: "hr" });
    await divya
      .put(`/daily-sheets/day/${day(1)}`)
      .send({ rows: ROWS })
      .expect(409);
    const n = (await harini.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.find((x) => x.kind === "sheet_to_sign")!.title).toMatch(/^Daily sheet of Divya Lakshmi for .* to sign$/);
  });

  it("is signed in the sheet's order — HR, then the manager — never by the person", async () => {
    await karthik.post(`/daily-sheets/${sheet.id}/sign`).expect(403); // HR signs first on this sheet
    await divya.post(`/daily-sheets/${sheet.id}/sign`).expect(403);
    sheet = (await harini.post(`/daily-sheets/${sheet.id}/sign`).expect(200)).body as DailySheetRow;
    expect(sheet).toMatchObject({ status: "submitted", waitingFor: "manager", signatures: [expect.objectContaining({ signer: "hr", by: "Harini Selvam" })] });
    const k = (await karthik.get("/notifications").expect(200)).body.items as { kind: string }[];
    expect(k.some((x) => x.kind === "sheet_to_sign")).toBe(true);
    sheet = (await karthik.post(`/daily-sheets/${sheet.id}/sign`).expect(200)).body as DailySheetRow;
    expect(sheet).toMatchObject({ status: "signed", waitingFor: null });
    await harini.post(`/daily-sheets/${sheet.id}/sign`).expect(409);
  });

  it("is sent back with a note by the one who signs next, and submitted again", async () => {
    await divya
      .put(`/daily-sheets/day/${day(2)}`)
      .send({ rows: ROWS })
      .expect(200);
    const second = (await divya.post(`/daily-sheets/day/${day(2)}/submit`).expect(200)).body as DailySheetRow;
    await karthik.post(`/daily-sheets/${second.id}/send-back`).send({ note: "Not yet" }).expect(403);
    const back = (await harini.post(`/daily-sheets/${second.id}/send-back`).send({ note: "Split the colour work into its own rows" }).expect(200))
      .body as DailySheetRow;
    expect(back).toMatchObject({ status: "draft", returnNote: "Split the colour work into its own rows", signatures: [] });
    const n = (await divya.get("/notifications").expect(200)).body.items as { kind: string; body: string }[];
    expect(n.find((x) => x.kind === "sheet_returned")!.body).toBe("Split the colour work into its own rows");
    expect(((await divya.post(`/daily-sheets/day/${day(2)}/submit`).expect(200)).body as DailySheetRow).status).toBe("submitted");
  });

  it("shows managers their team's day, and nobody else's", async () => {
    const team = (await karthik.get(`/daily-sheets/team?date=${day(1)}`).expect(200)).body as SheetTeamRow[];
    expect(team).toEqual([expect.objectContaining({ user: { id: DIVYA, name: "Divya Lakshmi" }, template: "Video Editing", state: "signed", minutes: 470 })]);
    expect((await surya.get(`/daily-sheets/team?date=${day(1)}`).expect(200)).body).toEqual([]);
    await surya.get(`/daily-sheets/day/${day(1)}?person=${DIVYA}`).expect(404);
    expect(((await karthik.get(`/daily-sheets/day/${day(1)}?person=${DIVYA}`).expect(200)).body as DailySheetRow).rows).toHaveLength(2);
  });

  it("belongs to its agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    await zara.post(`/daily-sheets/${sheet.id}/sign`).expect(404);
    expect((await zara.get(`/daily-sheets/team?date=${day(1)}`).expect(200)).body).toEqual([]);
  });
});
