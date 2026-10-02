// Projects and tasks (P5-21): task lists, projects started from them, tasks that wait for each other, tasks of your
// own, commitments carried forward as tasks (done together), and who sees and moves what.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CommitmentRow, ProjectDetail, ProjectRow, ProjectTemplate, TaskRow } from "@gm/shared";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let ashwin: Agent; // manager: may edit projects, keeps the reviews
let karthik: Agent; // team leader: may edit projects
let divya: Agent; // editor: only her own tasks
let vignesh: Agent; // shooter: only his own tasks
let ids: Record<string, string>;
let site: ProjectDetail;
let reel: TaskRow;

const IST = 330 * 60_000;
const dayFrom = (n: number) => new Date(Date.now() + IST + n * 86_400_000).toISOString().slice(0, 10);
const TODAY = dayFrom(0);
const task = (fields: Record<string, unknown>) => ({ priority: "medium", notes: "", dueOn: null, dependsOnId: null, projectId: null, ...fields });

beforeAll(async () => {
  t = await startSeededApp();
  [ashwin, karthik, divya, vignesh] = await Promise.all(["ashwin", "karthik", "divya", "vignesh"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  const people = (await t.sql(`SELECT id, email FROM users WHERE email LIKE '%@geniemagnet.test'`)) as { id: string; email: string }[];
  ids = Object.fromEntries(people.map((p) => [p.email.split("@")[0]!, p.id]));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("task lists", () => {
  it("start with joining and a one-off project, and are kept by those who may edit projects", async () => {
    const { templates } = (await divya.get("/projects/settings").expect(200)).body as { templates: ProjectTemplate[] };
    expect(templates.map((x) => x.key)).toEqual(["joining", "one_off"]);
    expect(templates[0]!.tasks.some((x) => x.to === "joiner")).toBe(true);
    await divya.put("/projects/settings").send({ templates }).expect(403);
    const event = { key: "event", name: "Event", tasks: [{ title: "Book the venue", days: 0 }] };
    await ashwin
      .put("/projects/settings")
      .send({ templates: [...templates, { ...event, tasks: [{ title: "Book the venue", to: "joiner" }] }] })
      .expect(400);
    await ashwin
      .put("/projects/settings")
      .send({ templates: [...templates, { ...event, tasks: [{ title: "Book the venue", after: 1 }] }] })
      .expect(400);
    const saved = (
      await ashwin
        .put("/projects/settings")
        .send({ templates: [...templates, event] })
        .expect(200)
    ).body as { templates: ProjectTemplate[] };
    expect(saved.templates.map((x) => x.key)).toEqual(["joining", "one_off", "event"]);
  });
});

describe("projects", () => {
  it("are started from a task list by those who may edit projects, run by their owner", async () => {
    const body = { name: "Website for Kovai Crafts", ownerId: ids.karthik, startOn: TODAY, templateKey: "one_off" };
    await divya.post("/projects").send(body).expect(403);
    await ashwin
      .post("/projects")
      .send({ ...body, templateKey: "nope" })
      .expect(400);
    site = (await ashwin.post("/projects").send(body).expect(201)).body as ProjectDetail;
    expect(site).toMatchObject({ name: "Website for Kovai Crafts", owner: { name: "Karthik Subramanian" }, status: "active", progress: { total: 5, done: 0 } });
    expect(site.tasks.map((x) => [x.title, x.dueOn, x.owner.id, x.source])).toEqual([
      ["Agree the brief and what will be delivered", TODAY, ids.karthik, "template"],
      ["Plan, quote and get the go-ahead", dayFrom(3), ids.karthik, "template"],
      ["Make it", dayFrom(14), ids.karthik, "template"],
      ["Client review", dayFrom(17), ids.karthik, "template"],
      ["Changes and hand-over", dayFrom(21), ids.karthik, "template"],
    ]);
    expect(site.tasks[1]).toMatchObject({ blocked: true, waitsFor: { title: "Agree the brief and what will be delivered", done: false } });
    expect(site.progress.blocked).toBe(4);
    expect((await divya.get("/projects").expect(200)).body).toEqual([]);
    await divya.get(`/projects/${site.id}`).expect(404);
    const notes = (await karthik.get("/notifications").expect(200)).body as { items: { title: string }[] };
    expect(notes.items.map((n) => n.title)).toContain("Website for Kovai Crafts is yours to run");
  });

  it("get tasks from their owner, each waiting for the one before it", async () => {
    await divya
      .post("/tasks")
      .send(task({ title: "Edit the launch reel", ownerId: ids.divya, projectId: site.id }))
      .expect(403);
    reel = (
      await karthik
        .post("/tasks")
        .send(task({ title: "Edit the launch reel", ownerId: ids.divya, projectId: site.id, dependsOnId: site.tasks[2]!.id, dueOn: dayFrom(15) }))
        .expect(201)
    ).body as TaskRow;
    expect(reel).toMatchObject({ blocked: true, owner: { name: "Divya Lakshmi" }, project: { name: "Website for Kovai Crafts" } });
    expect(((await divya.get("/projects").expect(200)).body as ProjectRow[]).map((p) => p.name)).toEqual(["Website for Kovai Crafts"]);
    expect(((await divya.get("/tasks").expect(200)).body as TaskRow[]).map((x) => x.title)).toEqual(["Edit the launch reel"]);
    expect((await divya.post(`/tasks/${reel.id}/status`).send({ status: "in_progress" }).expect(409)).body.message).toBe('It waits for "Make it" to be done.');
    // A task cannot wait for one that waits for it.
    const [brief, plan] = site.tasks;
    await karthik
      .put(`/tasks/${brief!.id}`)
      .send(task({ title: brief!.title, ownerId: ids.karthik, dependsOnId: plan!.id }))
      .expect(400);
  });

  it("move along: whoever waits is told when they can start", async () => {
    const [brief, plan, make] = site.tasks;
    await karthik.post(`/tasks/${plan!.id}/status`).send({ status: "done" }).expect(409);
    await vignesh.post(`/tasks/${brief!.id}/status`).send({ status: "done" }).expect(403);
    for (const x of [brief!, plan!, make!]) await karthik.post(`/tasks/${x.id}/status`).send({ status: "done" }).expect(200);
    const notes = (await divya.get("/notifications").expect(200)).body as { items: { title: string }[] };
    expect(notes.items.map((n) => n.title)).toContain("Ready to start: Edit the launch reel");
    await divya.post(`/tasks/${reel.id}/status`).send({ status: "in_progress" }).expect(200);
    reel = (await divya.post(`/tasks/${reel.id}/status`).send({ status: "done" }).expect(200)).body as TaskRow;
    expect(reel).toMatchObject({ status: "done", completedBy: { name: "Divya Lakshmi" }, blocked: false });
    site = (await karthik.get(`/projects/${site.id}`).expect(200)).body as ProjectDetail;
    expect(site.progress).toMatchObject({ total: 6, done: 4, blocked: 1 }); // the hand-over waits for the client review
    await divya.delete(`/tasks/${site.tasks[3]!.id}`).expect(403);
  });
});

describe("tasks of your own", () => {
  it("are for yourself unless you may give tasks to others, and wait for nothing", async () => {
    const mine = (
      await vignesh
        .post("/tasks")
        .send(task({ title: "Clean the camera sensors", ownerId: ids.vignesh }))
        .expect(201)
    ).body as TaskRow;
    expect(mine).toMatchObject({ project: null, source: "manual", blocked: false });
    await vignesh
      .post("/tasks")
      .send(task({ title: "Back up the cards", ownerId: ids.divya }))
      .expect(403);
    await ashwin
      .post("/tasks")
      .send(task({ title: "Back up the cards", ownerId: ids.divya }))
      .expect(201);
    await vignesh
      .post("/tasks")
      .send(task({ title: "Charge the batteries", ownerId: ids.vignesh, dependsOnId: mine.id }))
      .expect(400);
    await divya.get("/tasks?scope=all").expect(403);
    expect(((await vignesh.get("/tasks/people").expect(200)).body as { name: string }[]).map((p) => p.name)).toContain("Divya Lakshmi");
    const all = (await ashwin.get("/tasks?scope=all").expect(200)).body as TaskRow[];
    expect(all.map((x) => x.title)).toEqual(expect.arrayContaining(["Clean the camera sensors", "Back up the cards"]));
    expect(all.every((x) => x.status !== "done")).toBe(true);
    expect((await vignesh.delete(`/tasks/${mine.id}`).expect(200)).body).toEqual({ removed: true });
  });
});

describe("commitments carried forward as tasks", () => {
  it("are done when the task is done", async () => {
    const c = (
      await ashwin
        .post("/commitments")
        .send({ text: "Shoot the B-roll for Kovai", ownerId: ids.vignesh, due: dayFrom(2) })
        .expect(201)
    ).body as CommitmentRow;
    await divya.post(`/tasks/from-commitment/${c.id}`).expect(403);
    const made = (await vignesh.post(`/tasks/from-commitment/${c.id}`).expect(201)).body as TaskRow;
    expect(made).toMatchObject({
      title: "Shoot the B-roll for Kovai",
      dueOn: dayFrom(2),
      source: "commitment",
      commitmentId: c.id,
      owner: { id: ids.vignesh },
    });
    expect((await vignesh.post(`/tasks/from-commitment/${c.id}`).expect(409)).body.message).toBe("It is already a task.");
    const listed = (await vignesh.get("/commitments?mine=true").expect(200)).body as CommitmentRow[];
    expect(listed.find((x) => x.id === c.id)).toMatchObject({ taskId: made.id, status: "open" });
    await vignesh.post(`/tasks/${made.id}/status`).send({ status: "done" }).expect(200);
    const after = (await vignesh.get("/commitments?mine=true").expect(200)).body as CommitmentRow[];
    expect(after.find((x) => x.id === c.id)).toMatchObject({ status: "done", mark: "BT" });
  });

  it("and the task is done when the commitment is", async () => {
    const c = (
      await ashwin
        .post("/commitments")
        .send({ text: "Send the Kovai quote", ownerId: ids.vignesh, due: dayFrom(3) })
        .expect(201)
    ).body as CommitmentRow;
    const made = (await ashwin.post(`/tasks/from-commitment/${c.id}`).expect(201)).body as TaskRow;
    await vignesh.post(`/commitments/${c.id}/done`).expect(200);
    const mine = (await vignesh.get("/tasks").expect(200)).body as TaskRow[];
    expect(mine.find((x) => x.id === made.id)).toMatchObject({ status: "done" });
    await vignesh.post(`/tasks/from-commitment/${c.id}`).expect(409);
  });
});

describe("other agencies", () => {
  it("see none of it", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get("/projects").expect(200)).body).toEqual([]);
    expect((await zara.get("/tasks").expect(200)).body).toEqual([]);
    await zara.get(`/projects/${site.id}`).expect(404);
    await zara.post(`/tasks/${reel.id}/status`).send({ status: "todo" }).expect(404);
  });
});
