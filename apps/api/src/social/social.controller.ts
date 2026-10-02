import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Res } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { autoPublishInput, chooseAccountInput } from "@gm/shared";
import { Can, Public, Staff } from "../access/access.js";
import { RateLimit } from "../common/rate-limit.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { SocialService } from "./social.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** Whether connecting Instagram, Facebook and YouTube is switched on for this server (P3-11). */
@ApiTags("social")
@Controller("social")
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get()
  @Staff()
  settings() {
    return this.social.settings();
  }
}

/** Connecting one of a client's platforms through the platform's own sign-in. */
@ApiTags("social")
@Controller("clients/:clientId/platforms/:platformId")
export class ClientSocialController {
  constructor(private readonly social: SocialService) {}

  /** The platform's sign-in page to open; it comes back to /webhooks/social/:network and then to the client's page. */
  @Post("connect")
  @Can("publishing", "edit")
  @HttpCode(200)
  connect(@Param("clientId", ParseUUIDPipe) clientId: string, @Param("platformId", ParseUUIDPipe) id: string) {
    return this.social.connectUrl(clientId, id);
  }

  /** After signing in, when the account to post to was not clear from the handle. */
  @Get("accounts")
  @Can("publishing", "edit")
  accounts(@Param("clientId", ParseUUIDPipe) clientId: string, @Param("platformId", ParseUUIDPipe) id: string) {
    return this.social.accounts(clientId, id);
  }

  @Post("choose")
  @Can("publishing", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(chooseAccountInput) })
  choose(
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Param("platformId", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(chooseAccountInput)) b: z.output<typeof chooseAccountInput>,
  ) {
    return this.social.choose(clientId, id, b.accountId);
  }

  @Post("disconnect")
  @Can("publishing", "edit")
  @HttpCode(200)
  disconnect(@Param("clientId", ParseUUIDPipe) clientId: string, @Param("platformId", ParseUUIDPipe) id: string) {
    return this.social.disconnect(clientId, id);
  }

  /** Whether scheduled posts go out by themselves (on by default once connected). */
  @Put("auto-publish")
  @Can("publishing", "edit")
  @ApiBody({ schema: schema(autoPublishInput) })
  autoPublish(
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Param("platformId", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(autoPublishInput)) b: z.output<typeof autoPublishInput>,
  ) {
    return this.social.setAutoPublish(clientId, id, b.autoPublish);
  }
}

/** Where Meta and Google send the person back after signing in; the state says which agency and platform it is for. */
@ApiTags("social")
@Controller("webhooks/social/:network")
export class SocialWebhookController {
  constructor(private readonly social: SocialService) {}

  @Get()
  @Public()
  @RateLimit({ max: 60, windowSeconds: 60 })
  async back(
    @Param("network") network: string,
    @Res() res: Response,
    @Query("code") code?: string,
    @Query("state") state?: string,
    @Query("error") error?: string,
    @Query("error_description") errorDescription?: string,
  ) {
    const to = await this.social.callback(network, { code, state, error, error_description: errorDescription });
    res.redirect(302, to);
  }
}
