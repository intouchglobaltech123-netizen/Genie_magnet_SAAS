import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Inject, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { ENV, type Env } from "../env.js";
import { currentTenant } from "../tenancy/tenant-context.js";

export interface RateLimitRule {
  max: number;
  windowSeconds: number;
}

const RATE_LIMIT = Symbol("RATE_LIMIT");

/** Tighter limit for a route (public questionnaire links, P1-22), or `false` to exempt it (health checks). */
export const RateLimit = (rule: RateLimitRule | false) => SetMetadata(RATE_LIMIT, rule);

/**
 * Two limits, in fixed one-minute windows:
 * - per route, per person (signed in) or per IP address (not signed in) — RATE_LIMIT_PER_MINUTE or the route's own;
 * - per agency, over every route and everyone in it (P6-14) — RATE_LIMIT_AGENCY_PER_MINUTE — so one agency's scripts
 *   or a runaway screen cannot slow the platform for the others. Routes exempted with `RateLimit(false)` skip both.
 * Kept in memory: correct for one API process. When the API runs on several, this moves to Redis.
 * Sign-in routes are limited by Better Auth itself (auth.ts).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = Date.now();

  constructor(
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
  ) {}

  canActivate(context: ExecutionContext) {
    const rule = this.reflector.getAllAndOverride<RateLimitRule | false | undefined>(RATE_LIMIT, [context.getHandler(), context.getClass()]) ?? {
      max: this.env.RATE_LIMIT_PER_MINUTE,
      windowSeconds: 60,
    };
    if (rule === false) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const tenant = currentTenant();
    const who = tenant?.userId ? `user:${tenant.userId}` : `ip:${req.ip ?? "unknown"}`;
    const now = Date.now();
    this.sweep(now);

    this.take(`${context.getClass().name}.${context.getHandler().name}|${who}`, rule, now, res, (s) => `Too many requests. Try again in ${s} seconds.`);
    // The platform's support team in an agency counts toward it like anyone else.
    if (tenant?.agencyId)
      this.take(
        `agency:${tenant.agencyId}`,
        { max: this.env.RATE_LIMIT_AGENCY_PER_MINUTE, windowSeconds: 60 },
        now,
        res,
        (s) => `Your agency is sending too many requests at once. Try again in ${s} seconds.`,
      );
    return true;
  }

  private take(key: string, rule: RateLimitRule, now: number, res: Response, message: (seconds: number) => string) {
    const entry = this.hits.get(key);
    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + rule.windowSeconds * 1000 });
      return;
    }
    if (entry.count >= rule.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("retry-after", String(retryAfter));
      throw new HttpException({ message: message(retryAfter) }, HttpStatus.TOO_MANY_REQUESTS);
    }
    entry.count += 1;
  }

  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, entry] of this.hits) if (now >= entry.resetAt) this.hits.delete(key);
  }
}
