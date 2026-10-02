// Performance and learning (P5-11): KRA templates; the month's scorecard started by the person's manager with the
// figures the app knows filled in, finished, shared and replied to; the leaderboard; the A–C rating; learning paths
// given and done; the skill matrix.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  KraTemplateRow,
  LeaderboardRow,
  LearningAssignmentRow,
  LearningPathRow,
  MonthScorecardRow,
  PlayerRatingRow,
  SkillMatrix,
  TeamMemberRow,
} from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let ashwin: Agent; // manager: makes videos
let harini: Agent; // HR
let karthik: Agent; // team leader: Divya's manager
let divya: Agent; // editor
let surya: Agent; // editor
let template: KraTemplateRow;
let card: MonthScorecardRow;
const DIVYA = seedUserId("divya@geniemagnet.test");
const KARTHIK = seedUserId("karthik@geniemagnet.test");
// This month in India.
const M = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 7);

beforeAll(async () => {
  t = await startSeededApp();
  [ashwin, harini, karthik, divya, surya] = await Promise.all(
    ["ashwin", "harini", "karthik", "divya", "surya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)),
  );
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

/** A video Divya edits, and its way through the quality check to the client's approval (failing the check first, if `failedFirst`). */
async function approvedVideo(title: string, failedFirst: boolean) {
  const clientId = (await ashwin.get("/clients").expect(200)).body[0].id as string;
  const v = (
    await ashwin
      .post("/videos")
      .send({ clientId, title, format: "Reel", dueDate: `${M}-28`, editorId: DIVYA })
      .expect(201)
  ).body as { id: string };
  const steps = [
    ...(failedFirst
      ? [
          ["internal_qc", "editing"],
          ["editing", "internal_qc"],
        ]
      : []),
    ["internal_qc", "client_review"],
    ["client_review", "approved"],
  ];
  for (const [i, [from, to]] of steps.entries())
    await t.sql(
      `INSERT INTO video_stage_changes (id, agency_id, video_id, "from", "to", at)
       SELECT gen_random_uuid(), agency_id, id, $2::"VideoStage", $3::"VideoStage", now() - make_interval(secs => $4) FROM videos WHERE id = $1`,
      [v.id, from, to, 60 - i],
    );
}

describe("KRAs", () => {
  it("are kept by HR as templates whose weights add up to 100, given to people on their employee record", async () => {
    const body = {
      name: "Video Editor",
      kras: [
        { key: "videos", name: "Videos approved", target: 4, weight: 40, metric: "videos_approved" },
        { key: "qc", name: "Quality check first time", unit: "%", target: 85, weight: 30, metric: "qc_first_pass" },
        { key: "feedback", name: "Client feedback", measure: "Average rating from the client, out of 5", target: 4, weight: 30 },
      ],
      gate: { key: "qc", threshold: 80, cap: 70 },
    };
    await karthik.post("/performance/templates").send(body).expect(403);
    await harini
      .post("/performance/templates")
      .send({ ...body, kras: body.kras.map((k) => ({ ...k, weight: 10 })) })
      .expect(400);
    template = (await harini.post("/performance/templates").send(body).expect(201)).body as KraTemplateRow;
    await harini.put(`/people/${DIVYA}`).send({ managerId: DIVYA }).expect(400);
    await harini.put(`/people/${DIVYA}`).send({ employeeCode: "GM007", managerId: KARTHIK, kraTemplateId: template.id }).expect(200);
    expect(((await harini.get("/performance/templates").expect(200)).body as KraTemplateRow[])[0]!.people).toEqual([{ id: DIVYA, name: "Divya Lakshmi" }]);
  });
});

describe("the month's scorecard", () => {
  it("is started by the person's manager with what the app knows: approved videos and the quality check", async () => {
    await approvedVideo("Diwali offer reel", false);
    await approvedVideo("New arrivals reel", true);
    const team = (await karthik.get(`/performance/team?month=${M}`).expect(200)).body as TeamMemberRow[];
    expect(team.map((m) => m.user.id)).toEqual([DIVYA]);
    await surya.post("/performance/scorecards").send({ userId: DIVYA, month: M }).expect(403);
    expect((await divya.post("/performance/scorecards").send({ userId: DIVYA, month: M }).expect(403)).body.message).toBe(
      "Someone else reviews your own month.",
    );
    card = (await karthik.post("/performance/scorecards").send({ userId: DIVYA, month: M }).expect(201)).body as MonthScorecardRow;
    expect(card.kras.map((k) => [k.key, k.actual, k.auto])).toEqual([
      ["videos", 2, true],
      ["qc", 50, true],
      ["feedback", null, false],
    ]);
    expect(card).toMatchObject({ status: "draft", gated: true, raw: 37.6, score: 37.6 });
    await divya.get(`/performance/scorecards/${card.id}`).expect(404);
  });

  it("is finished by the manager — the quality gate caps it — and shared; the person replies", async () => {
    expect((await karthik.post(`/performance/scorecards/${card.id}/share`).expect(409)).body.message).toBe("Enter what was achieved on every KRA first.");
    card = (
      await karthik
        .put(`/performance/scorecards/${card.id}`)
        .send({ actuals: { feedback: 4 }, note: "Good month" })
        .expect(200)
    ).body as MonthScorecardRow;
    expect(card).toMatchObject({ raw: 67.6, score: 67.6, gated: true });
    card = (
      await karthik
        .put(`/performance/scorecards/${card.id}`)
        .send({ actuals: { feedback: 5, qc: 100 }, note: "Good month" })
        .expect(200)
    ).body as MonthScorecardRow;
    expect(card.kras.find((k) => k.key === "qc")).toMatchObject({ actual: 100, auto: false });
    expect(card).toMatchObject({ raw: 80, score: 80, gated: false });
    await karthik.post(`/performance/scorecards/${card.id}/share`).expect(200);
    await karthik.put(`/performance/scorecards/${card.id}`).send({ actuals: {}, note: "" }).expect(409);

    const n = (await divya.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.find((x) => x.kind === "scorecard_shared")!.title).toMatch(/^Your scorecard for .*: 80$/);
    expect(((await divya.get("/performance/scorecards/mine").expect(200)).body as MonthScorecardRow[]).map((c) => c.id)).toEqual([card.id]);
    await divya.post(`/performance/scorecards/${card.id}/reply`).send({ text: "Thank you — I will keep the quality check up." }).expect(200);
    const k = (await karthik.get("/notifications").expect(200)).body.items as { kind: string; body: string }[];
    expect(k.find((x) => x.kind === "scorecard_shared")!.body).toBe("Thank you — I will keep the quality check up.");
  });

  it("shows on the leaderboard: managers and HR by default, everyone when the agency says so", async () => {
    await divya.get(`/performance/leaderboard?month=${M}`).expect(403);
    const board = (await karthik.get(`/performance/leaderboard?month=${M}`).expect(200)).body as LeaderboardRow[];
    expect(board).toEqual([{ rank: 1, user: { id: DIVYA, name: "Divya Lakshmi" }, template: "Video Editor", score: 80, change: null }]);
    await harini.put("/performance/settings").send({ leaderboard: "everyone" }).expect(200);
    await divya.get(`/performance/leaderboard?month=${M}`).expect(200);
  });

  it("comes with the A–C rating by the manager, which the person does not see unless the agency shows it", async () => {
    const r = (
      await karthik
        .put(`/performance/ratings/${DIVYA}`)
        .send({ month: M, ratings: { skill: 5, knowledge: 4, selfImage: 3, motive: 4, trait: 3 } })
        .expect(200)
    ).body as PlayerRatingRow;
    expect(r.player).toBe("B_competence");
    expect((await divya.get(`/performance/ratings?month=${M}`).expect(200)).body).toEqual([]);
    await harini.put("/performance/settings").send({ leaderboard: "everyone", showOwnRating: true }).expect(200);
    expect(((await divya.get(`/performance/ratings?month=${M}`).expect(200)).body as PlayerRatingRow[])[0]!.player).toBe("B_competence");
  });
});

describe("learning", () => {
  it("gives a path to a person, who marks its modules done", async () => {
    const path = (
      await harini
        .post("/learning/paths")
        .send({
          title: "Colour for reels",
          forRole: "Video Editor",
          modules: [
            { key: "m1", title: "Colour basics", hours: 2, link: "https://learn.test/colour" },
            { key: "m2", title: "Grading skin tones", hours: 3 },
          ],
        })
        .expect(201)
    ).body as LearningPathRow;
    expect(path.hours).toBe(5);
    await surya
      .post(`/learning/paths/${path.id}/assign`)
      .send({ userIds: [DIVYA] })
      .expect(403);
    await karthik
      .post(`/learning/paths/${path.id}/assign`)
      .send({ userIds: [DIVYA] })
      .expect(200);
    await karthik
      .post(`/learning/paths/${path.id}/assign`)
      .send({ userIds: [DIVYA] })
      .expect(409);
    const n = (await divya.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.find((x) => x.kind === "learning_assigned")!.title).toBe("Learning path: Colour for reels");

    const [a] = (await divya.get("/learning/assignments").expect(200)).body as LearningAssignmentRow[];
    await surya.put(`/learning/assignments/${a!.id}/modules/m1`).send({ done: true }).expect(404);
    await divya.put(`/learning/assignments/${a!.id}/modules/m1`).send({ done: true }).expect(200);
    const done = (await divya.put(`/learning/assignments/${a!.id}/modules/m2`).send({ done: true }).expect(200)).body as LearningAssignmentRow;
    expect(done).toMatchObject({ progress: 100, completedAt: expect.any(String) });
    expect(((await harini.get("/learning/paths").expect(200)).body as LearningPathRow[])[0]).toMatchObject({ assigned: 1, completed: 1 });
  });

  it("keeps the skill matrix: HR lists the skills, managers set their people's levels", async () => {
    let m = (
      await harini
        .put("/learning/skills")
        .send({ skills: [{ name: "Colour grading", group: "Editing" }, { name: "Sound" }] })
        .expect(200)
    ).body as SkillMatrix;
    const colour = m.skills.find((s) => s.name === "Colour grading")!;
    await divya.put(`/learning/skills/${colour.id}/levels/${DIVYA}`).send({ level: 4 }).expect(403);
    await karthik.put(`/learning/skills/${colour.id}/levels/${DIVYA}`).send({ level: 3 }).expect(200);
    m = (await divya.get("/learning/skills").expect(200)).body as SkillMatrix;
    expect(m.people).toEqual([{ id: DIVYA, name: "Divya Lakshmi", levels: { [colour.id]: 3 } }]);
    // Renaming keeps the level.
    m = (
      await harini
        .put("/learning/skills")
        .send({ skills: [{ id: colour.id, name: "Colour" }, ...m.skills.filter((s) => s.id !== colour.id)] })
        .expect(200)
    ).body as SkillMatrix;
    expect(m.people.find((p) => p.id === DIVYA)!.levels[colour.id]).toBe(3);
  });

  it("belongs to its agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get("/learning/paths").expect(200)).body).toEqual([]);
    expect((await zara.get("/performance/templates").expect(200)).body).toEqual([]);
    await zara.get(`/performance/scorecards/${card.id}`).expect(404);
  });
});
