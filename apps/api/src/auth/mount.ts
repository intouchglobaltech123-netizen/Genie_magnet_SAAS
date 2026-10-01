import { AsyncLocalStorage } from "node:async_hooks";
import type { Express, Request, Response } from "express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import type { Auth } from "./auth.js";

const actor = new AsyncLocalStorage<{ userId?: string }>();

/**
 * The signed-in person behind an agency change made by Better Auth. Its hooks are told whose membership
 * changed, not who changed it, so the audit log needs this.
 */
export function currentActorId() {
  return actor.getStore()?.userId;
}

/** Serves Better Auth at /api/auth. Agency changes (invite, role, remove…) run knowing who made them. */
export function mountAuth(express: Express, auth: Auth) {
  // Express's request and response are Node's; the cast only bridges two copies of the Node types in the workspace.
  const handler = toNodeHandler(auth) as unknown as (req: Request, res: Response) => Promise<void>;
  express.all("/api/auth/*splat", async (req: Request, res: Response) => {
    if (req.method !== "POST" || !req.path.startsWith("/api/auth/organization/")) return handler(req, res);
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
    return actor.run({ userId: session?.user.id }, () => handler(req, res));
  });
}
