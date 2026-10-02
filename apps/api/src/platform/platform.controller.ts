import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { type PlatformSettings, platformSettingsInput, platformSubscriptionInput } from "@gm/shared";
import { Platform } from "../access/access.js";
import { locals } from "../common/request-context.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { PlatformSettingsService } from "./platform-settings.service.js";
import { PlatformService } from "./platform.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** The platform console (P6-01, ADR 0011): for the platform's own team only. */
@ApiTags("platform")
@Controller("platform")
@Platform()
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly settings: PlatformSettingsService,
  ) {}

  @Get("agencies")
  agencies() {
    return this.platform.agencies();
  }

  @Get("settings")
  getSettings() {
    return this.settings.get();
  }

  @Put("settings")
  @ApiBody({ schema: schema(platformSettingsInput) })
  saveSettings(@Body(new ZodPipe(platformSettingsInput)) b: PlatformSettings, @Req() req: Request) {
    return this.settings.save(b, locals(req.res!).platformUser?.id ?? null);
  }

  @Put("agencies/:id/subscription")
  @ApiBody({ schema: schema(platformSubscriptionInput) })
  setSubscription(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(platformSubscriptionInput)) b: z.output<typeof platformSubscriptionInput>,
    @Req() req: Request,
  ) {
    return this.platform.setSubscription(id, b, locals(req.res!).platformUser?.id);
  }
}
