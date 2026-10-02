import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, Res } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { z } from "zod";
import { type SupportGrantInput, supportGrantInput } from "@gm/shared";
import { Can, Platform, ReadOnlyOk } from "../access/access.js";
import { locals } from "../common/request-context.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { ENV, type Env } from "../env.js";
import { readCookie, SUPPORT_COOKIE } from "../tenancy/tenant-context.js";
import { SupportService } from "./support.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** The agency's consent for the platform's support team (P6-08). */
@ApiTags("support")
@Controller("support-access")
@ReadOnlyOk()
export class SupportAccessController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @Can("settings", "view")
  list() {
    return this.support.list();
  }

  @Post()
  @Can("settings", "edit")
  @ApiBody({ schema: schema(supportGrantInput) })
  grant(@Body(new ZodPipe(supportGrantInput)) b: SupportGrantInput) {
    return this.support.grant(b);
  }

  @Post(":id/revoke")
  @Can("settings", "edit")
  @HttpCode(200)
  revoke(@Param("id", ParseUUIDPipe) id: string) {
    return this.support.revoke(id);
  }
}

/** The platform's support team coming into an agency on its consent, and leaving (P6-08). */
@ApiTags("platform")
@Controller("platform")
@Platform()
export class PlatformSupportController {
  constructor(
    private readonly support: SupportService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post("agencies/:id/support")
  @HttpCode(200)
  async enter(@Param("id", ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const visit = await this.support.enter(id, locals(res).platformUser!.id);
    res.cookie(SUPPORT_COOKIE, visit.sealed, { httpOnly: true, sameSite: "lax", secure: this.env.NODE_ENV === "production", path: "/", maxAge: visit.maxAge });
    return { entered: true };
  }

  @Delete("support")
  @HttpCode(200)
  async leave(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.support.leave(readCookie(req, SUPPORT_COOKIE), locals(res).platformUser!.id);
    res.clearCookie(SUPPORT_COOKIE, { path: "/" });
    return { left: true };
  }
}
