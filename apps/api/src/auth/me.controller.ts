import { Controller, Get, Inject, Optional, Req, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { createPrisma } from "@gm/db";
import { AccessService, Public } from "../access/access.js";
import { noticesFor } from "@gm/shared";
import { EntitlementsService } from "../billing/entitlements.js";
import { DataService } from "../data/data.service.js";
import { PlatformSettingsService } from "../platform/platform-settings.service.js";
import { ENV, type Env } from "../env.js";
import { currentTenant, TenantDb } from "../tenancy/tenant-context.js";
import { AUTH, AUTH_PRISMA, type Auth } from "./auth.js";

/**
 * Who is signed in, which agency they are working in, their role and permissions there (the web app hides what
 * they cannot do), and the agencies they can switch to.
 */
@ApiTags("auth")
@Controller("me")
export class MeController {
  constructor(
    @Optional() @Inject(AUTH) private readonly auth: Auth | null,
    @Optional() @Inject(AUTH_PRISMA) private readonly authDb: ReturnType<typeof createPrisma> | null,
    private readonly access: AccessService,
    private readonly tenant: TenantDb,
    private readonly entitlements: EntitlementsService,
    @Inject(ENV) private readonly env: Env,
    private readonly platform: PlatformSettingsService,
    private readonly data: DataService,
  ) {}

  @Get()
  @Public()
  async me(@Req() req: Request) {
    if (!this.auth || !this.authDb) throw new UnauthorizedException("Sign-in is not enabled on this server.");
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new UnauthorizedException("Not signed in.");
    const memberships = await this.authDb.membership.findMany({
      where: { userId: session.user.id },
      select: { role: true, agency: { select: { id: true, name: true, slug: true, logo: true, brandColor: true, appBranding: true } } },
      orderBy: { createdAt: "asc" },
    });

    // Set only when the active agency is one the person still belongs to (tenant middleware).
    const ctx = currentTenant();
    let active = null;
    if (ctx) {
      const permissions = await this.access.load(ctx);
      const role = await this.tenant.db.role.findUnique({ where: { agencyId_key: { agencyId: ctx.agencyId, key: ctx.role } }, select: { name: true } });
      active = {
        agencyId: ctx.agencyId,
        role: ctx.support ? { key: ctx.role, name: "Platform support" } : { key: ctx.role, name: role?.name ?? ctx.role },
        permissions,
        entitlements: await this.entitlements.load(ctx),
      };
    }
    // The active agency's brand (P6-07); a support visitor sees it as the agency does.
    const brand = active
      ? (memberships.find((m) => m.agency.id === active.agencyId)?.agency ??
        (await this.tenant.db.agency.findUnique({ where: { id: active.agencyId }, select: { name: true, logo: true, brandColor: true, appBranding: true } })))
      : null;
    // The platform's support team, in an agency on its consent (P6-08).
    const support = ctx?.support
      ? {
          agencyId: ctx.agencyId,
          agencyName: (await this.tenant.db.agency.findUnique({ where: { id: ctx.agencyId }, select: { name: true } }))?.name ?? "",
          level: ctx.support.level,
          until: ctx.support.until,
        }
      : null;

    return {
      user: { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image ?? null },
      activeAgencyId: active?.agencyId ?? null,
      role: active?.role ?? null,
      permissions: active?.permissions ?? null,
      entitlements: active?.entitlements ?? null,
      agencies: memberships.map(({ agency: { id, name, slug, logo }, role }) => ({ id, name, slug, logo, role })),
      platformAdmin: this.env.PLATFORM_ADMIN_EMAILS.includes(session.user.email.toLowerCase()),
      support,
      ...(active
        ? noticesFor(
            await this.platform.get(),
            active.agencyId,
            active.entitlements.plan?.key ?? null,
            new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10),
          )
        : { announcements: [], flags: [] }),
      deletion: active ? await this.data.deletion() : null,
      branding: brand ? { name: brand.name, logo: brand.logo, color: brand.brandColor, inApp: brand.appBranding && !!brand.brandColor } : null,
    };
  }
}
