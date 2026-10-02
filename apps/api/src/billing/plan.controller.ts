import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { choosePlanInput } from "@gm/shared";
import { Can, ReadOnlyOk, Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { PlanService } from "./plan.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;

/** The agency's plan (P6-02, P6-03). */
@ApiTags("billing")
@Controller("plan")
@ReadOnlyOk()
export class PlanController {
  constructor(private readonly plans: PlanService) {}

  @Get()
  @Staff()
  page() {
    return this.plans.page();
  }

  @Post("choose")
  @Can("settings", "edit")
  @HttpCode(200)
  @ApiBody({ schema: schema(choosePlanInput) })
  choose(@Body(new ZodPipe(choosePlanInput)) b: z.output<typeof choosePlanInput>) {
    return this.plans.choose(b.plan);
  }
}
