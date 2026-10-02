import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { type CascadeInputs, cascadeInputs, type CheckInInput, checkInInput, type GoalInput, goalInput, goalSettingsInput } from "@gm/shared";
import { Can, Staff, Suite } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { cascadeApply, GoalsService } from "./goals.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** Goals (P5-13): kept by those who may edit goals; everyone sees their own and what they serve. */
@ApiTags("management")
@Suite("management")
@Controller("goals")
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  @Staff()
  list() {
    return this.goals.list();
  }

  @Get("settings")
  @Staff()
  settings() {
    return this.goals.settings();
  }

  @Put("settings")
  @Can("reports", "edit")
  @ApiBody({ schema: schema(goalSettingsInput) })
  updateSettings(@Body(new ZodPipe(goalSettingsInput)) b: z.input<typeof goalSettingsInput>) {
    return this.goals.updateSettings(b);
  }

  @Get("cascade")
  @Can("reports", "view")
  cascade() {
    return this.goals.cascadeView();
  }

  @Put("cascade")
  @Can("reports", "edit")
  @ApiBody({ schema: schema(cascadeInputs) })
  saveCascade(@Body(new ZodPipe(cascadeInputs)) b: CascadeInputs) {
    return this.goals.saveCascade(b);
  }

  @Post("from-questionnaire")
  @Can("reports", "edit")
  @HttpCode(200)
  fromQuestionnaire() {
    return this.goals.fromQuestionnaire();
  }

  @Post("cascade/apply")
  @Can("reports", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(cascadeApply) })
  applyCascade(@Body(new ZodPipe(cascadeApply)) b: z.input<typeof cascadeApply>) {
    return this.goals.applyCascade(b);
  }

  @Post()
  @Can("reports", "edit")
  @ApiBody({ schema: schema(goalInput) })
  create(@Body(new ZodPipe(goalInput)) b: GoalInput) {
    return this.goals.create(b);
  }

  @Get(":id")
  @Staff()
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.goals.get(id);
  }

  @Put(":id")
  @Can("reports", "edit")
  @ApiBody({ schema: schema(goalInput) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(goalInput)) b: GoalInput) {
    return this.goals.update(id, b);
  }

  @Delete(":id")
  @Can("reports", "edit")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.goals.remove(id);
  }

  @Post(":id/check-ins")
  @Staff()
  @ApiBody({ schema: schema(checkInInput) })
  checkIn(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(checkInInput)) b: CheckInInput) {
    return this.goals.checkIn(id, b);
  }
}
