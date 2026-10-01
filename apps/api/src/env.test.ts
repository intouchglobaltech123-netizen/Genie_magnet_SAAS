import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("applies defaults for local development", () => {
    const env = loadEnv({ DATABASE_URL: "postgresql://genie_app:x@localhost:5432/genie" });
    expect(env).toMatchObject({ NODE_ENV: "development", API_PORT: 4000, AUTH_MODE: "dev-header" });
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
});
