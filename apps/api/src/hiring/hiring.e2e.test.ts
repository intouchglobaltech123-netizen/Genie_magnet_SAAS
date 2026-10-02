// Hiring (P5-10): an opening with its role document; candidates through the stages; interviews, notified and on the
// calendar; scorecards by the agency's rule; the hire approved; the offer; joining, which invites them, and their
// employee record from the offer when they accept.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CalendarEvent, CandidateRow, EmployeeRow, HiringSettings, OpeningRow } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, ORIGIN, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner
let harini: Agent; // HR: hiring, approves
let karthik: Agent; // team leader: hiring manager
let surya: Agent; // editor: interviews
let divya: Agent; // editor: nothing to do with it
let opening: OpeningRow;
let arun: CandidateRow;
const KARTHIK = seedUserId("karthik@geniemagnet.test");
const SURYA = seedUserId("surya@geniemagnet.test");
const soon = new Date(Date.now() + 2 * 86_400_000);
soon.setUTCHours(5, 30, 0, 0); // 11:00 in India
const RATINGS = { skills: 4, knowledge: 4, selfImage: 4, traits: 5, motives: 4 };
const STAR = { situation: "A reel was rejected two hours before posting.", task: "Recut in time.", action: "Used other takes.", result: "Posted on time." };

beforeAll(async () => {
  t = await startSeededApp();
  [jana, harini, karthik, surya, divya] = await Promise.all(["jana", "harini", "karthik", "surya", "divya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("openings", () => {
  it("are kept by HR with the role's document; the hiring manager sees theirs, without the budget", async () => {
    await karthik.post("/hiring/openings").send({ title: "Video Editor" }).expect(403);
    await harini.post("/hiring/openings").send({ title: "Video Editor", budgetFrom: 21000, budgetTo: 15000 }).expect(400);
    opening = (
      await harini
        .post("/hiring/openings")
        .send({
          title: "Video Editor",
          positions: 1,
          hiringManagerId: KARTHIK,
          budgetFrom: 15000,
          budgetTo: 21000,
          definition: "Turns raw footage into on-brand videos within the agreed time.",
          deliverables: ["12 to 16 reels a month", "Passes the quality check first time"],
          tasks: ["Rough cut to export", "Logs time on each video"],
          competence: { skills: ["Premiere Pro"], knowledge: ["Platform formats"], selfImage: [], traits: ["Attention to detail"], motives: [] },
          star: { situation: "Tell us about a time a client rejected your edit near a deadline.", task: "", action: "", result: "" },
          sources: ["Employee referral", "Job portal"],
        })
        .expect(201)
    ).body as OpeningRow;
    expect(opening).toMatchObject({ status: "open", hiringManager: { id: KARTHIK }, budgetTo: 21000, pipeline: {} });
    const seen = (await karthik.get("/hiring/openings").expect(200)).body as OpeningRow[];
    expect(seen).toEqual([expect.objectContaining({ id: opening.id, budgetFrom: null, budgetTo: null })]);
    expect((await divya.get("/hiring/openings").expect(200)).body).toEqual([]);
  });
});

describe("candidates", () => {
  it("are added by HR and move through the early stages; ending one needs the reason", async () => {
    arun = (
      await harini
        .post("/hiring/candidates")
        .send({ openingId: opening.id, name: "Arun Prakash", email: "Arun.Prakash@mail.test", city: "Erode", source: "Job portal", expectedPay: 19000 })
        .expect(201)
    ).body as CandidateRow;
    expect(arun).toMatchObject({ stage: "applied", email: "arun.prakash@mail.test", expectedPay: 19000 });
    await harini.post("/hiring/candidates").send({ openingId: opening.id, name: "Arun again", email: "arun.prakash@mail.test" }).expect(409);
    const other = (await harini.post("/hiring/candidates").send({ openingId: opening.id, name: "Bala Murugan" }).expect(201)).body as CandidateRow;
    await harini.put(`/hiring/candidates/${other.id}/stage`).send({ stage: "rejected" }).expect(400);
    await harini.put(`/hiring/candidates/${other.id}/stage`).send({ stage: "rejected", reason: "Wants to work remotely" }).expect(200);
    await harini.put(`/hiring/candidates/${arun.id}/stage`).send({ stage: "screening" }).expect(200);
    await harini.put(`/hiring/candidates/${arun.id}/stage`).send({ stage: "offer" }).expect(400);
    await harini.put(`/hiring/candidates/${arun.id}/stage`).send({ stage: "approval" }).expect(409); // no scorecard yet
  });

  it("are interviewed: the interviewer is told, sees the candidate without pay, and it is on their calendar", async () => {
    await harini
      .post(`/hiring/candidates/${arun.id}/interviews`)
      .send({ at: soon.toISOString(), interviewerId: SURYA, mode: "in_person", where: "Studio" })
      .expect(201);
    const n = (await surya.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.find((x) => x.kind === "interview_assigned")!.title).toMatch(/^Interview Arun Prakash for Video Editor, /);
    const seen = (await surya.get(`/hiring/candidates/${arun.id}`).expect(200)).body as CandidateRow;
    expect(seen).toMatchObject({
      stage: "interview",
      expectedPay: null,
      interviews: [expect.objectContaining({ interviewer: { id: SURYA, name: "Surya Prakash" } })],
    });
    await divya.get(`/hiring/candidates/${arun.id}`).expect(404);
    const from = soon.toISOString().slice(0, 10);
    const events = (await surya.get(`/calendar?from=${from}&to=${from}`).expect(200)).body as CalendarEvent[];
    expect(events).toContainEqual(
      expect.objectContaining({ kind: "interview", title: "Interview Arun Prakash", time: "11:00", link: `/app/hiring?candidate=${arun.id}` }),
    );
    expect(((await divya.get(`/calendar?from=${from}&to=${from}`).expect(200)).body as CalendarEvent[]).some((e) => e.kind === "interview")).toBe(false);
  });

  it("are scored by their interviewers by the agency's rule, and sent for approval", async () => {
    await divya.put(`/hiring/candidates/${arun.id}/scorecard`).send({ ratings: RATINGS, star: STAR, taskScore: 8 }).expect(403);
    await surya
      .put(`/hiring/candidates/${arun.id}/scorecard`)
      .send({ ratings: { ...RATINGS, skills: 0 }, star: STAR, taskScore: 8 })
      .expect(400);
    let c = (await surya.put(`/hiring/candidates/${arun.id}/scorecard`).send({ ratings: RATINGS, star: STAR, taskScore: 8, remarks: "Strong" }).expect(200))
      .body as CandidateRow;
    expect(c.scorecards).toEqual([expect.objectContaining({ total: 21, percent: 83, recommendation: "hire" })]);
    expect(c.stage).toBe("scorecard");

    // The agency's own rule: a stricter task score turns the same card into a hold.
    expect(((await harini.put("/hiring/settings").send({ hireTask: 9 }).expect(200)).body as HiringSettings).hireTask).toBe(9);
    c = (await karthik.put(`/hiring/candidates/${arun.id}/scorecard`).send({ ratings: RATINGS, star: STAR, taskScore: 8 }).expect(200)).body as CandidateRow;
    expect(c.scorecards!.map((s) => s.recommendation)).toEqual(["hire", "hold"]);
    expect(c.score).toEqual({ percent: 83, recommendation: "hold", count: 2 });

    await harini.put(`/hiring/candidates/${arun.id}/stage`).send({ stage: "approval" }).expect(200);
    const asked = (await jana.get("/notifications").expect(200)).body.items as { kind: string; title: string; body: string }[];
    expect(asked.find((x) => x.kind === "hire_to_approve")).toMatchObject({
      title: "Hire Arun Prakash as Video Editor?",
      body: "2 scorecards, 83% on average",
    });
  });

  it("are approved, offered and join: an invitation with the offered role, and their employee record when they accept", async () => {
    await karthik.post(`/hiring/candidates/${arun.id}/approval`).send({ approved: true }).expect(403);
    await harini
      .put(`/hiring/candidates/${arun.id}/offer`)
      .send({ designation: "Video Editor", monthlyPay: 19000, joiningDate: "2026-11-02", role: "editor" })
      .expect(409);
    await harini.post(`/hiring/candidates/${arun.id}/approval`).send({ approved: true }).expect(200);
    await harini.post(`/hiring/candidates/${arun.id}/join`).expect(409); // no accepted offer
    await harini
      .put(`/hiring/candidates/${arun.id}/offer`)
      .send({ designation: "Video Editor", monthlyPay: 19000, joiningDate: "2026-11-02", role: "editor" })
      .expect(200);
    const offered = (await harini.post(`/hiring/candidates/${arun.id}/offer/answer`).send({ accepted: true }).expect(200)).body as CandidateRow;
    expect(offered.offer).toMatchObject({ status: "accepted", monthlyPay: 19000 });
    expect(((await karthik.get(`/hiring/candidates/${arun.id}`).expect(200)).body as CandidateRow).offer!.monthlyPay).toBe(0);

    // HR cannot give a role with more than HR has; the owner can.
    await harini.post(`/hiring/candidates/${arun.id}/join`).expect(403);
    const joined = (await jana.post(`/hiring/candidates/${arun.id}/join`).expect(200)).body as CandidateRow;
    expect(joined.stage).toBe("joined");
    expect(joined.invitationLink).toMatch(/\/app\/invite\//);

    // Arun accepts the invitation (signing up as the invited address), and his employee record starts from the offer.
    const arunAgent = request.agent(t.app.getHttpServer());
    await arunAgent
      .post("/api/auth/sign-up/email")
      .set("Origin", ORIGIN)
      .send({ name: "Arun Prakash", email: "arun.prakash@mail.test", password: "a-long-test-password-1" })
      .expect(200);
    const invitationId = joined.invitationLink!.split("/").at(-1)!;
    await arunAgent.post("/api/auth/organization/accept-invitation").set("Origin", ORIGIN).send({ invitationId }).expect(200);
    const people = (await harini.get("/people").expect(200)).body as EmployeeRow[];
    expect(people.find((p) => p.user.email === "arun.prakash@mail.test")).toMatchObject({ designation: "Video Editor", joiningDate: "2026-11-02" });
  });

  it("belong to their agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get("/hiring/openings").expect(200)).body).toEqual([]);
    await zara.get(`/hiring/candidates/${arun.id}`).expect(404);
  });
});
