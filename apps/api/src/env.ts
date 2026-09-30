import { z } from "zod";

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    /** Must be the genie_app role — row-level security has to apply to every API query. */
    DATABASE_URL: z.string().startsWith("postgres"),
    WEB_ORIGIN: z.url().default("http://localhost:3000"),
    /**
     * dev-header: the agency comes from an `x-agency-id` header (local development and tests only).
     * better-auth: the agency comes from the signed-in session (Phase 1).
     */
    AUTH_MODE: z.enum(["dev-header", "better-auth"]).default("dev-header"),
  })
  .refine((e) => !(e.NODE_ENV === "production" && e.AUTH_MODE === "dev-header"), {
    message: "AUTH_MODE=dev-header is not allowed in production",
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
