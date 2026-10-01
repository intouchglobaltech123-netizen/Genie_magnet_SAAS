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
 * Requests per person (signed in) or per IP address (not signed in), in a fixed window.
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
    const who = currentTenant()?.userId ? `user:${currentTenant()?.userId}` : `ip:${req.ip ?? "unknown"}`;
    const key = `${context.getClass().name}.${context.getHandler().name}|${who}`;
    const now = Date.now();
    this.sweep(now);

    const entry = this.hits.get(key);
    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + rule.windowSeconds * 1000 });
      return true;
    }
    if (entry.count >= rule.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      context.switchToHttp().getResponse<Response>().setHeader("retry-after", String(retryAfter));
      throw new HttpException({ message: `Too many requests. Try again in ${retryAfter} seconds.` }, HttpStatus.TOO_MANY_REQUESTS);
    }
    entry.count += 1;
    return true;
  }

  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, entry] of this.hits) if (now >= entry.resetAt) this.hits.delete(key);
  }
}
