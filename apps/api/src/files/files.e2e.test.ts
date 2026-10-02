// File uploads with signed links (P1-05), on the sample agencies.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StoredFile, UploadStart } from "@gm/shared";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let ashwin: Agent; // manager: edits clients
let divya: Agent; // editor: sees clients only
let kaveriId: string;
const dir = mkdtempSync(join(tmpdir(), "gm-files-"));
const logo = Buffer.from("\x89PNG\r\n\x1a\n" + "x".repeat(2000));

/** The API is reached directly in tests: upload links carry its address, download links the web app's /api. */
const path = (url: string) => url.replace(/^\/api/, "").replace(/^https?:\/\/[^/]+/, "");
const raw = () => request(t.app.getHttpServer());

async function upload(a: Agent, body: Record<string, unknown>, bytes: Buffer) {
  const start = (await a.post("/files").send(body).expect(201)).body as UploadStart;
  const res = await raw().put(path(start.uploadUrl)).set("Content-Type", "image/png").send(bytes);
  return { start, res };
}

beforeAll(async () => {
  t = await startSeededApp({ FILES_DIR: dir, FILE_MAX_MB: "1" });
  [ashwin, divya] = await Promise.all(["ashwin", "divya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  kaveriId = ((await ashwin.get("/clients").expect(200)).body as { id: string; code: string }[]).find((c) => c.code === "KVR")!.id;
}, 180_000);

afterAll(async () => {
  await t?.stop();
  rmSync(dir, { recursive: true, force: true });
}, 60_000);

describe("files", () => {
  let file: StoredFile;

  it("upload through a signed link and download through another", async () => {
    const { res } = await upload(ashwin, { name: "Kaveri logo.png", mime: "image/png", size: logo.length, entity: "client", entityId: kaveriId }, logo);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Kaveri logo.png", size: logo.length, status: "ready" });

    const list = (await divya.get(`/files?entity=client&entityId=${kaveriId}`).expect(200)).body as StoredFile[];
    expect(list).toHaveLength(1);
    file = list[0]!;
    const got = await raw()
      .get(path(file.url!))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(got.status).toBe(200);
    expect(got.headers["content-type"]).toBe("image/png");
    expect(got.headers["content-disposition"]).toBe("inline; filename*=UTF-8''Kaveri%20logo.png");
    expect(Buffer.compare(got.body as Buffer, logo)).toBe(0);
  });

  it("follow the record's access: viewers see, only editors add or remove", async () => {
    await divya.post("/files").send({ name: "x.png", mime: "image/png", size: 10, entity: "client", entityId: kaveriId }).expect(403);
    await divya.delete(`/files/${file.id}`).expect(403);
  });

  it("refuse other kinds of file, too-large files, and uploads bigger than they said", async () => {
    const bad = await ashwin
      .post("/files")
      .send({ name: "setup.exe", mime: "application/x-msdownload", size: 10, entity: "client", entityId: kaveriId })
      .expect(400);
    expect(bad.body.issues[0]).toMatchObject({ path: "name", message: "This kind of file cannot be uploaded" });
    await ashwin
      .post("/files")
      .send({ name: "big.mp4", mime: "video/mp4", size: 2 * 1024 * 1024, entity: "client", entityId: kaveriId })
      .expect(413);

    const { start, res } = await upload(ashwin, { name: "small.png", mime: "image/png", size: 100, entity: "client", entityId: kaveriId }, logo);
    expect(res.status).toBe(413);
    // Nothing half-stored: the record stays pending and out of the list.
    const [row] = await t.sql<{ status: string }>(`SELECT status FROM files WHERE id = $1`, [start.id]);
    expect(row!.status).toBe("pending");
    expect(((await ashwin.get(`/files?entity=client&entityId=${kaveriId}`).expect(200)).body as StoredFile[]).map((f) => f.name)).toEqual(["Kaveri logo.png"]);
  });

  it("refuse forged links, and records that do not exist", async () => {
    await raw().put("/files/upload/abc.def").send(logo).expect(403);
    await raw()
      .get(`/files/download/${file.url!.split("/").pop()!.slice(0, -2)}xx`)
      .expect(403);
    await ashwin
      .post("/files")
      .send({ name: "a.png", mime: "image/png", size: 10, entity: "client", entityId: "019a0000-0000-7000-8000-0000000000ff" })
      .expect(404);
  });

  it("stay inside the agency", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get(`/files?entity=client&entityId=${kaveriId}`).expect(200)).body).toEqual([]);
  });

  it("are removed with their record of upload", async () => {
    await ashwin.delete(`/files/${file.id}`).expect(204);
    await raw().get(path(file.url!)).expect(404);
  });
});

describe("files from a client's onboarding link", () => {
  it("can be uploaded by the client and used in a files answer — only their own", async () => {
    const start = (await ashwin.post(`/clients/${kaveriId}/onboarding`).send({}).expect(201)).body as { id: string };
    const { link } = (await ashwin.post(`/onboarding/${start.id}/link`).expect(200)).body as { link: string };
    const token = link.split("/app/q/")[1]!;
    const up = (await raw().post(`/public/onboarding/${token}/files`).send({ name: "brand-guide.pdf", mime: "application/pdf", size: logo.length }).expect(201))
      .body as UploadStart;
    await raw().put(path(up.uploadUrl)).set("Content-Type", "application/pdf").send(logo).expect(200);

    await raw()
      .put(`/public/onboarding/${token}/answers/c29`)
      .send({ value: [`file:${up.id}`, "https://drive.example/kaveri"] })
      .expect(200);
    const view = (await raw().get(`/public/onboarding/${token}`).expect(200)).body as { files: Record<string, { name: string }> };
    expect(view.files[up.id]).toMatchObject({ name: "brand-guide.pdf" });
    const staff = (await ashwin.get(`/onboarding/${start.id}`).expect(200)).body as {
      answers: Record<string, { value: string[] }>;
      files: Record<string, unknown>;
    };
    expect(staff.answers.c29!.value).toEqual([`file:${up.id}`, "https://drive.example/kaveri"]);
    expect(Object.keys(staff.files)).toEqual([up.id]);

    // Another record's file cannot be slipped into the answer.
    const other = (await upload(ashwin, { name: "other.png", mime: "image/png", size: logo.length, entity: "client", entityId: kaveriId }, logo)).start;
    await raw()
      .put(`/public/onboarding/${token}/answers/c29`)
      .send({ value: [`file:${other.id}`] })
      .expect(400);
  });
});
