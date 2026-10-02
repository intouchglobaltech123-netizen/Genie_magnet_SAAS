// The LinkedIn and X connectors (P5-22) against recorded answers: the sign-in's proof key, the company pages, the video
// going up in the pieces the platform asks for, waiting while it is processed, and the post.
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveSocialNetworks, PermanentSocialError } from "./provider.js";

const nets = new LiveSocialNetworks({
  graphUrl: "https://graph.facebook.com/v21.0",
  linkedinClientId: "li-id",
  linkedinClientSecret: "li-secret",
  linkedinVersion: "202608",
  xClientId: "x-id",
  xClientSecret: "x-secret",
});
const file = Buffer.from("0123456789abcdefghij");
const input = {
  title: "Festive range",
  caption: "Festive (new) range #tiruppur @kovai",
  fileUrl: "https://files.example/v",
  mime: "video/mp4",
  size: file.length,
  open: async () => Readable.from([file.subarray(0, 7), file.subarray(7)]),
};

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
/** Answers each request the connector makes, keeping what it sent. */
function stub(answer: (c: Call) => Response) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const c = { url, method: init.method ?? "GET", headers: Object.fromEntries(new Headers(init.headers).entries()), body: init.body };
    calls.push(c);
    return answer(c);
  });
  return calls;
}
const json = (data: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json", ...headers } });
const missing = () => new Response("{}", { status: 404 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("X", () => {
  it("proves the sign-in with a key made from its state", async () => {
    const x = nets.get("x")!;
    const url = new URL(x.authUrl("the-state", "https://api.example/webhooks/social/x"));
    expect(`${url.origin}${url.pathname}`).toBe("https://x.com/i/oauth2/authorize");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")?.split(" ")).toEqual(expect.arrayContaining(["tweet.write", "media.write", "offline.access"]));
    const calls = stub(() => json({ access_token: "at", refresh_token: "rt", expires_in: 7200 }));
    expect(await x.exchange("the-code", "https://api.example/webhooks/social/x", "the-state")).toMatchObject({ accessToken: "at", refreshToken: "rt" });
    const verifier = new URLSearchParams(calls[0]!.body as string).get("code_verifier")!;
    expect(createHash("sha256").update(verifier).digest("base64url")).toBe(url.searchParams.get("code_challenge"));
    expect(calls[0]!.headers.authorization).toBe(`Basic ${Buffer.from("x-id:x-secret").toString("base64")}`);
  });

  it("uploads the video, waits while X processes it, then posts it", async () => {
    const x = nets.get("x")!;
    let state = "in_progress";
    const calls = stub((c) => {
      if (c.url.endsWith("/media/upload/initialize")) return json({ data: { id: "m1" } });
      if (c.url.endsWith("/media/upload/m1/append")) return json({});
      if (c.url.endsWith("/media/upload/m1/finalize")) return json({ data: { processing_info: { state: "pending" } } });
      if (c.url.includes("command=STATUS")) return json({ data: { processing_info: { state } } });
      if (c.url.endsWith("/tweets")) return json({ data: { id: "t9" } });
      return missing();
    });
    const account = { id: "u1", accessToken: "at" };
    expect(await x.publish(account, input)).toEqual({ done: false, uploadId: "m1" });
    expect(calls.filter((c) => c.url.endsWith("/append"))).toHaveLength(1);
    expect(await x.publish(account, input, "m1")).toEqual({ done: false, uploadId: "m1" });
    state = "succeeded";
    expect(await x.publish(account, input, "m1")).toEqual({ done: true, id: "t9", url: "https://x.com/i/web/status/t9" });
    expect(JSON.parse(calls.at(-1)!.body as string)).toEqual({ text: input.caption, media: { media_ids: ["m1"] } });
    state = "failed";
    await expect(x.publish(account, input, "m1")).rejects.toBeInstanceOf(PermanentSocialError);
  });
});

describe("LinkedIn", () => {
  it("lists the company pages the person administers", async () => {
    const li = nets.get("linkedin")!;
    stub((c) =>
      c.url.includes("/organizationAcls?")
        ? json({ elements: [{ organization: "urn:li:organization:5" }, { organization: "urn:li:organization:5" }] })
        : c.url.endsWith("/organizations/5")
          ? json({ localizedName: "Tiruppur Knits", vanityName: "tiruppur-knits" })
          : missing(),
    );
    expect(await li.accounts({ accessToken: "at" }, { handle: "tiruppur-knits" })).toEqual([
      { id: "urn:li:organization:5", name: "Tiruppur Knits", handle: "tiruppur-knits" },
    ]);
  });

  it("uploads the video in the pieces LinkedIn asks for, then posts it once processed", async () => {
    const li = nets.get("linkedin")!;
    let status = "PROCESSING";
    const sent: string[] = [];
    const calls = stub((c) => {
      if (c.url.endsWith("/videos?action=initializeUpload"))
        return json({
          value: {
            video: "urn:li:video:V1",
            uploadToken: "",
            uploadInstructions: [
              { uploadUrl: "https://up.example/2", firstByte: 12, lastByte: 19 },
              { uploadUrl: "https://up.example/1", firstByte: 0, lastByte: 11 },
            ],
          },
        });
      if (c.url.startsWith("https://up.example/")) {
        sent.push(Buffer.from(c.body as Uint8Array).toString());
        return new Response(null, { status: 200, headers: { etag: `e${c.url.slice(-1)}` } });
      }
      if (c.url.endsWith("/videos?action=finalizeUpload")) return json({});
      if (c.url.includes("/videos/urn")) return json({ status });
      if (c.url.endsWith("/posts")) return new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:7" } });
      return missing();
    });
    const page = { id: "urn:li:organization:5", accessToken: "at" };
    expect(await li.publish(page, input)).toEqual({ done: false, uploadId: "urn:li:video:V1" });
    expect(sent).toEqual(["0123456789ab", "cdefghij"]);
    expect(JSON.parse(calls.find((c) => c.url.endsWith("action=finalizeUpload"))!.body as string).finalizeUploadRequest.uploadedPartIds).toEqual(["e1", "e2"]);
    expect(calls[0]!.headers["linkedin-version"]).toBe("202608");
    status = "AVAILABLE";
    expect(await li.publish(page, input, "urn:li:video:V1")).toEqual({
      done: true,
      id: "urn:li:share:7",
      url: "https://www.linkedin.com/feed/update/urn:li:share:7/",
    });
    expect(JSON.parse(calls.at(-1)!.body as string)).toMatchObject({
      author: "urn:li:organization:5",
      commentary: "Festive \\(new\\) range \\#tiruppur \\@kovai",
      visibility: "PUBLIC",
      content: { media: { id: "urn:li:video:V1", title: "Festive range" } },
    });
    status = "PROCESSING_FAILED";
    await expect(li.publish(page, input, "urn:li:video:V1")).rejects.toBeInstanceOf(PermanentSocialError);
  });
});
