// Password self-service: someone who forgot their password asks for a link and chooses a new one — which signs out
// every other device — and anyone signed in can change their own password. Asking never says whether the address has
// an account. Emails go to the outbox until email sending is set up (the last step).
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type SeededApp, ORIGIN, startSeededApp } from "../test/seeded-app.js";
import { Outbox } from "./outbox.js";

let t: SeededApp;
let outbox: Outbox;
let signedIn: request.Agent; // signed in with the new password
const EMAIL = "lata@passwords.test";
const anon = () => request(t.app.getHttpServer());
const post = (a: request.Agent | request.SuperTest<request.Test>, path: string, body: object) => a.post(path).set("Origin", ORIGIN).send(body);
const signIn = (password: string) => post(request.agent(t.app.getHttpServer()), "/api/auth/sign-in/email", { email: EMAIL, password });

beforeAll(async () => {
  t = await startSeededApp();
  outbox = t.app.get(Outbox);
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("forgot password", () => {
  let browser: request.Agent; // signed in elsewhere when the password is reset
  let token: string;

  it("sends a link to choose a new password — and says the same for an address with no account", async () => {
    browser = request.agent(t.app.getHttpServer());
    await post(browser, "/api/auth/sign-up/email", { name: "Lata Krishnan", email: EMAIL, password: "first-password-1" }).expect(200);
    await browser.get("/me").expect(200);

    const redirectTo = `${ORIGIN}/app/reset-password`;
    const sent = await post(anon(), "/api/auth/request-password-reset", { email: EMAIL, redirectTo }).expect(200);
    const unknown = await post(anon(), "/api/auth/request-password-reset", { email: "nobody@passwords.test", redirectTo }).expect(200);
    expect(unknown.body).toEqual(sent.body);
    expect(outbox.last("nobody@passwords.test")).toBeUndefined();

    const email = outbox.last(EMAIL)!;
    expect(email.subject).toBe("Reset your Genie Magnet OS password");
    // The link checks the token, then sends the browser to our page with it.
    const link = new URL(email.link!);
    const back = await anon().get(`${link.pathname}${link.search}`).expect(302);
    const page = new URL(back.headers.location as string);
    expect(`${page.origin}${page.pathname}`).toBe(redirectTo);
    token = page.searchParams.get("token")!;
    expect(token).toBeTruthy();
  });

  it("takes a new password of at least 10 characters, once, and signs out every other device", async () => {
    await post(anon(), "/api/auth/reset-password", { token, newPassword: "short" }).expect(400);
    await post(anon(), "/api/auth/reset-password", { token, newPassword: "second-password-2" }).expect(200);
    await post(anon(), "/api/auth/reset-password", { token, newPassword: "third-password-3" }).expect(400); // used already
    await browser.get("/me").expect(401);
    await signIn("first-password-1").expect(401);
    signedIn = request.agent(t.app.getHttpServer());
    await post(signedIn, "/api/auth/sign-in/email", { email: EMAIL, password: "second-password-2" }).expect(200);
  });
});

describe("changing your password", () => {
  it("needs the current one, and the new one signs in from then on", { timeout: 30_000 }, async () => {
    const me = signedIn;
    await post(me, "/api/auth/change-password", { currentPassword: "not-my-password", newPassword: "fourth-password-4" }).expect(400);
    await post(me, "/api/auth/change-password", { currentPassword: "second-password-2", newPassword: "fourth-password-4", revokeOtherSessions: true }).expect(
      200,
    );
    // Sign-in allows three tries every ten seconds from one address; let the window pass.
    await new Promise((r) => setTimeout(r, 10_500));
    await signIn("second-password-2").expect(401);
    await signIn("fourth-password-4").expect(200);
  });
});
