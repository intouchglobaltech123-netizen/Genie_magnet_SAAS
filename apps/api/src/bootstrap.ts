import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Express } from "express";
import { AUTH, type Auth } from "./auth/auth.js";
import { mountAuth } from "./auth/mount.js";
import { expressErrorHandler } from "./common/error.filter.js";
import { requestContext } from "./common/request-context.js";
import { ENV, type Env } from "./env.js";

/**
 * Shared by main.ts and the tests so both run the same HTTP pipeline:
 * request id and log → CORS → sign-in (Better Auth) → JSON body → Nest (tenant, rate limit, routes, error filter).
 * The app must be created with `bodyParser: false` (Better Auth reads the raw request body, so its handler is mounted
 * before the JSON parser) and `rawBody: true` (webhooks check signatures over the exact bytes).
 */
export function configureApp(app: NestExpressApplication) {
  const env = app.get<Env>(ENV);
  const auth = app.get<Auth | null>(AUTH, { strict: false });
  const express = app.getHttpAdapter().getInstance() as Express;
  express.disable("x-powered-by");
  express.set("trust proxy", env.TRUST_PROXY);
  express.use(requestContext());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  if (auth) mountAuth(express, auth);
  // The app is created with rawBody, so webhooks (WhatsApp, payments) can check a signature over the exact bytes sent.
  app.useBodyParser("json", { limit: "1mb" });
  express.use(expressErrorHandler());
  app.enableShutdownHooks();
  return app;
}
