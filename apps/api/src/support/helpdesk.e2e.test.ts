// The support inbox (P6-15): someone in an agency writes to the platform's support team from the app; the support team
// answers from the platform console; the person who wrote is told, and the conversation carries on until closed.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TicketDetail, TicketRow } from "@gm/shared";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let divya: Agent; // editor at Genie Magnet
let surya: Agent; // another editor
let jana: Agent; // owner: sees all of the agency's messages
let zara: Agent; // Zen Studio
let anitha: Agent; // on the platform's support team (and in Genie Magnet's accounts)
let ticket: TicketDetail;

beforeAll(async () => {
  t = await startSeededApp({ PLATFORM_ADMIN_EMAILS: "anitha@geniemagnet.test" });
  [divya, surya, jana, zara, anitha] = await Promise.all(
    ["divya@geniemagnet.test", "surya@geniemagnet.test", "jana@geniemagnet.test", "zara@zenstudio.test", "anitha@geniemagnet.test"].map((e) => t.signInAs(e)),
  );
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("writing to support", () => {
  it("anyone on the team can, saying what it is about", async () => {
    expect((await divya.post("/support/tickets").send({ subject: "Hi", category: "problem", body: "short" }).expect(400)).body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "subject" }), expect.objectContaining({ path: "body" })]),
    );
    ticket = (
      await divya
        .post("/support/tickets")
        .send({
          subject: "The video will not move to review",
          category: "problem",
          body: "KVR-1026-03 stays in editing when I press Send to review.",
          page: "/app/production",
        })
        .expect(201)
    ).body as TicketDetail;
    expect(ticket).toMatchObject({
      status: "open",
      category: "problem",
      page: "/app/production",
      createdBy: { name: "Divya Lakshmi" },
      ref: expect.stringMatching(/^[0-9A-F]{6}$/),
    });
    expect(ticket.messages).toEqual([expect.objectContaining({ fromSupport: false, author: "Divya Lakshmi" })]);
  });

  it("is seen by the person who wrote and those who keep the settings, and by no other agency", async () => {
    const ids = async (a: Agent) => ((await a.get("/support/tickets").expect(200)).body as TicketRow[]).map((r) => r.id);
    expect(await ids(divya)).toEqual([ticket.id]);
    expect(await ids(jana)).toEqual([ticket.id]);
    expect(await ids(surya)).toEqual([]);
    await surya.get(`/support/tickets/${ticket.id}`).expect(404);
    await zara.get(`/support/tickets/${ticket.id}`).expect(404);
    expect(await ids(zara)).toEqual([]);
  });
});

describe("the support team", () => {
  it("sees every agency's in the console — and nobody else can", async () => {
    await jana.get("/platform/support/tickets").expect(403);
    await zara
      .post("/support/tickets")
      .send({ subject: "Can we add a second WhatsApp number?", category: "question", body: "We have two branches with their own numbers." })
      .expect(201);
    const all = (await anitha.get("/platform/support/tickets").expect(200)).body as TicketRow[];
    expect(all.map((r) => [r.agency?.name, r.subject])).toEqual(
      expect.arrayContaining([
        ["Genie Magnet", "The video will not move to review"],
        ["Zen Studio (test agency)", "Can we add a second WhatsApp number?"],
      ]),
    );
  });

  it("replies, and the person who wrote is told; the conversation goes on until it is closed", async () => {
    let d = (
      await anitha.post(`/platform/support/tickets/${ticket.id}/messages`).send({ body: "Thanks — could you send the request id from the error?" }).expect(201)
    ).body as TicketDetail;
    expect(d.status).toBe("answered");
    const notes = (await divya.get("/notifications").expect(200)).body.items as { kind: string; title: string; link: string }[];
    expect(notes.find((n) => n.kind === "support_reply")).toMatchObject({
      title: "Support replied: The video will not move to review",
      link: `/app/support/${ticket.id}`,
    });

    d = (await divya.post(`/support/tickets/${ticket.id}/messages`).send({ body: "It is 3f2a91c0." }).expect(201)).body as TicketDetail;
    expect(d.status).toBe("open");
    expect(d.messages.map((m) => [m.fromSupport, m.author])).toEqual([
      [false, "Divya Lakshmi"],
      [true, "Anitha Rajan"],
      [false, "Divya Lakshmi"],
    ]);

    d = (await anitha.post(`/platform/support/tickets/${ticket.id}/messages`).send({ body: "Fixed in today's update.", close: true }).expect(201))
      .body as TicketDetail;
    expect(d.status).toBe("closed");
    expect((await divya.post(`/support/tickets/${ticket.id}/messages`).send({ body: "Thank you!" }).expect(409)).body.message).toBe(
      "This conversation is closed. Write a new message instead.",
    );
  });
});
