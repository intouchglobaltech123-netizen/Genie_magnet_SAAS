// STOP reviews (P5-14), decisions and commitments (P5-16): the rhythms to start with, set up by the agency; a review
// scheduled, run with attendance and notes, commitments marked breakthrough or breakdown and carried forward, decisions
// recorded, and locked with the figures kept as they were.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CadenceRow, CommitmentRow, DecisionRow, MeetingRow } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let ashwin: Agent; // manager: runs and locks reviews
let karthik: Agent; // team leader: runs reviews, cannot lock
let divya: Agent; // editor: takes part
let surya: Agent; // editor: not in it
let meeting: MeetingRow;
let late: CommitmentRow;
let other: CommitmentRow;
const ASHWIN = seedUserId("ashwin@geniemagnet.test");
const KARTHIK = seedUserId("karthik@geniemagnet.test");
const DIVYA = seedUserId("divya@geniemagnet.test");
const PRIYA = seedUserId("priya@geniemagnet.test");
const day = (offset: number) => new Date(Date.now() + 330 * 60_000 + offset * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  t = await startSeededApp();
  [ashwin, karthik, divya, surya] = await Promise.all(["ashwin", "karthik", "divya", "surya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("review rhythms", () => {
  it("start from the STOP rhythm, which the agency sets up", async () => {
    await divya.get("/reviews/cadences").expect(403);
    const all = (await ashwin.get("/reviews/cadences").expect(200)).body as CadenceRow[];
    expect(all.map((c) => [c.cadence, c.name, c.everyDays])).toEqual([
      ["daily", "Daily stand-up", 1],
      ["weekly", "Weekly review", 7],
      ["tactical", "Tactical review", 14],
      ["strategic", "Strategic review", 45],
    ]);
    const weekly = all[1]!;
    const saved = (
      await ashwin
        .put("/reviews/cadences/weekly")
        .send({ ...weekly, facilitatorId: ASHWIN, participantIds: [KARTHIK, DIVYA, PRIYA], agenda: [...weekly.agenda, { title: "Hiring", minutes: 5 }] })
        .expect(200)
    ).body as CadenceRow;
    expect(saved).toMatchObject({ facilitatorId: ASHWIN, participantIds: [KARTHIK, DIVYA, PRIYA] });
    expect(saved.agenda.at(-1)).toMatchObject({ title: "Hiring", minutes: 5 });
  });
});

describe("a review", () => {
  it("is scheduled with the rhythm's agenda and people, who are told", async () => {
    late = (
      await ashwin
        .post("/commitments")
        .send({ text: "Fix the colour on the Diwali reel", ownerId: DIVYA, due: day(-1) })
        .expect(201)
    ).body as CommitmentRow;
    other = (
      await ashwin
        .post("/commitments")
        .send({ text: "Send the testimonial script", ownerId: KARTHIK, due: day(-2) })
        .expect(201)
    ).body as CommitmentRow;
    await divya
      .post("/commitments")
      .send({ text: "Mine", ownerId: DIVYA, due: day(3) })
      .expect(403);
    const n = (await divya.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.find((x) => x.kind === "commitment_assigned")!.title).toBe(`Your commitment, by ${day(-1)}: Fix the colour on the Diwali reel`);

    meeting = (
      await ashwin
        .post("/reviews/meetings")
        .send({ cadence: "weekly", startsAt: new Date(Date.now() + 3_600_000).toISOString(), venue: "Studio" })
        .expect(201)
    ).body as MeetingRow;
    expect(meeting).toMatchObject({ title: "Weekly review #1", status: "scheduled", facilitator: { id: ASHWIN } });
    expect(meeting.participants.map((p) => p.id).sort()).toEqual([DIVYA, KARTHIK, PRIYA].sort());
    expect(meeting.agenda.at(-1)!.title).toBe("Hiring");
    expect(meeting.figures.map((f) => f.key)).toEqual(["money", "sales", "delivery", "commitments"]);
    expect(meeting.figures.find((f) => f.key === "commitments")!.lines[0]).toEqual({ label: "Open", value: "2" });
    expect(meeting.toReview.map((c) => c.id).sort()).toEqual([late.id, other.id].sort());
    const k = (await karthik.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(k.find((x) => x.kind === "review_scheduled")!.title).toMatch(/^Weekly review #1: /);
    // People in it see it; others do not.
    await divya.get(`/reviews/meetings/${meeting.id}`).expect(200);
    await surya.get(`/reviews/meetings/${meeting.id}`).expect(404);
  });

  it("is run with attendance, notes, marks, new commitments and decisions", async () => {
    await divya
      .put(`/reviews/meetings/${meeting.id}`)
      .send({ notes: { "0": "Mine" } })
      .expect(403);
    meeting = (
      await karthik
        .put(`/reviews/meetings/${meeting.id}`)
        .send({ notes: { "0": "Two of three done" }, attendance: { [DIVYA]: "present", [PRIYA]: "late", [KARTHIK]: "present" } })
        .expect(200)
    ).body as MeetingRow;
    expect(meeting.attendance).toEqual({ [DIVYA]: "present", [PRIYA]: "late", [KARTHIK]: "present" });

    await ashwin.post(`/commitments/${late.id}/mark`).send({ mark: "BD", meetingId: meeting.id }).expect(400); // needs what got in the way
    late = (
      await ashwin
        .post(`/commitments/${late.id}/mark`)
        .send({ mark: "BD", note: "Footage came late", due: day(2), meetingId: meeting.id })
        .expect(200)
    ).body as CommitmentRow;
    expect(late).toMatchObject({
      status: "open",
      mark: "BD",
      carried: 1,
      due: day(2),
      history: [expect.objectContaining({ mark: "BD", meeting: "Weekly review #1" })],
    });

    const made = (
      await ashwin
        .post("/commitments")
        .send({ text: "Call Lakshmi Textiles", ownerId: PRIYA, due: day(7), meetingId: meeting.id })
        .expect(201)
    ).body as CommitmentRow;
    expect(made.madeIn).toEqual({ id: meeting.id, title: "Weekly review #1" });
    const decision = (
      await ashwin.post("/decisions").send({ text: "Reels go out by 6 pm the day before", ownerId: KARTHIK, meetingId: meeting.id }).expect(201)
    ).body as DecisionRow;
    expect(decision).toMatchObject({ owner: { id: KARTHIK }, madeIn: { title: "Weekly review #1" } });
    meeting = (await ashwin.get(`/reviews/meetings/${meeting.id}`).expect(200)).body as MeetingRow;
    expect(meeting.made.map((c) => c.text)).toEqual(["Call Lakshmi Textiles"]);
    expect(meeting.decisions.map((d) => d.text)).toEqual(["Reels go out by 6 pm the day before"]);
  });

  it("is locked by someone who may approve: the figures are kept, and what it did not review is carried forward", async () => {
    await karthik.post(`/reviews/meetings/${meeting.id}/lock`).expect(403);
    meeting = (await ashwin.post(`/reviews/meetings/${meeting.id}/lock`).expect(200)).body as MeetingRow;
    expect(meeting).toMatchObject({ status: "locked", lockedBy: "Ashwin" });
    const kept = meeting.figures;
    // Figures move on afterwards, but the locked review keeps its own.
    await ashwin
      .post("/commitments")
      .send({ text: "Another", ownerId: DIVYA, due: day(5) })
      .expect(201);
    expect(((await ashwin.get(`/reviews/meetings/${meeting.id}`).expect(200)).body as MeetingRow).figures).toEqual(kept);
    await ashwin
      .put(`/reviews/meetings/${meeting.id}`)
      .send({ notes: { "1": "Late note" } })
      .expect(409);
    const all = (await ashwin.get("/commitments?status=open").expect(200)).body as CommitmentRow[];
    expect(all.find((c) => c.id === other.id)).toMatchObject({ carried: 1, history: [expect.objectContaining({ note: "Not reviewed — carried forward" })] });
    expect(all.find((c) => c.id === late.id)!.carried).toBe(1); // marked in the review, not carried twice
  });

  it("leaves each owner to mark their own commitment done", async () => {
    await surya.post(`/commitments/${late.id}/done`).expect(404);
    expect(((await divya.post(`/commitments/${late.id}/done`).expect(200)).body as CommitmentRow).status).toBe("done");
    expect(((await divya.get("/commitments?mine=true").expect(200)).body as CommitmentRow[]).map((c) => c.text).sort()).toEqual([
      "Another",
      "Fix the colour on the Diwali reel",
    ]);
    expect((await divya.get("/decisions").expect(200)).body).toEqual([]);
    expect(((await ashwin.get("/decisions").expect(200)).body as DecisionRow[]).length).toBe(1);
  });

  it("belongs to its agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    await zara.get(`/reviews/meetings/${meeting.id}`).expect(404);
    expect((await zara.get("/commitments").expect(200)).body).toEqual([]);
  });
});
