import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const log = new Logger("HTTP");
const INCOMING_ID = /^[A-Za-z0-9-]{8,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_LIKE = /^[A-Za-z0-9_-]{24,}$/;

/** What the request log may know about the caller — ids only, never names, emails or IP addresses. */
export interface RequestLocals {
  requestId: string;
  tenant?: { agencyId: string; userId?: string };
  /** Someone from the platform's own team, on a platform endpoint (ADR 0011). */
  platformUser?: { id: string; name: string };
}

export function locals(res: Response) {
  return res.locals as Partial<RequestLocals>;
}

/**
 * Path for logs: no query string (sign-in links carry tokens there) and any token-like segment
 * (public questionnaire links) replaced, so logs never hold something that grants access.
 */
export function safePath(req: Request) {
  const path = (req.originalUrl ?? req.url).split("?")[0] ?? "/";
  return path
    .split("/")
    .map((s) => (TOKEN_LIKE.test(s) && !UUID.test(s) ? ":token" : s))
    .join("/");
}

/**
 * First thing every request passes through, sign-in routes included: a request id (kept from the caller's
 * `x-request-id` when it looks like one), basic security headers, and one log line when the response is sent.
 */
export function requestContext() {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header("x-request-id");
    const requestId = incoming && INCOMING_ID.test(incoming) ? incoming : randomUUID();
    locals(res).requestId = requestId;
    res.setHeader("x-request-id", requestId);
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("referrer-policy", "no-referrer");

    const started = process.hrtime.bigint();
    res.on("finish", () => {
      const path = safePath(req);
      // Uptime checks hit /health every minute; only failures are worth a line.
      if (path.startsWith("/health") && res.statusCode < 400) return;
      const ms = Number((process.hrtime.bigint() - started) / 1_000_000n);
      const { tenant } = locals(res);
      const entry = { requestId, method: req.method, path, status: res.statusCode, ms, agencyId: tenant?.agencyId, userId: tenant?.userId };
      const message = `${req.method} ${path} ${res.statusCode} ${ms}ms`;
      if (res.statusCode >= 500) log.error(message, entry);
      else if (res.statusCode >= 400) log.warn(message, entry);
      else log.log(message, entry);
    });
    next();
  };
}
