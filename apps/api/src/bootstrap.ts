import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Express, Request, Response } from "express";
import { toNodeHandler } from "better-auth/node";
import { AUTH, type Auth } from "./auth/auth.js";
import { expressErrorHandler } from "./common/error.filter.js";
import { requestContext } from "./common/request-context.js";
import { ENV, type Env } from "./env.js";

/**
 * Shared by main.ts and the tests so both run the same HTTP pipeline:
 * request id and log → CORS → sign-in (Better Auth) → JSON body → Nest (tenant, rate limit, routes, error filter).
 * The app must be created with `bodyParser: false`: Better Auth reads the raw request body,
 * so its handler is mounted before the JSON parser.
 */
export function configureApp(app: NestExpressApplication) {
  const env = app.get<Env>(ENV);
  const auth = app.get<Auth | null>(AUTH, { strict: false });
  const express = app.getHttpAdapter().getInstance() as Express;
  express.disable("x-powered-by");
  express.set("trust proxy", env.TRUST_PROXY);
  express.use(requestContext());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  if (auth) {
    // Express's request and response are Node's; the cast only bridges two copies of the Node types in the workspace.
    const handler = toNodeHandler(auth) as unknown as (req: Request, res: Response) => Promise<void>;
    express.all("/api/auth/*splat", (req: Request, res: Response) => void handler(req, res));
  }
  app.useBodyParser("json", { limit: "1mb" });
  express.use(expressErrorHandler());
  app.enableShutdownHooks();
  return app;
}
