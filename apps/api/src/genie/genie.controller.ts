import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { aiSettingsInput, askInput, type DraftRequest, draftDecision, draftRequest, evaluationInput, genieRulesInput, insightDecisionInput } from "@gm/shared";
import { Can, Staff } from "../access/access.js";
import { RateLimit } from "../common/rate-limit.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { AskService } from "./ask.service.js";
import { DraftsService } from "./drafts.service.js";
import { GenieService } from "./genie.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** Genie Assistant: its rules (Settings → Genie Assistant) and the insights they raise. */
@ApiTags("genie")
@Controller("genie")
export class GenieController {
  constructor(
    private readonly genie: GenieService,
    private readonly drafts: DraftsService,
    private readonly asking: AskService,
  ) {}

  @Get("settings")
  @Staff()
  settings() {
    return this.genie.settings();
  }

  /** Switches rules on or off and sets their thresholds. */
  @Put("settings")
  @Can("settings", "edit")
  @ApiBody({ schema: schema(genieRulesInput) })
  update(@Body(new ZodPipe(genieRulesInput)) b: z.output<typeof genieRulesInput>) {
    return this.genie.updateRules(b);
  }

  /** What the rules found that this person may see: `?status=open|done|dismissed|resolved`, `?rule=`, `?mine=1`. */
  @Get("insights")
  @Staff()
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "rule", required: false })
  @ApiQuery({ name: "mine", required: false })
  insights(@Query("status") status?: string, @Query("rule") rule?: string, @Query("mine") mine?: string) {
    return this.genie.list({ status, rule, mine: mine === "1" || mine === "true" });
  }

  @Put("insights/:id")
  @Staff()
  @ApiBody({ schema: schema(insightDecisionInput) })
  decide(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(insightDecisionInput)) b: z.output<typeof insightDecisionInput>) {
    return this.genie.decide(id, b.status);
  }

  /** Drafting on or off, the monthly AI budget, and how long prompts and conversations are kept. */
  @Put("ai")
  @Can("settings", "edit")
  @ApiBody({ schema: schema(aiSettingsInput) })
  ai(@Body(new ZodPipe(aiSettingsInput)) b: z.output<typeof aiSettingsInput>) {
    return this.genie.updateAi(b);
  }

  /** This month's AI usage against the budget (the owner's usage view). */
  @Get("usage")
  @Can("settings", "edit")
  usage() {
    return this.genie.usage();
  }

  /** Drafts captions for posts already published and measures them against the captions the team approved. */
  @Post("evaluate")
  @Can("settings", "edit")
  @HttpCode(200)
  @RateLimit({ max: 3, windowSeconds: 60 })
  @ApiBody({ schema: schema(evaluationInput) })
  evaluate(@Body(new ZodPipe(evaluationInput)) b: z.output<typeof evaluationInput>) {
    return this.drafts.evaluate(b.size);
  }

  /** A draft for a person to approve, edit or reject: `kind` nudge, caption, ideas or report_summary. */
  @Post("drafts")
  @Staff()
  @RateLimit({ max: 20, windowSeconds: 60 })
  @ApiBody({ schema: schema(draftRequest) })
  draft(@Body(new ZodPipe(draftRequest)) b: DraftRequest) {
    return this.drafts.create(b);
  }

  /** Drafts for one record: `?entity=video&entityId=…`. */
  @Get("drafts")
  @Staff()
  @ApiQuery({ name: "entity", required: true })
  @ApiQuery({ name: "entityId", required: true })
  draftsFor(@Query("entity") entity = "", @Query("entityId") entityId = "") {
    return this.drafts.list(entity.slice(0, 40), entityId.slice(0, 64));
  }

  @Get("drafts/:id")
  @Staff()
  getDraft(@Param("id", ParseUUIDPipe) id: string) {
    return this.drafts.get(id);
  }

  /** Approved as written or with the person's edits, or rejected. */
  @Post("drafts/:id/decision")
  @Staff()
  @HttpCode(200)
  @ApiBody({ schema: schema(draftDecision) })
  decideDraft(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(draftDecision)) b: z.output<typeof draftDecision>) {
    return this.drafts.decide(id, b);
  }

  /** Ask Genie: a question about the agency, answered from what this person may see, with links to the records. */
  @Post("ask")
  @Staff()
  @HttpCode(200)
  @RateLimit({ max: 20, windowSeconds: 60 })
  @ApiBody({ schema: schema(askInput) })
  ask(@Body(new ZodPipe(askInput)) b: z.output<typeof askInput>) {
    return this.asking.ask(b);
  }

  /** This person's own Ask Genie conversations. */
  @Get("conversations")
  @Staff()
  conversations() {
    return this.asking.list();
  }

  @Get("conversations/:id")
  @Staff()
  conversation(@Param("id", ParseUUIDPipe) id: string) {
    return this.asking.get(id);
  }

  @Delete("conversations/:id")
  @Staff()
  @HttpCode(204)
  async forget(@Param("id", ParseUUIDPipe) id: string) {
    await this.asking.remove(id);
  }

  /** Looks again now, rather than waiting for the morning. */
  @Post("run")
  @Staff()
  @HttpCode(200)
  @RateLimit({ max: 6, windowSeconds: 60 })
  run() {
    return this.genie.runNow();
  }
}
