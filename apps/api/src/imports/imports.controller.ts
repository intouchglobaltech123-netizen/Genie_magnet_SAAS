import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { clientImport, type ClientImport, leadImport, type LeadImport, teamImport, type TeamImport, videoImport, type VideoImport } from "@gm/shared";
import { Can, Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { ImportsService } from "./imports.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/**
 * Importing from a spreadsheet. The web app reads the file in the browser and sends the checked rows;
 * problems come back as `issues` with paths like `rows.3.code`.
 */
@ApiTags("imports")
@Controller("imports")
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  /** Recent imports of the kinds the person may change. */
  @Get()
  @Staff()
  list() {
    return this.imports.list();
  }

  @Post("clients")
  @Can("clients", "edit")
  @ApiBody({ schema: schema(clientImport) })
  clients(@Body(new ZodPipe(clientImport)) body: ClientImport) {
    return this.imports.importClients(body);
  }

  /** Each row becomes an invitation (with a link to share while emails are off). */
  @Post("team")
  @Can("team", "edit")
  @ApiBody({ schema: schema(teamImport) })
  team(@Body(new ZodPipe(teamImport)) body: TeamImport) {
    return this.imports.importTeam(body);
  }

  /** Stages are the pipeline's keys (the importer matches names); owners are found by email. */
  @Post("leads")
  @Can("crm", "edit")
  @ApiBody({ schema: schema(leadImport) })
  leads(@Body(new ZodPipe(leadImport)) body: LeadImport) {
    return this.imports.importLeads(body);
  }

  /** Videos in progress from a tracking sheet; clients by code, editors by email, stages by key (the importer matches the words). */
  @Post("videos")
  @Can("production", "edit")
  @ApiBody({ schema: schema(videoImport) })
  videos(@Body(new ZodPipe(videoImport)) body: VideoImport) {
    return this.imports.importVideos(body);
  }

  /** Within 24 hours: removes the clients it created (if untouched since) or cancels its waiting invitations. */
  @Delete(":id")
  @Staff()
  undo(@Param("id", ParseUUIDPipe) id: string) {
    return this.imports.undo(id);
  }
}
