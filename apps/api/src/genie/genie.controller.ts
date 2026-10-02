import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { genieRulesInput, insightDecisionInput } from "@gm/shared";
import { Can, Staff } from "../access/access.js";
import { RateLimit } from "../common/rate-limit.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { GenieService } from "./genie.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** Genie Assistant: its rules (Settings → Genie Assistant) and the insights they raise. */
@ApiTags("genie")
@Controller("genie")
export class GenieController {
  constructor(private readonly genie: GenieService) {}

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

  /** Looks again now, rather than waiting for the morning. */
  @Post("run")
  @Staff()
  @HttpCode(200)
  @RateLimit({ max: 6, windowSeconds: 60 })
  run() {
    return this.genie.runNow();
  }
}
