import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
  applyDecorators,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiForbiddenResponse } from "@nestjs/swagger";
import { forAgency } from "@gm/db";
import { allows, type AreaKey, FULL_ACCESS, OWNER_ROLE, type PermissionLevel, type PermissionMatrix, permissionArea, permissionMatrix } from "@gm/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { currentTenant, type TenantContext } from "../tenancy/tenant-context.js";

export const PERMISSION = "gm:permission";
type Needed = Exclude<PermissionLevel, "none">;
export type PermissionRule = { area: AreaKey; level: Needed } | "public";

/** The access an endpoint needs, checked against the agency's saved matrix on every request (P1-11). */
export const Can = (area: AreaKey, level: Needed) =>
  applyDecorators(SetMetadata(PERMISSION, { area, level } satisfies PermissionRule), ApiForbiddenResponse({ description: `Needs ${level} on ${area}` }));

/** No agency or permission needed (health checks, who-am-I). Every other endpoint must use `@Can`. */
export const Public = () => SetMetadata(PERMISSION, "public" satisfies PermissionRule);

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
  ) {}

  async canActivate(context: ExecutionContext) {
    const rule = this.reflector.getAllAndOverride<PermissionRule | undefined>(PERMISSION, [context.getHandler(), context.getClass()]);
    if (rule === "public") return true;
    if (!rule) throw new ForbiddenException("This endpoint has no permission rule yet.");

    const tenant = currentTenant();
    if (!tenant) throw new UnauthorizedException("Sign in and choose an agency first.");
    const permissions = await this.access.load(tenant);
    if (!allows(permissions, rule.area, rule.level)) {
      throw new ForbiddenException(
        `Your role needs "${rule.level}" on ${permissionArea(rule.area).label} for this. An owner can change it in Settings → Roles.`,
      );
    }
    return true;
  }
}
