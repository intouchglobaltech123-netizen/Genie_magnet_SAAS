import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("applies defaults for local development", () => {
    const env = loadEnv({ DATABASE_URL: "postgresql://genie_app:x@localhost:5432/genie" });
    expect(env).toMatchObject({ NODE_ENV: "development", API_PORT: 4000, AUTH_MODE: "dev-header" });
  });

  it("limits each agency as a whole, and leaves the API docs to the server's kind when not chosen (P6-14)", () => {
    const db = { DATABASE_URL: "postgresql://x" };
    expect(loadEnv(db).RATE_LIMIT_AGENCY_PER_MINUTE).toBe(6000);
    expect(loadEnv(db).API_DOCS).toBeUndefined();
    expect(loadEnv({ ...db, API_DOCS: "" }).API_DOCS).toBeUndefined();
    expect(loadEnv({ ...db, API_DOCS: "false", RATE_LIMIT_AGENCY_PER_MINUTE: "1200" })).toMatchObject({ API_DOCS: false, RATE_LIMIT_AGENCY_PER_MINUTE: 1200 });
  });

  it("fails fast with a readable message when DATABASE_URL is missing", () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it("refuses the development agency header in production", () => {
    expect(() => loadEnv({ NODE_ENV: "production", DATABASE_URL: "postgresql://x" })).toThrow(/dev-header is not allowed in production/);
    const secret = "x".repeat(32);
    expect(
      loadEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://x",
        AUTH_DATABASE_URL: "postgresql://y",
        BETTER_AUTH_SECRET: secret,
        AUTH_MODE: "better-auth",
        REQUIRE_EMAIL_VERIFICATION: "true",
      }).AUTH_MODE,
    ).toBe("better-auth");
  });

  it("needs the auth database and a strong secret for real sign-in", () => {
    expect(() => loadEnv({ DATABASE_URL: "postgresql://x", AUTH_MODE: "better-auth" })).toThrow(/needs AUTH_DATABASE_URL and BETTER_AUTH_SECRET/);
    expect(() =>
      loadEnv({ DATABASE_URL: "postgresql://x", AUTH_DATABASE_URL: "postgresql://y", BETTER_AUTH_SECRET: "short", AUTH_MODE: "better-auth" }),
    ).toThrow(/at least 32/);
  });

  it("refuses test sign-in in production", () => {
    const prod = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://x",
      AUTH_DATABASE_URL: "postgresql://y",
      BETTER_AUTH_SECRET: "x".repeat(32),
      AUTH_MODE: "better-auth",
      REQUIRE_EMAIL_VERIFICATION: "true",
    };
    expect(() => loadEnv({ ...prod, TEST_SIGN_IN: "true" })).toThrow(/TEST_SIGN_IN is not allowed in production/);
    expect(loadEnv(prod).TEST_SIGN_IN).toBe(false);
    expect(loadEnv({ DATABASE_URL: "postgresql://x", TEST_SIGN_IN: "true" }).TEST_SIGN_IN).toBe(true);
  });

  it("leaves email confirmation off while testing, and refuses production without it", () => {
    expect(loadEnv({ DATABASE_URL: "postgresql://x" }).REQUIRE_EMAIL_VERIFICATION).toBe(false);
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://x",
        AUTH_DATABASE_URL: "postgresql://y",
        BETTER_AUTH_SECRET: "x".repeat(32),
        AUTH_MODE: "better-auth",
      }),
    ).toThrow(/REQUIRE_EMAIL_VERIFICATION must be on in production/);
  });

  it("listens on the host's PORT when API_PORT is not set", () => {
    expect(loadEnv({ DATABASE_URL: "postgresql://x", PORT: "8080" }).API_PORT).toBe(8080);
    expect(loadEnv({ DATABASE_URL: "postgresql://x", PORT: "8080", API_PORT: "4001" }).API_PORT).toBe(4001);
  });

  it("lets a staging server (sample data only) keep test sign-in on, and never a server marked as production", () => {
    const server = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://x",
      AUTH_DATABASE_URL: "postgresql://y",
      BETTER_AUTH_SECRET: "x".repeat(32),
      AUTH_MODE: "better-auth",
      TEST_SIGN_IN: "true",
    };
    expect(loadEnv({ ...server, APP_ENV: "staging" })).toMatchObject({ TEST_SIGN_IN: true, REQUIRE_EMAIL_VERIFICATION: false });
    expect(() => loadEnv({ ...server, APP_ENV: "production" })).toThrow(/TEST_SIGN_IN is not allowed in production/);
    expect(() => loadEnv({ DATABASE_URL: "postgresql://x", APP_ENV: "production", TEST_SIGN_IN: "true" })).toThrow(/TEST_SIGN_IN/);
    // Staging still runs like production: no development agency header.
    expect(() => loadEnv({ ...server, APP_ENV: "staging", AUTH_MODE: "dev-header" })).toThrow(/dev-header/);
  });
});
