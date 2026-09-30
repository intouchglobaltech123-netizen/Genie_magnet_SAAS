import { AsyncLocalStorage } from "node:async_hooks";
import { Inject, Injectable, type NestMiddleware, UnauthorizedException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { forAgency, type TenantClient, withAgency } from "@gm/db";
import { ENV, type Env } from "../env.js";
import { PrismaService } from "../prisma/prisma.service.js";

export interface TenantContext {
  agencyId: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

export function currentTenant(): TenantContext | undefined {
  return storage.getStore();
}

/**
 * Resolves the agency for the request and keeps it for everything that runs in it.
 * Phase 0: `x-agency-id` header (dev and tests only). Phase 1: the Better Auth session's active agency.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(@Inject(ENV) private readonly env: Env) {}

  use(req: Request, _res: Response, next: NextFunction) {
    if (this.env.AUTH_MODE !== "dev-header") return next();
    const agencyId = req.header("x-agency-id");
    if (!agencyId) return next();
    storage.run({ agencyId, userId: req.header("x-user-id") ?? undefined }, () => next());
  }
}

/** The only way services reach the database: always scoped to the request's agency. */
@Injectable()
export class TenantDb {
  constructor(private readonly prisma: PrismaService) {}

  private ctx(): TenantContext {
    const ctx = storage.getStore();
    if (!ctx) throw new UnauthorizedException("No agency selected for this request.");
    return ctx;
  }

  get agencyId() {
    return this.ctx().agencyId;
  }

  get userId() {
    return this.ctx().userId;
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
