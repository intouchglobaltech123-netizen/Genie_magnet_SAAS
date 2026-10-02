import { z } from "zod";

/** A server with real data: production, unless it is marked as a staging server (sample data only). */
const realData = (e: { NODE_ENV: string; APP_ENV?: string }) => (e.APP_ENV ?? e.NODE_ENV) === "production";

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /**
     * What the server holds. "staging": a shared test server with sample data only — it runs like production but may
     * keep test sign-in on and email confirmation off. "production": real data — neither is allowed. Leave it out to
     * follow NODE_ENV.
     */
    APP_ENV: z.enum(["staging", "production"]).optional(),
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
    /**
     * Confirm email addresses (a link on sign-up; required to accept an invitation). Off while the app is built
     * and tested, switched on in the last step before real use; the API refuses to start without it in production.
     */
    REQUIRE_EMAIL_VERIFICATION: z.stringbool().default(false),
    /** Requests per minute per person (or per IP when not signed in) on each API route. */
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
    /** Proxies in front of the API (1 on Railway), so the caller's IP is read from X-Forwarded-For. 0 locally. */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    /**
     * The API's own public address. Uploads go straight to it rather than through the web app, which would hold
     * the whole file in memory (cut off at 10 MB).
     */
    PUBLIC_API_URL: z.url().default("http://localhost:4000"),
    /** Where uploaded files are kept (a mounted volume on a server), each agency in its own folder. */
    FILES_DIR: z.string().default(".files"),
    /** Largest upload, in megabytes. */
    FILE_MAX_MB: z.coerce.number().int().min(1).max(10_000).default(1024),
    /** Signs upload and download links; falls back to BETTER_AUTH_SECRET. */
    FILES_SECRET: z.string().min(32, "FILES_SECRET must be at least 32 characters").optional(),
    /** Encrypts secrets kept in the database (WhatsApp and Razorpay keys, social tokens); falls back to BETTER_AUTH_SECRET. */
    SECRETS_KEY: z.string().min(32, "SECRETS_KEY must be at least 32 characters").optional(),
    /**
     * How WhatsApp messages leave (P3-07): "cloud" sends through each agency's own WhatsApp Cloud API number; "outbox"
     * keeps them in the app only (development and tests). Defaults to cloud in production.
     */
    WHATSAPP_PROVIDER: z.enum(["cloud", "outbox"]).optional(),
    WHATSAPP_API_URL: z.url().default("https://graph.facebook.com/v21.0"),
    /**
     * How payment links are made (P3-10): "razorpay" through each agency's own account; "outbox" makes pretend links in
     * the app only (development and tests). Defaults to razorpay in production.
     */
    PAYMENTS_PROVIDER: z.enum(["razorpay", "outbox"]).optional(),
    RAZORPAY_API_URL: z.url().default("https://api.razorpay.com/v1"),
    /**
     * How clients' Instagram, Facebook Pages and YouTube are reached (P3-11): "live" through our Meta app (META_APP_ID,
     * META_APP_SECRET) and Google app (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, also used for Google sign-in); a platform
     * whose app keys are missing is posted by hand. "outbox" uses pretend platforms (development and tests). Defaults
     * to live in production.
     */
    SOCIAL_PROVIDER: z.enum(["live", "outbox"]).optional(),
    META_APP_ID: z.string().optional(),
    META_APP_SECRET: z.string().optional(),
    META_GRAPH_URL: z.url().default("https://graph.facebook.com/v21.0"),
    /**
     * Run background jobs in this process (ADR 0010). On for a single server; off on the API when a separate worker
     * process (`node dist/worker.js`, always on) runs them. Off in tests, which run the jobs themselves.
     */
    RUN_JOBS: z.stringbool().default(false),
    /** When the daily jobs run, in UTC (02:30 UTC is 08:00 in India). */
    JOBS_DAILY_AT: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, e.g. 02:30")
      .default("02:30"),
    /** How often the job runner looks for work. */
    JOBS_POLL_SECONDS: z.coerce.number().int().min(1).max(300).default(10),
  })
  .refine((e) => !(e.NODE_ENV === "production" && e.AUTH_MODE === "dev-header"), {
    message: "AUTH_MODE=dev-header is not allowed in production",
    path: ["AUTH_MODE"],
  })
  .refine((e) => !(realData(e) && e.TEST_SIGN_IN), {
    message: "TEST_SIGN_IN is not allowed in production",
    path: ["TEST_SIGN_IN"],
  })
  .refine((e) => !(realData(e) && e.AUTH_MODE === "better-auth" && !e.REQUIRE_EMAIL_VERIFICATION), {
    message: "REQUIRE_EMAIL_VERIFICATION must be on in production",
    path: ["REQUIRE_EMAIL_VERIFICATION"],
  })
  .refine((e) => !(e.NODE_ENV === "production" && !e.SECRETS_KEY && !e.BETTER_AUTH_SECRET), {
    message: "Stored secrets need SECRETS_KEY (or BETTER_AUTH_SECRET) in production",
    path: ["SECRETS_KEY"],
  })
  .refine((e) => !(e.NODE_ENV === "production" && !e.FILES_SECRET && !e.BETTER_AUTH_SECRET), {
    message: "File links need FILES_SECRET (or BETTER_AUTH_SECRET) in production",
    path: ["FILES_SECRET"],
  })
  .refine((e) => e.AUTH_MODE !== "better-auth" || (e.AUTH_DATABASE_URL && e.BETTER_AUTH_SECRET), {
    message: "AUTH_MODE=better-auth needs AUTH_DATABASE_URL and BETTER_AUTH_SECRET",
    path: ["AUTH_MODE"],
  });

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol("ENV");

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Hosts such as Railway give the port in PORT.
  const r = envSchema.safeParse({ ...source, API_PORT: source.API_PORT ?? source.PORT });
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  • ${i.path.join(".") || "env"}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join("\n")}`);
  }
  return r.data;
}
