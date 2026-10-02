import { AsyncLocalStorage } from "node:async_hooks";
import { ForbiddenException, Inject, Injectable, type NestMiddleware, Optional, UnauthorizedException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { createPrisma, forAgency, type TenantClient, withAgency } from "@gm/db";
import { type AreaKey, FULL_ACCESS, OWNER_ROLE, type PermissionMatrix, scopeOf, type Entitlements } from "@gm/shared";
import { AUTH, AUTH_PRISMA, type Auth } from "../auth/auth.js";
import { locals } from "../common/request-context.js";
import { ENV, type Env } from "../env.js";
import { PrismaService } from "../prisma/prisma.service.js";

export interface TenantContext {
  agencyId: string;
  userId?: string;
  /** The member's role key in this agency (permissions come from the agency's matrix). */
  role: string;
  /** The role's row of the agency's permission matrix, read fresh for every request by the permission guard. */
  permissions?: PermissionMatrix;
  /** A client contact in their portal (P3-01): everything is limited to this client. */
  portal?: PortalPerson;
  /** The agency's plan: its suites, limits and whether it is read-only (ADR 0011), read once per request. */
  entitlements?: Entitlements;
}

export interface PortalPerson {
  clientId: string;
  contactId: string;
  name: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

export function currentTenant(): TenantContext | undefined {
  return storage.getStore();
}

/**
 * Runs `fn` inside one agency for someone who is not signed in: a client answering by private link (P1-22). The link
 * has already been checked; no permissions are given, so only code written for the link runs.
 */
export function asLinkHolder<T>(agencyId: string, fn: () => Promise<T>): Promise<T> {
  return storage.run({ agencyId, role: "link", permissions: {} }, fn);
}

/**
 * Runs `fn` inside one agency for a client contact in their portal (P3-01). The link has already been checked. The
 * portal may read content and production (the portal service limits every read and change to the contact's client)
 * and nothing else; changes are recorded as made by the contact.
 */
export function asPortal<T>(agencyId: string, portal: PortalPerson, fn: () => Promise<T>): Promise<T> {
  return storage.run({ agencyId, role: "portal", permissions: { content: { level: "view" }, production: { level: "view" } }, portal }, fn);
}

/**
 * Runs `fn` inside one agency as the app itself: a background job (ADR 0010). Nobody is signed in, so nothing is
 * recorded against a person and nobody is left out of a notification — unless the work finishes something a person
 * started elsewhere (a platform's sign-in coming back, P3-11), when it is recorded as theirs.
 */
export function asSystem<T>(agencyId: string, fn: () => Promise<T>, onBehalfOf?: string): Promise<T> {
  return storage.run({ agencyId, role: "system", permissions: FULL_ACCESS, ...(onBehalfOf && { userId: onBehalfOf }) }, fn);
}

/**
 * Resolves the agency for the request and keeps it for everything that runs in it.
 * better-auth: the session's active agency, checked against a live membership on every request, so a person
 * removed from an agency loses access at once even if their session still points at it.
 * dev-header: `x-agency-id`, `x-user-id` and `x-role` (owner when left out) — local development and tests only;
 * refused in production by env.ts.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Optional() @Inject(AUTH) private readonly auth: Auth | null,
    @Optional() @Inject(AUTH_PRISMA) private readonly authDb: ReturnType<typeof createPrisma> | null,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const run = (ctx: TenantContext) => {
      locals(res).tenant = { agencyId: ctx.agencyId, userId: ctx.userId };
      storage.run(ctx, () => next());
    };
    if (this.env.AUTH_MODE === "dev-header") {
      const agencyId = req.header("x-agency-id");
      if (!agencyId) return next();
      return run({ agencyId, userId: req.header("x-user-id") ?? undefined, role: req.header("x-role") ?? OWNER_ROLE });
    }

    if (!this.auth || !this.authDb) return next();
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    const agencyId = session?.session.activeOrganizationId;
    if (!session || !agencyId) return next();
    const membership = await this.authDb.membership.findFirst({ where: { agencyId, userId: session.user.id }, select: { role: true } });
    if (!membership) return next();
    run({ agencyId, userId: session.user.id, role: membership.role });
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

  /** People do not approve what they asked for themselves; the owner may, having no one above them. */
  notOwnRequest(requestedBy: string | null | undefined, what: string) {
    if (requestedBy && requestedBy === this.userId && this.role !== OWNER_ROLE) throw new ForbiddenException(`Someone else decides your own ${what}.`);
  }

  /** The caller's permissions (set by the permission guard before the handler runs). */
  get permissions(): PermissionMatrix {
    return this.ctx().permissions ?? {};
  }

  /** The client contact, when the request comes from their portal. */
  get portal(): PortalPerson | undefined {
    return this.ctx().portal;
  }

  /**
   * Prisma `where` for an area the role may see only partly: nothing extra for "all", `{ [field]: userId }`
   * for "own" (records assigned to or owned by the person).
   */
  ownOnly(area: AreaKey, field: string): Record<string, string> {
    const scope = scopeOf(this.permissions, area);
    if (!scope) throw new ForbiddenException("Your role has no access to this.");
    if (scope === "all") return {};
    const userId = this.userId;
    if (!userId) throw new ForbiddenException("Your role sees only your own records, so you need to be signed in.");
    return { [field]: userId };
  }

  /** Single operations. */
  get db(): TenantClient {
    const { agencyId, userId } = this.ctx();
    return forAgency(this.prisma.client, agencyId, userId);
  }

  /** Several operations in one transaction (5 seconds at most unless `timeout` says otherwise). */
  tx<T>(fn: Parameters<typeof withAgency<T>>[2], options?: { timeout?: number }) {
    const { agencyId, userId } = this.ctx();
    return withAgency(this.prisma.client, agencyId, fn, userId, options);
  }
}
