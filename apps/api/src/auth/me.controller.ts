import { Controller, Get, Inject, Optional, Req, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { createPrisma } from "@gm/db";
import { AUTH, AUTH_PRISMA, type Auth } from "./auth.js";

/** Who is signed in, which agency they are working in, and the agencies they can switch to. */
@ApiTags("auth")
@Controller("me")
export class MeController {
  constructor(
    @Optional() @Inject(AUTH) private readonly auth: Auth | null,
    @Optional() @Inject(AUTH_PRISMA) private readonly authDb: ReturnType<typeof createPrisma> | null,
  ) {}

  @Get()
  async me(@Req() req: Request) {
    if (!this.auth || !this.authDb) throw new UnauthorizedException("Sign-in is not enabled on this server.");
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new UnauthorizedException("Not signed in.");
    const memberships = await this.authDb.membership.findMany({
      where: { userId: session.user.id },
      select: { role: true, agency: { select: { id: true, name: true, slug: true, logo: true } } },
      orderBy: { createdAt: "asc" },
    });
    return {
      user: { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image ?? null },
      activeAgencyId: session.session.activeOrganizationId ?? null,
      agencies: memberships.map((m) => ({ ...m.agency, role: m.role })),
    };
  }
}
