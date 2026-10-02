import type { Request, Response } from "express";
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req, Res } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { FILE_ENTITIES, type FileEntity, fileStart } from "@gm/shared";
import { Public, Staff } from "../access/access.js";
import { RateLimit } from "../common/rate-limit.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { FilesService } from "./files.service.js";

const entityPipe = new ZodPipe(z.enum(Object.keys(FILE_ENTITIES) as [FileEntity, ...FileEntity[]]));

/** Files attached to records. Access follows the record's area (checked in FilesService). */
@ApiTags("files")
@Controller("files")
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /** Starts an upload: returns the signed link to send the file to (valid for an hour). */
  @Post()
  @Staff()
  @ApiBody({ schema: z.toJSONSchema(fileStart, { io: "input" }) as Record<string, unknown> })
  start(@Body(new ZodPipe(fileStart)) body: z.output<typeof fileStart>) {
    return this.files.start(body);
  }

  /** A record's files, each with a download link valid for an hour. */
  @Get()
  @Staff()
  @ApiQuery({ name: "entity" })
  @ApiQuery({ name: "entityId" })
  list(@Query("entity", entityPipe) entity: FileEntity, @Query("entityId", new ZodPipe(z.string().min(1).max(64))) entityId: string) {
    return this.files.list(entity, entityId);
  }

  @Delete(":id")
  @Staff()
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.files.remove(id);
  }
}

/** The signed links themselves: no sign-in, the signature is the permission. */
@ApiTags("files")
@Controller("files")
export class FileTransferController {
  constructor(private readonly files: FilesService) {}

  /** The file itself, as the request body. */
  @Put("upload/:token")
  @Public()
  @RateLimit({ max: 120, windowSeconds: 60 })
  upload(@Param("token") token: string, @Req() req: Request) {
    return this.files.receive(token, req);
  }

  @Get("download/:token")
  @Public()
  @RateLimit({ max: 600, windowSeconds: 60 })
  download(@Param("token") token: string, @Res() res: Response) {
    return this.files.send(token, res);
  }
}
