import { Body, Controller, Get, Injectable, Put, UnauthorizedException } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { type PlannerData, plannerData } from "@gm/shared";
import { Can } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { TenantDb } from "../tenancy/tenant-context.js";

/**
 * The financial planner (P5-19): each person's own, and theirs alone — there is no way to read anyone else's, the
 * owner's included. Nothing in it is audited by content or used elsewhere.
 */
@Injectable()
export class PlannerService {
  constructor(private readonly tenant: TenantDb) {}

  private me() {
    const me = this.tenant.userId;
    if (!me) throw new UnauthorizedException("Sign in first.");
    return me;
  }

  async get(): Promise<PlannerData | null> {
    const row = await this.tenant.db.personalPlanner.findUnique({ where: { agencyId_userId: { agencyId: this.tenant.agencyId, userId: this.me() } } });
    return row ? plannerData.parse(row.data) : null;
  }

  async save(data: PlannerData) {
    const userId = this.me();
    await this.tenant.db.personalPlanner.upsert({
      where: { agencyId_userId: { agencyId: this.tenant.agencyId, userId } },
      create: { agencyId: this.tenant.agencyId, userId, data },
      update: { data },
    });
    return { saved: true };
  }
}

@ApiTags("people")
@Controller("planner")
export class PlannerController {
  constructor(private readonly planner: PlannerService) {}

  @Get()
  @Can("personal_finance", "view")
  get() {
    return this.planner.get();
  }

  @Put()
  @Can("personal_finance", "edit")
  @ApiBody({ schema: z.toJSONSchema(plannerData, { io: "input" }) as Record<string, unknown> })
  save(@Body(new ZodPipe(plannerData)) b: PlannerData) {
    return this.planner.save(b);
  }
}
