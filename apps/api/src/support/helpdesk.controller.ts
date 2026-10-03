import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { ticketInput, type TicketInput, ticketReply } from "@gm/shared";
import { Platform, ReadOnlyOk, Staff } from "../access/access.js";
import { locals } from "../common/request-context.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { HelpdeskService } from "./helpdesk.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const platformReply = ticketReply.extend({ close: z.boolean().default(false) });

/** Writing to the platform's support team (P6-15); open even when the workspace is read-only. */
@ApiTags("support")
@Controller("support/tickets")
@ReadOnlyOk()
export class HelpdeskController {
  constructor(private readonly helpdesk: HelpdeskService) {}

  @Get()
  @Staff()
  list() {
    return this.helpdesk.list();
  }

  @Post()
  @Staff()
  @ApiBody({ schema: schema(ticketInput) })
  create(@Body(new ZodPipe(ticketInput)) b: TicketInput) {
    return this.helpdesk.create(b);
  }

  @Get(":id")
  @Staff()
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.helpdesk.get(id);
  }

  @Post(":id/messages")
  @Staff()
  @ApiBody({ schema: schema(ticketReply) })
  reply(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(ticketReply)) b: { body: string }) {
    return this.helpdesk.reply(id, b.body);
  }

  @Post(":id/close")
  @HttpCode(200)
  @Staff()
  close(@Param("id", ParseUUIDPipe) id: string) {
    return this.helpdesk.close(id);
  }
}

/** The support inbox in the platform console: every agency's messages, and replies. */
@ApiTags("platform")
@Controller("platform/support/tickets")
@Platform()
export class PlatformHelpdeskController {
  constructor(private readonly helpdesk: HelpdeskService) {}

  @Get()
  list() {
    return this.helpdesk.platformList();
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.helpdesk.platformGet(id);
  }

  @Post(":id/messages")
  @ApiBody({ schema: schema(platformReply) })
  reply(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(platformReply)) b: { body: string; close: boolean }, @Req() req: Request) {
    const by = locals(req.res!).platformUser!;
    return this.helpdesk.platformReply(id, b.body, by, b.close);
  }
}
