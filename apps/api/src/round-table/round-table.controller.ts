import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { rtAnswerInput, rtCommitInput, rtHideInput, type RtSessionInput, rtSessionInput } from "@gm/shared";
import { Can, Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { RoundTableService } from "./round-table.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** Round Table (P5-15). */
@ApiTags("management")
@Controller("round-tables")
export class RoundTableController {
  constructor(private readonly rt: RoundTableService) {}

  @Get()
  @Staff()
  list() {
    return this.rt.list();
  }

  @Post()
  @Can("reports", "edit")
  @ApiBody({ schema: schema(rtSessionInput) })
  create(@Body(new ZodPipe(rtSessionInput)) b: RtSessionInput) {
    return this.rt.create(b);
  }

  @Get(":id")
  @Staff()
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.rt.get(id);
  }

  @Post(":id/start")
  @Staff()
  @HttpCode(200)
  start(@Param("id", ParseUUIDPipe) id: string) {
    return this.rt.start(id);
  }

  @Put(":id/answer")
  @Staff()
  @ApiBody({ schema: schema(rtAnswerInput) })
  answer(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(rtAnswerInput)) b: z.output<typeof rtAnswerInput>) {
    return this.rt.answer(id, b.answers);
  }

  @Post(":id/next")
  @Staff()
  @HttpCode(200)
  next(@Param("id", ParseUUIDPipe) id: string) {
    return this.rt.next(id);
  }

  @Put("answers/:answerId")
  @Staff()
  @ApiBody({ schema: schema(rtHideInput) })
  hide(@Param("answerId", ParseUUIDPipe) answerId: string, @Body(new ZodPipe(rtHideInput)) b: z.output<typeof rtHideInput>) {
    return this.rt.hide(answerId, b.hidden, b.reason);
  }

  @Post(":id/release")
  @Staff()
  @HttpCode(200)
  release(@Param("id", ParseUUIDPipe) id: string) {
    return this.rt.release(id);
  }

  @Get(":id/mine")
  @Staff()
  mine(@Param("id", ParseUUIDPipe) id: string) {
    return this.rt.mine(id);
  }

  @Post(":id/commitment")
  @Staff()
  @ApiBody({ schema: schema(rtCommitInput) })
  commit(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(rtCommitInput)) b: z.output<typeof rtCommitInput>) {
    return this.rt.commit(id, b.text, b.due);
  }
}
