import { AsyncLocalStorage } from "node:async_hooks";
import { Inject, Injectable, type NestMiddleware, Optional, UnauthorizedException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { createPrisma, forAgency, type TenantClient, withAgency } from "@gm/db";
import { AUTH, AUTH_PRISMA, type Auth } from "../auth/auth.js";
import { ENV, type Env } from "../env.js";
import { PrismaService } from "../prisma/prisma.service.js";

export interface TenantContext {
  agencyId: string;
  userId?: string;
  /** The member's role key in this agency (permissions come from the agency's matrix). */
  role?: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

export function currentTenant(): TenantContext | undefined {
  return storage.getStore();
}

/**
 * Resolves the agency for the request and keeps it for everything that runs in it.
 * better-auth: the session's active agency, checked against a live membership on every request, so a person
 * removed from an agency loses access at once even if their session still points at it.
 * dev-header: `x-agency-id` (local development and tests only; refused in production by env.ts).
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Optional() @Inject(AUTH) private readonly auth: Auth | null,
    @Optional() @Inject(AUTH_PRISMA) private readonly authDb: ReturnType<typeof createPrisma> | null,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    if (this.env.AUTH_MODE === "dev-header") {
      const agencyId = req.header("x-agency-id");
      if (!agencyId) return next();
      return storage.run({ agencyId, userId: req.header("x-user-id") ?? undefined }, () => next());
    }

    if (!this.auth || !this.authDb) return next();
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    const agencyId = session?.session.activeOrganizationId;
    if (!session || !agencyId) return next();
    const membership = await this.authDb.membership.findFirst({ where: { agencyId, userId: session.user.id }, select: { role: true } });
    if (!membership) return next();
    storage.run({ agencyId, userId: session.user.id, role: membership.role }, () => next());
  }
}

/** The only way services reach the database: always scoped to the request's agency. */
@Injectable()
export class TenantDb {
  constructor(private readonly prisma: PrismaService) {}

  private ctx(): TenantContext {
    const ctx = storage.getStore();
    if (!ctx) throw new UnauthorizedException("Sign in and choose an agency first.");
    return ctx;
  }

  get agencyId() {
    return this.ctx().agencyId;
  }

  get userId() {
    return this.ctx().userId;
  }

  get role() {
    return this.ctx().role;
  }

  /** Single operations. */
  get db(): TenantClient {
    const { agencyId, userId } = this.ctx();
    return forAgency(this.prisma.client, agencyId, userId);
  }

  /** Several operations in one transaction. */
  tx<T>(fn: Parameters<typeof withAgency<T>>[2]) {
    const { agencyId, userId } = this.ctx();
    return withAgency(this.prisma.client, agencyId, fn, userId);
  }
}
