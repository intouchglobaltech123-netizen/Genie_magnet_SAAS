import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { clientInput, type ClientInput } from "@gm/shared";
import { Can } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { ClientsService } from "./clients.service.js";

@ApiTags("clients")
@Controller("clients")
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  /** Roles limited to their own clients see only those they are account owner of. */
  @Get()
  @Can("clients", "view")
  list() {
    return this.clients.list();
  }

  /** The request body is validated by the same Zod schema the web form uses; the OpenAPI schema is generated from it. */
  @Post()
  @Can("clients", "edit")
  @ApiBody({ schema: z.toJSONSchema(clientInput, { io: "input" }) as Record<string, unknown> })
  create(@Body(new ZodPipe(clientInput)) body: ClientInput) {
    return this.clients.create(body);
  }
}
