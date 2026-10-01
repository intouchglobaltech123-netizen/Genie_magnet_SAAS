import { z } from "zod";

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    /** Must be the genie_app role — row-level security has to apply to every API query. */
    DATABASE_URL: z.string().startsWith("postgres"),
    /** The genie_auth role — Better Auth only; it can reach the sign-in tables and nothing else. */
    AUTH_DATABASE_URL: z.string().startsWith("postgres").optional(),
    WEB_ORIGIN: z.url().default("http://localhost:3000"),
    /**
     * better-auth: the agency comes from the signed-in session (default).
     * dev-header: the agency comes from an `x-agency-id` header (local development and tests only).
     */
    AUTH_MODE: z.enum(["dev-header", "better-auth"]).default("dev-header"),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters").optional(),
    BETTER_AUTH_URL: z.url().default("http://localhost:4000"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    /** Pick a person and sign in without a password (test servers only — never with real data). */
    TEST_SIGN_IN: z.stringbool().default(false),
    /** Requests per minute per person (or per IP when not signed in) on each API route. */
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
    /** Proxies in front of the API (1 on Railway), so the caller's IP is read from X-Forwarded-For. 0 locally. */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  })
  .refine((e) => !(e.NODE_ENV === "production" && e.AUTH_MODE === "dev-header"), {
    message: "AUTH_MODE=dev-header is not allowed in production",
    path: ["AUTH_MODE"],
  })
  .refine((e) => !(e.NODE_ENV === "production" && e.TEST_SIGN_IN), {
    message: "TEST_SIGN_IN is not allowed in production",
    path: ["TEST_SIGN_IN"],
  })
  .refine((e) => e.AUTH_MODE !== "better-auth" || (e.AUTH_DATABASE_URL && e.BETTER_AUTH_SECRET), {
    message: "AUTH_MODE=better-auth needs AUTH_DATABASE_URL and BETTER_AUTH_SECRET",
    path: ["AUTH_MODE"],
  });

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol("ENV");

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const r = envSchema.safeParse(source);
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  • ${i.path.join(".") || "env"}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join("\n")}`);
  }
  return r.data;
}
