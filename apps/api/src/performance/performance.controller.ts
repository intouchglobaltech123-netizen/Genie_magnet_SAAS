import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  type KraTemplateInput,
  kraTemplateInput,
  type LearningPathInput,
  learningPathInput,
  performanceMonth,
  performanceSettingsInput,
  type PlayerRatingInput,
  playerRatingInput,
  scorecardLines,
} from "@gm/shared";
import { Can, Staff, Suite } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { LearningService, skillsInput } from "./learning.service.js";
import { PerformanceService } from "./performance.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const userIdPipe = new ZodPipe(z.string().min(1).max(64));
const start = z.object({ userId: z.string().min(1).max(64), month: performanceMonth });
const reply = z.object({ text: z.string().trim().min(1, "Write your reply").max(2000) });
const assign = z.object({ userIds: z.array(z.string().min(1).max(64)).min(1, "Choose who it is for").max(100) });
const mark = z.object({ done: z.boolean() });
const level = z.object({ level: z.number().int().min(0).max(4) });
const monthOf = (m?: string) => {
  if (!m) return new Date().toISOString().slice(0, 7);
  if (!performanceMonth.safeParse(m).success) throw new BadRequestException("Give the month as YYYY-MM.");
  return m;
};

/** Performance (P5-11): KRA templates, the month's scorecards, the A–C rating and the leaderboard. */
@ApiTags("performance")
@Suite("people")
@Controller("performance")
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  @Get("settings")
  @Staff()
  settings() {
    return this.performance.settings();
  }

  @Put("settings")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(performanceSettingsInput) })
  updateSettings(@Body(new ZodPipe(performanceSettingsInput)) b: z.input<typeof performanceSettingsInput>) {
    return this.performance.updateSettings(b);
  }

  @Get("templates")
  @Staff()
  templates() {
    return this.performance.templates();
  }

  @Post("templates")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(kraTemplateInput) })
  createTemplate(@Body(new ZodPipe(kraTemplateInput)) b: KraTemplateInput) {
    return this.performance.saveTemplate(null, b);
  }

  @Put("templates/:id")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(kraTemplateInput) })
  updateTemplate(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(kraTemplateInput)) b: KraTemplateInput) {
    return this.performance.saveTemplate(id, b);
  }

  @Delete("templates/:id")
  @Can("hr", "edit")
  removeTemplate(@Param("id", ParseUUIDPipe) id: string) {
    return this.performance.removeTemplate(id);
  }

  @Get("team")
  @Staff()
  @ApiQuery({ name: "month", required: false })
  team(@Query("month") month?: string) {
    return this.performance.team(monthOf(month));
  }

  @Post("scorecards")
  @Staff()
  @ApiBody({ schema: schema(start) })
  start(@Body(new ZodPipe(start)) b: z.output<typeof start>) {
    return this.performance.start(b.userId, b.month);
  }

  @Get("scorecards/mine")
  @Staff()
  mine() {
    return this.performance.mine();
  }

  @Get("scorecards/:id")
  @Staff()
  scorecard(@Param("id", ParseUUIDPipe) id: string) {
    return this.performance.scorecard(id);
  }

  @Put("scorecards/:id")
  @Staff()
  @ApiBody({ schema: schema(scorecardLines) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(scorecardLines)) b: z.output<typeof scorecardLines>) {
    return this.performance.update(id, b);
  }

  @Post("scorecards/:id/refresh")
  @Staff()
  @HttpCode(200)
  refresh(@Param("id", ParseUUIDPipe) id: string) {
    return this.performance.refresh(id);
  }

  @Post("scorecards/:id/share")
  @Staff()
  @HttpCode(200)
  share(@Param("id", ParseUUIDPipe) id: string) {
    return this.performance.share(id);
  }

  @Post("scorecards/:id/reopen")
  @Staff()
  @HttpCode(200)
  reopen(@Param("id", ParseUUIDPipe) id: string) {
    return this.performance.reopen(id);
  }

  @Post("scorecards/:id/reply")
  @Staff()
  @HttpCode(200)
  @ApiBody({ schema: schema(reply) })
  reply(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(reply)) b: z.output<typeof reply>) {
    return this.performance.reply(id, b.text);
  }

  @Get("leaderboard")
  @Staff()
  @ApiQuery({ name: "month", required: false })
  leaderboard(@Query("month") month?: string) {
    return this.performance.leaderboard(monthOf(month));
  }

  @Get("ratings")
  @Staff()
  @ApiQuery({ name: "month", required: false })
  ratings(@Query("month") month?: string) {
    return this.performance.ratings(monthOf(month));
  }

  @Put("ratings/:userId")
  @Staff()
  @ApiBody({ schema: schema(playerRatingInput) })
  rate(@Param("userId", userIdPipe) userId: string, @Body(new ZodPipe(playerRatingInput)) b: PlayerRatingInput) {
    return this.performance.rate(userId, b);
  }
}

/** Learning (P5-11): paths, who has which, progress, and the skill matrix. */
@ApiTags("performance")
@Suite("people")
@Controller("learning")
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get("paths")
  @Staff()
  paths() {
    return this.learning.paths();
  }

  @Post("paths")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(learningPathInput) })
  createPath(@Body(new ZodPipe(learningPathInput)) b: LearningPathInput) {
    return this.learning.savePath(null, b);
  }

  @Put("paths/:id")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(learningPathInput) })
  updatePath(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(learningPathInput)) b: LearningPathInput) {
    return this.learning.savePath(id, b);
  }

  @Delete("paths/:id")
  @Can("hr", "edit")
  removePath(@Param("id", ParseUUIDPipe) id: string) {
    return this.learning.removePath(id);
  }

  @Post("paths/:id/assign")
  @Staff()
  @HttpCode(200)
  @ApiBody({ schema: schema(assign) })
  assign(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(assign)) b: z.output<typeof assign>) {
    return this.learning.assign(id, b.userIds);
  }

  @Get("assignments")
  @Staff()
  assignments() {
    return this.learning.assignments();
  }

  @Put("assignments/:id/modules/:key")
  @Staff()
  @ApiBody({ schema: schema(mark) })
  mark(@Param("id", ParseUUIDPipe) id: string, @Param("key") key: string, @Body(new ZodPipe(mark)) b: z.output<typeof mark>) {
    return this.learning.mark(id, key.slice(0, 40), b.done);
  }

  @Get("skills")
  @Staff()
  skills() {
    return this.learning.matrix();
  }

  @Put("skills")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(skillsInput) })
  saveSkills(@Body(new ZodPipe(skillsInput)) b: z.input<typeof skillsInput>) {
    return this.learning.saveSkills(b);
  }

  @Put("skills/:skillId/levels/:userId")
  @Staff()
  @ApiBody({ schema: schema(level) })
  setLevel(@Param("skillId", ParseUUIDPipe) skillId: string, @Param("userId", userIdPipe) userId: string, @Body(new ZodPipe(level)) b: z.output<typeof level>) {
    return this.learning.setLevel(userId, skillId, b.level);
  }
}
