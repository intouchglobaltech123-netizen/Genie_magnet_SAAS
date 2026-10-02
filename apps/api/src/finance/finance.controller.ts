import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { costRateInput, costSettingsInput, expenseDecision, type ExpenseInput, expenseInput, reopenInput } from "@gm/shared";
import { Can, Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { CollectionsService } from "./collections.service.js";
import { CostingService } from "./costing.service.js";
import { ExpensesService } from "./expenses.service.js";
import { FinanceReportService } from "./finance-report.service.js";

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

/** The month's money (P5-05), and closing a month. */
@ApiTags("finance")
@Controller("finance")
export class FinanceController {
  constructor(private readonly report: FinanceReportService) {}

  /** `?from=YYYY-MM&to=YYYY-MM` (the last six months when left out). */
  @Get("months")
  @Can("finance", "view")
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  months(@Query("from") from?: string, @Query("to") to?: string) {
    const end = to ?? thisMonth();
    const d = new Date(`${end}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 5);
    return this.report.report(from ?? d.toISOString().slice(0, 7), end);
  }

  @Post("months/:month/close")
  @Can("finance", "approve")
  @HttpCode(200)
  close(@Param("month", new ZodPipe(z.string().regex(/^\d{4}-\d{2}$/))) month: string) {
    return this.report.close(month);
  }

  @Post("months/:month/reopen")
  @Can("finance", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(reopenInput) })
  reopen(@Param("month", new ZodPipe(z.string().regex(/^\d{4}-\d{2}$/))) month: string, @Body(new ZodPipe(reopenInput)) b: z.output<typeof reopenInput>) {
    return this.report.reopen(month, b.reason);
  }
}

/** Collections (P5-04): what clients owe, by how late. */
@ApiTags("finance")
@Controller("collections")
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get("ageing")
  @Can("invoices", "view")
  ageing() {
    return this.collections.ageing();
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
