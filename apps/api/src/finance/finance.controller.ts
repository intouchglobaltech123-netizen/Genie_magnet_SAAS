import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { costRateInput, costSettingsInput, expenseDecision, type ExpenseInput, expenseInput } from "@gm/shared";
import { Can, Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { CostingService } from "./costing.service.js";
import { ExpensesService } from "./expenses.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const thisMonth = () => new Date().toISOString().slice(0, 7);

/** Expenses (P5-02): anyone submits their own; finance sees all and approves. */
@ApiTags("finance")
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  /** `?status=submitted|approved|rejected`, `?month=YYYY-MM`, `?mine=1`. */
  @Get()
  @Staff()
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "month", required: false })
  @ApiQuery({ name: "mine", required: false })
  list(@Query("status") status?: string, @Query("month") month?: string, @Query("mine") mine?: string) {
    return this.expenses.list({ status: status?.slice(0, 20), month: month?.slice(0, 7), mine: mine === "1" });
  }

  @Get(":id")
  @Staff()
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.expenses.get(id);
  }

  @Post()
  @Staff()
  @ApiBody({ schema: schema(expenseInput) })
  create(@Body(new ZodPipe(expenseInput)) b: ExpenseInput) {
    return this.expenses.create(b);
  }

  @Put(":id")
  @Staff()
  @ApiBody({ schema: schema(expenseInput) })
  update(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(expenseInput)) b: ExpenseInput) {
    return this.expenses.update(id, b);
  }

  @Delete(":id")
  @Staff()
  @HttpCode(204)
  async remove(@Param("id", ParseUUIDPipe) id: string) {
    await this.expenses.remove(id);
  }

  @Post(":id/decision")
  @Can("finance", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(expenseDecision) })
  decide(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(expenseDecision)) b: z.output<typeof expenseDecision>) {
    return this.expenses.decide(id, b);
  }
}

@ApiTags("finance")
@Controller("vendors")
export class VendorsController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @Staff()
  list() {
    return this.expenses.vendors();
  }
}

/** True costing (P5-01, P5-03): rates are restricted like salaries; reports need finance access. */
@ApiTags("finance")
@Controller("costing")
export class CostingController {
  constructor(private readonly costing: CostingService) {}

  @Get("rates")
  @Can("salaries", "view")
  rates() {
    return this.costing.rates();
  }

  @Put("rates/:userId")
  @Can("salaries", "edit")
  @ApiBody({ schema: schema(costRateInput) })
  setRate(@Param("userId", new ZodPipe(z.string().min(1).max(64))) userId: string, @Body(new ZodPipe(costRateInput)) b: z.output<typeof costRateInput>) {
    return this.costing.setRate(userId, b);
  }

  @Get("settings")
  @Can("finance", "view")
  settings() {
    return this.costing.settings();
  }

  @Put("settings")
  @Can("finance", "edit")
  @ApiBody({ schema: schema(costSettingsInput) })
  updateSettings(@Body(new ZodPipe(costSettingsInput)) b: z.output<typeof costSettingsInput>) {
    return this.costing.updateSettings(b);
  }

  /** Each video of the month: its whole cost so far against what the client pays for it. */
  @Get("videos")
  @Can("finance", "view")
  @ApiQuery({ name: "month", required: false })
  videos(@Query("month") month?: string) {
    return this.costing.videos(month ?? thisMonth());
  }

  /** Each client's month: what it pays, what was spent on it, the margin. */
  @Get("clients")
  @Can("finance", "view")
  @ApiQuery({ name: "month", required: false })
  clients(@Query("month") month?: string) {
    return this.costing.clients(month ?? thisMonth());
  }

  @Get("summary")
  @Can("finance", "view")
  @ApiQuery({ name: "month", required: false })
  summary(@Query("month") month?: string) {
    return this.costing.summary(month ?? thisMonth());
  }
}
