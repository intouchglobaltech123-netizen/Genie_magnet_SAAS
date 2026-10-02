import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { WHATSAPP_PURPOSE_KEYS, whatsappConnectionInput, whatsappOptIn, whatsappTemplateInput, whatsappTest } from "@gm/shared";
import { Can, Public } from "../access/access.js";
import { RateLimit } from "../common/rate-limit.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { WhatsAppInbound } from "./inbound.service.js";
import { WhatsAppService } from "./whatsapp.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** Settings → WhatsApp (P3-07): the agency's own number, its templates, a test message, and the message log. */
@ApiTags("whatsapp")
@Controller("whatsapp")
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get()
  @Can("settings", "view")
  settings() {
    return this.whatsapp.settings();
  }

  @Put("connection")
  @Can("settings", "edit")
  @ApiBody({ schema: schema(whatsappConnectionInput) })
  connect(@Body(new ZodPipe(whatsappConnectionInput)) b: z.output<typeof whatsappConnectionInput>) {
    return this.whatsapp.saveConnection(b);
  }

  @Post("connection/check")
  @Can("settings", "edit")
  @HttpCode(200)
  check() {
    return this.whatsapp.check();
  }

  @Delete("connection")
  @Can("settings", "edit")
  disconnect() {
    return this.whatsapp.disconnect();
  }

  @Put("templates")
  @Can("settings", "edit")
  @ApiBody({ schema: schema(whatsappTemplateInput) })
  template(@Body(new ZodPipe(whatsappTemplateInput)) b: z.output<typeof whatsappTemplateInput>) {
    return this.whatsapp.saveTemplate(b);
  }

  @Delete("templates/:purpose")
  @Can("settings", "edit")
  removeTemplate(@Param("purpose") purpose: string) {
    return this.whatsapp.removeTemplate((WHATSAPP_PURPOSE_KEYS as readonly string[]).includes(purpose) ? purpose : "_");
  }

  @Post("test")
  @Can("settings", "edit")
  @HttpCode(200)
  @RateLimit({ max: 10, windowSeconds: 60 })
  @ApiBody({ schema: schema(whatsappTest) })
  test(@Body(new ZodPipe(whatsappTest)) b: z.output<typeof whatsappTest>) {
    return this.whatsapp.sendTest(b.phone);
  }

  @Get("messages")
  @Can("clients", "view")
  @ApiQuery({ name: "clientId", required: false })
  @ApiQuery({ name: "status", required: false })
  messages(@Query("clientId") clientId?: string, @Query("status") status?: string) {
    return this.whatsapp.messages({
      clientId: clientId && /^[0-9a-f-]{36}$/i.test(clientId) ? clientId : undefined,
      status: status && /^[a-z]{3,12}$/.test(status) ? status : undefined,
    });
  }
}

/** Whether a client contact agreed to WhatsApp messages, recorded by the team with how they agreed. */
@ApiTags("whatsapp")
@Controller("clients/:clientId/contacts/:contactId/whatsapp")
export class ContactWhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Put()
  @Can("clients", "edit")
  @ApiBody({ schema: schema(whatsappOptIn) })
  optIn(@Param("contactId", ParseUUIDPipe) contactId: string, @Body(new ZodPipe(whatsappOptIn)) b: z.output<typeof whatsappOptIn>) {
    return this.whatsapp.setOptIn(contactId, b.optIn, b.source || (b.optIn ? "Told the team" : "Turned off by the team"));
  }
}

/**
 * The address each agency gives Meta for its WhatsApp number (P3-08). Meta checks it once with the verify token, then
 * sends delivery receipts and replies, signed with the agency's app secret.
 */
@ApiTags("whatsapp")
@Controller("webhooks/whatsapp/:connectionId")
export class WhatsAppWebhookController {
  constructor(private readonly inbound: WhatsAppInbound) {}

  @Get()
  @Public()
  @RateLimit({ max: 60, windowSeconds: 60 })
  verify(
    @Param("connectionId") connectionId: string,
    @Query("hub.mode") mode?: string,
    @Query("hub.verify_token") token?: string,
    @Query("hub.challenge") challenge?: string,
  ) {
    return this.inbound.verify(connectionId, mode, token, challenge);
  }

  @Post()
  @Public()
  @HttpCode(200)
  @RateLimit({ max: 3000, windowSeconds: 60 })
  receive(@Param("connectionId") connectionId: string, @Req() req: { rawBody?: Buffer; body: unknown }, @Headers("x-hub-signature-256") signature?: string) {
    return this.inbound.receive(connectionId, req.rawBody, signature, req.body as never);
  }
}
