import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
  SetMetadata,
  UnauthorizedException,
  applyDecorators,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiForbiddenResponse } from "@nestjs/swagger";
import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { forAgency } from "@gm/db";
import {
  allows,
  type AreaKey,
  FULL_ACCESS,
  OWNER_ROLE,
  type PermissionLevel,
  type PermissionMatrix,
  permissionArea,
  permissionMatrix,
  type SuiteKey,
  suiteLabel,
} from "@gm/shared";
import { AUTH, type Auth } from "../auth/auth.js";
import { EntitlementsService } from "../billing/entitlements.js";
import { locals } from "../common/request-context.js";
import { ENV, type Env } from "../env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { currentTenant, type TenantContext } from "../tenancy/tenant-context.js";

export const PERMISSION = "gm:permission";
type Needed = Exclude<PermissionLevel, "none">;
export type PermissionRule = { area: AreaKey; level: Needed } | "public" | "staff" | "platform";

/** The access an endpoint needs, checked against the agency's saved matrix on every request (P1-11). */
export const Can = (area: AreaKey, level: Needed) =>
  applyDecorators(SetMetadata(PERMISSION, { area, level } satisfies PermissionRule), ApiForbiddenResponse({ description: `Needs ${level} on ${area}` }));

/** No agency or permission needed (health checks, who-am-I). Every other endpoint must use `@Can` or `@Staff`. */
export const Public = () => SetMetadata(PERMISSION, "public" satisfies PermissionRule);

/**
 * Anyone on the agency's team, whatever their role — for reference data everyone needs (the agency's profile,
 * its packages). Not client people, whose roles reach only the client portal.
 */
export const Staff = () => SetMetadata(PERMISSION, "staff" satisfies PermissionRule);

/** For the platform's own team only (ADR 0011): the people listed in PLATFORM_ADMIN_EMAILS, whatever agency they are in. */
export const Platform = () => SetMetadata(PERMISSION, "platform" satisfies PermissionRule);

export const SUITE = "gm:suite";
/** The add-on suite a controller belongs to (ADR 0011): refused when the agency's plan does not have it. */
export const Suite = (suite: SuiteKey) => SetMetadata(SUITE, suite);

export const READ_ONLY_OK = "gm:read-only-ok";
/** Still allowed when the workspace is read-only: choosing a plan, paying, exporting. */
export const ReadOnlyOk = () => SetMetadata(READ_ONLY_OK, true);

/** On the team: has access to at least one area other than the client portal. */
export const isStaff = (m: PermissionMatrix) => Object.keys(m).some((area) => area !== "portal");

/** Reads a member's permissions. Never cached between requests, so a change applies from the next request. */
@Injectable()
export class AccessService {
  private readonly log = new Logger("Access");

  constructor(private readonly prisma: PrismaService) {}

  async load(ctx: TenantContext): Promise<PermissionMatrix> {
    if (ctx.permissions) return ctx.permissions;
    ctx.permissions = ctx.role === OWNER_ROLE ? FULL_ACCESS : await this.fromMatrix(ctx);
    return ctx.permissions;
  }

  private async fromMatrix(ctx: TenantContext): Promise<PermissionMatrix> {
    const role = await forAgency(this.prisma.client, ctx.agencyId, ctx.userId).role.findUnique({
      where: { agencyId_key: { agencyId: ctx.agencyId, key: ctx.role } },
      select: { permissions: true },
    });
    if (!role) return {};
    const parsed = permissionMatrix.safeParse(role.permissions);
    if (!parsed.success) {
      // Fail closed: a damaged row grants nothing.
      this.log.error(`Role ${ctx.role} has an invalid permission matrix`, { agencyId: ctx.agencyId });
      return {};
    }
    return parsed.data;
  }
}

/**
 * Global guard: every endpoint declares `@Can(area, level)` or `@Public()`. An endpoint with neither is refused
 * (and fails the route-coverage test in CI), so a forgotten check can never mean open access.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
    private readonly entitlements: EntitlementsService,
    @Inject(ENV) private readonly env: Env,
    @Optional() @Inject(AUTH) private readonly auth: Auth | null,
  ) {}

  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    const rule = this.reflector.getAllAndOverride<PermissionRule | undefined>(PERMISSION, targets);
    if (rule === "public") return true;
    if (!rule) throw new ForbiddenException("This endpoint has no permission rule yet.");
    const req = context.switchToHttp().getRequest<Request>();
    if (rule === "platform") return this.platform(req);

    const tenant = currentTenant();
    if (!tenant) throw new UnauthorizedException("Sign in and choose an agency first.");
    const permissions = await this.access.load(tenant);
    if (rule === "staff") {
      if (!isStaff(permissions)) throw new ForbiddenException("This is for the agency's team.");
    } else if (!allows(permissions, rule.area, rule.level)) {
      throw new ForbiddenException(
        `Your role needs "${rule.level}" on ${permissionArea(rule.area).label} for this. An owner can change it in Settings → Roles.`,
      );
    }

    // The agency's plan (ADR 0011): its suites, and whether it is read-only.
    const plan = await this.entitlements.load(tenant);
    const suite = this.reflector.getAllAndOverride<SuiteKey | undefined>(SUITE, targets);
    if (suite && !plan.suites.includes(suite))
      throw new ForbiddenException(
        `${suiteLabel(suite)} is not in your plan${plan.plan ? ` (${plan.plan.name})` : ""}. The owner can change the plan in Settings → Plan; nothing is lost meanwhile.`,
      );
    if (plan.readOnly && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !this.reflector.getAllAndOverride<boolean>(READ_ONLY_OK, targets))
      throw new ForbiddenException(plan.readOnlyReason);
    return true;
  }

  /** The platform's own team, by the address they signed in with. */
  private async platform(req: Request) {
    const session = this.auth ? await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) }) : null;
    if (!session) throw new UnauthorizedException("Sign in first.");
    if (!this.env.PLATFORM_ADMIN_EMAILS.includes(session.user.email.toLowerCase())) throw new ForbiddenException("This is for the platform's own team.");
    locals(req.res!).platformUser = { id: session.user.id, name: session.user.name };
    return true;
  }
}
