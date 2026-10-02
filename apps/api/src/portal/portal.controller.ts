import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { clientDecision, type ClientDecision, clientRequestAnswer, clientRequestInput, portalComment, portalPick, whatsappOptIn } from "@gm/shared";
import { Can, Public } from "../access/access.js";
import { RateLimit } from "../common/rate-limit.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { PortalService } from "./portal.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/**
 * The client portal (P3-01 to P3-05), by a contact's private link. No sign-in: the link is the key, and everything is
 * limited to the contact's client. A replaced or switched-off link answers 404.
 */
@ApiTags("portal")
@Controller("portal/:token")
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get()
  @Public()
  @RateLimit({ max: 120, windowSeconds: 60 })
  home(@Param("token") token: string) {
    return this.portal.home(token);
  }

  /** The contact switches WhatsApp messages on or off. */
  @Put("whatsapp")
  @Public()
  @RateLimit({ max: 20, windowSeconds: 60 })
  @ApiBody({ schema: schema(whatsappOptIn) })
  whatsapp(@Param("token") token: string, @Body(new ZodPipe(whatsappOptIn)) b: z.output<typeof whatsappOptIn>) {
    return this.portal.setWhatsApp(token, b.optIn);
  }

  @Get("topics")
  @Public()
  @RateLimit({ max: 120, windowSeconds: 60 })
  topics(@Param("token") token: string) {
    return this.portal.topics(token);
  }

  @Put("topics/:contentId")
  @Public()
  @RateLimit({ max: 120, windowSeconds: 60 })
  @ApiBody({ schema: schema(portalPick) })
  pick(@Param("token") token: string, @Param("contentId", ParseUUIDPipe) contentId: string, @Body(new ZodPipe(portalPick)) b: z.output<typeof portalPick>) {
    return this.portal.pick(token, contentId, b.pick);
  }

  /** The client has picked: the team is told. */
  @Post("topic-lists/:listId/done")
  @Public()
  @RateLimit({ max: 30, windowSeconds: 60 })
  @HttpCode(200)
  topicsDone(@Param("token") token: string, @Param("listId", ParseUUIDPipe) listId: string) {
    return this.portal.topicsDone(token, listId);
  }

  @Get("scripts")
  @Public()
  @RateLimit({ max: 120, windowSeconds: 60 })
  scripts(@Param("token") token: string) {
    return this.portal.scripts(token);
  }

  @Post("scripts/:contentId/decision")
  @Public()
  @RateLimit({ max: 30, windowSeconds: 60 })
  @HttpCode(200)
  @ApiBody({ schema: schema(clientDecision) })
  decideScript(@Param("token") token: string, @Param("contentId", ParseUUIDPipe) contentId: string, @Body(new ZodPipe(clientDecision)) b: ClientDecision) {
    return this.portal.decideScript(token, contentId, b);
  }

  @Get("videos")
  @Public()
  @RateLimit({ max: 120, windowSeconds: 60 })
  videos(@Param("token") token: string) {
    return this.portal.videosFor(token);
  }

  @Post("videos/:videoId/comments")
  @Public()
  @RateLimit({ max: 60, windowSeconds: 60 })
  @ApiBody({ schema: schema(portalComment) })
  comment(
    @Param("token") token: string,
    @Param("videoId", ParseUUIDPipe) videoId: string,
    @Body(new ZodPipe(portalComment)) b: z.output<typeof portalComment>,
  ) {
    return this.portal.comment(token, videoId, b);
  }

  @Post("videos/:videoId/decision")
  @Public()
  @RateLimit({ max: 30, windowSeconds: 60 })
  @HttpCode(200)
  @ApiBody({ schema: schema(clientDecision) })
  decideVideo(@Param("token") token: string, @Param("videoId", ParseUUIDPipe) videoId: string, @Body(new ZodPipe(clientDecision)) b: ClientDecision) {
    return this.portal.decideVideo(token, videoId, b);
  }

  @Get("invoices")
  @Public()
  @RateLimit({ max: 120, windowSeconds: 60 })
  invoices(@Param("token") token: string) {
    return this.portal.invoicesFor(token);
  }

  @Get("invoices/:id")
  @Public()
  @RateLimit({ max: 120, windowSeconds: 60 })
  invoice(@Param("token") token: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.portal.invoice(token, id);
  }

  @Get("requests")
  @Public()
  @RateLimit({ max: 120, windowSeconds: 60 })
  requests(@Param("token") token: string) {
    return this.portal.myRequests(token);
  }

  @Post("requests")
  @Public()
  @RateLimit({ max: 20, windowSeconds: 60 })
  @ApiBody({ schema: schema(clientRequestInput) })
  ask(@Param("token") token: string, @Body(new ZodPipe(clientRequestInput)) b: z.output<typeof clientRequestInput>) {
    return this.portal.ask(token, b);
  }
}

/** The team: each contact's portal link, made, replaced and switched off from the client's page. */
@ApiTags("portal")
@Controller("clients/:clientId")
export class PortalLinksController {
  constructor(private readonly portal: PortalService) {}

  @Get("portal-links")
  @Can("clients", "view")
  links(@Param("clientId", ParseUUIDPipe) clientId: string) {
    return this.portal.links(clientId);
  }

  /** A new link for the contact (an earlier one stops working); shown only in this answer. */
  @Post("contacts/:contactId/portal-link")
  @Can("clients", "edit")
  makeLink(@Param("clientId", ParseUUIDPipe) clientId: string, @Param("contactId", ParseUUIDPipe) contactId: string) {
    return this.portal.makeLink(clientId, contactId);
  }

  @Delete("contacts/:contactId/portal-link")
  @Can("clients", "edit")
  removeLink(@Param("clientId", ParseUUIDPipe) clientId: string, @Param("contactId", ParseUUIDPipe) contactId: string) {
    return this.portal.removeLink(clientId, contactId);
  }
}

/** What clients ask from their portals, and the team's answers. */
@ApiTags("portal")
@Controller("client-requests")
export class ClientRequestsController {
  constructor(private readonly portal: PortalService) {}

  @Get()
  @Can("clients", "view")
  @ApiQuery({ name: "status", required: false, enum: ["open", "answered"] })
  @ApiQuery({ name: "clientId", required: false })
  list(@Query("status") status?: string, @Query("clientId") clientId?: string) {
    return this.portal.requests({
      status: status === "open" || status === "answered" ? status : undefined,
      clientId: clientId && /^[0-9a-f-]{36}$/i.test(clientId) ? clientId : undefined,
    });
  }

  @Post(":id/answer")
  @Can("clients", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(clientRequestAnswer) })
  answer(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(clientRequestAnswer)) b: z.output<typeof clientRequestAnswer>) {
    return this.portal.answer(id, b.answer);
  }
}
