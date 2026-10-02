import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  agreementEnding,
  type AgreementEnding,
  agreementInput,
  agreementPause,
  agreementRenewal,
  type AgreementRenewal,
  agreementUpdate,
  type AgreementUpdate,
  clientInput,
  type ClientInput,
  clientUpdate,
  type ClientUpdate,
  contactInput,
  type ContactInput,
  contactUpdate,
  type ContactUpdate,
} from "@gm/shared";
import { Can } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { AgreementsService } from "./agreements.service.js";
import { ClientsService } from "./clients.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

@ApiTags("clients")
@Controller("clients")
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly agreements: AgreementsService,
  ) {}

  /** Every client the person may see, archived ones included. Roles limited to their own clients see only those they look after. */
  @Get()
  @Can("clients", "view")
  list() {
    return this.clients.list();
  }

  /** The request body is validated by the same Zod schema the web form uses; the OpenAPI schema is generated from it. */
  @Post()
  @Can("clients", "edit")
  @ApiBody({ schema: schema(clientInput) })
  create(@Body(new ZodPipe(clientInput)) body: ClientInput) {
    return this.clients.create(body);
  }

  /** The client page: details, contacts, agreements and the lead it was won from. */
  @Get(":id")
  @Can("clients", "view")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.clients.get(id);
  }

  @Patch(":id")
  @Can("clients", "edit")
  @ApiBody({ schema: schema(clientUpdate) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(clientUpdate)) body: ClientUpdate) {
    return this.clients.update(id, body);
  }

  @Post(":id/archive")
  @Can("clients", "edit")
  @HttpCode(200)
  archive(@Param("id", ParseUUIDPipe) id: string) {
    return this.clients.setArchived(id, true);
  }

  @Post(":id/restore")
  @Can("clients", "edit")
  @HttpCode(200)
  restore(@Param("id", ParseUUIDPipe) id: string) {
    return this.clients.setArchived(id, false);
  }

  /** Only a client added by mistake (nothing attached); others are archived. */
  @Delete(":id")
  @Can("clients", "edit")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.clients.remove(id);
  }

  @Post(":id/contacts")
  @Can("clients", "edit")
  @ApiBody({ schema: schema(contactInput) })
  addContact(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(contactInput)) body: ContactInput) {
    return this.clients.addContact(id, body);
  }

  @Patch(":id/contacts/:contactId")
  @Can("clients", "edit")
  @ApiBody({ schema: schema(contactUpdate) })
  updateContact(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("contactId", ParseUUIDPipe) contactId: string,
    @Body(new ZodPipe(contactUpdate)) body: ContactUpdate,
  ) {
    return this.clients.updateContact(id, contactId, body);
  }

  @Delete(":id/contacts/:contactId")
  @Can("clients", "edit")
  removeContact(@Param("id", ParseUUIDPipe) id: string, @Param("contactId", ParseUUIDPipe) contactId: string) {
    return this.clients.removeContact(id, contactId);
  }

  /** A new agreement for the client, as a draft to be signed off. */
  @Post(":id/agreements")
  @Can("agreements", "edit")
  @ApiBody({ schema: schema(agreementInput) })
  addAgreement(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(agreementInput)) body: z.output<typeof agreementInput>) {
    return this.agreements.create(id, body);
  }
}

/** Agreements across all clients (P1-19). */
@ApiTags("clients")
@Controller("agreements")
export class AgreementsController {
  constructor(private readonly agreements: AgreementsService) {}

  /** e.g. `?status=draft` (waiting for sign-off) or `?renewal=1` (due for renewal, soonest first). */
  @Get()
  @Can("agreements", "view")
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "clientId", required: false })
  @ApiQuery({ name: "renewal", required: false })
  list(@Query("status") status?: string, @Query("clientId") clientId?: string, @Query("renewal") renewal?: string) {
    return this.agreements.list({ status, clientId: clientId && z.uuid().safeParse(clientId).success ? clientId : undefined, renewal: renewal === "1" });
  }

  @Get(":id")
  @Can("agreements", "view")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.agreements.get(id);
  }

  /** A draft's terms; signed agreements are renewed instead. */
  @Patch(":id")
  @Can("agreements", "edit")
  @ApiBody({ schema: schema(agreementUpdate) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(agreementUpdate)) body: AgreementUpdate) {
    return this.agreements.update(id, body);
  }

  @Post(":id/sign-off")
  @Can("agreements", "approve")
  @HttpCode(200)
  signOff(@Param("id", ParseUUIDPipe) id: string) {
    return this.agreements.signOff(id);
  }

  @Post(":id/pause")
  @Can("agreements", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(agreementPause) })
  pause(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(agreementPause)) body: { note?: string }) {
    return this.agreements.pause(id, body.note);
  }

  @Post(":id/resume")
  @Can("agreements", "edit")
  @HttpCode(200)
  resume(@Param("id", ParseUUIDPipe) id: string) {
    return this.agreements.resume(id);
  }

  /** Ending an agreement is a sign-off decision, like starting one. */
  @Post(":id/end")
  @Can("agreements", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(agreementEnding) })
  end(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(agreementEnding)) body: AgreementEnding) {
    return this.agreements.end(id, body);
  }

  @Post(":id/renew")
  @Can("agreements", "edit")
  @ApiBody({ schema: schema(agreementRenewal) })
  renew(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(agreementRenewal)) body: AgreementRenewal) {
    return this.agreements.renew(id, body);
  }

  /** Only drafts. */
  @Delete(":id")
  @Can("agreements", "edit")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.agreements.remove(id);
  }
}
