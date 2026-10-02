import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Res } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { deletionInput } from "@gm/shared";
import { ReadOnlyOk, Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { DataService } from "./data.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** The agency's own data (P6-10): exports and deleting the workspace, for the owner; still open when read-only. */
@ApiTags("data")
@Controller("data")
@ReadOnlyOk()
export class DataController {
  constructor(private readonly data: DataService) {}

  @Get("exports")
  @Staff()
  exports() {
    return this.data.exports();
  }

  @Post("exports")
  @Staff()
  request() {
    return this.data.requestExport();
  }

  @Get("exports/:id/download")
  @Staff()
  async download(@Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const f = await this.data.open(id);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", String(f.size));
    res.setHeader("Content-Disposition", `attachment; filename="${f.fileName}"`);
    f.stream.pipe(res);
  }

  @Get("deletion")
  @Staff()
  deletion() {
    return this.data.deletion();
  }

  @Post("deletion")
  @Staff()
  @ApiBody({ schema: schema(deletionInput) })
  requestDeletion(@Body(new ZodPipe(deletionInput)) b: z.output<typeof deletionInput>) {
    return this.data.requestDeletion(b.confirm);
  }

  @Delete("deletion")
  @Staff()
  cancelDeletion() {
    return this.data.cancelDeletion();
  }
}
