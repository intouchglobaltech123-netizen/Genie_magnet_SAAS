import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBody, ApiHeader, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { clientInput, type ClientInput } from "@gm/shared";
import { ZodPipe } from "../common/zod.pipe.js";
import { ClientsService } from "./clients.service.js";

@ApiTags("clients")
@ApiHeader({ name: "x-agency-id", required: true, description: "Development only — replaced by the signed-in session in Phase 1" })
@Controller("clients")
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list() {
    return this.clients.list();
  }

  /** The request body is validated by the same Zod schema the web form uses; the OpenAPI schema is generated from it. */
  @Post()
  @ApiBody({ schema: z.toJSONSchema(clientInput, { io: "input" }) as Record<string, unknown> })
  create(@Body(new ZodPipe(clientInput)) body: ClientInput) {
    return this.clients.create(body);
  }
}
