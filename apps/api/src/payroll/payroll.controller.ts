import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { type PayrollSettingsInput, payrollMonth, payrollSettingsInput, type PayslipChange, payslipChange, type SalaryInput, salaryInput } from "@gm/shared";
import { Can, Staff, Suite } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { PayrollService } from "./payroll.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const monthPipe = new ZodPipe(payrollMonth);
const userIdPipe = new ZodPipe(z.string().min(1).max(64));
const start = z.object({ month: payrollMonth });
const unlock = z.object({ reason: z.string().trim().min(3, "Say why it is unlocked").max(500) });

/**
 * Payroll (P5-09): salaries, the agency's own rules, and each month's run. Open to those who may see salaries — the
 * owner by default; locking and the bank sheet need approval.
 */
@ApiTags("payroll")
@Suite("people")
@Controller("payroll")
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get("settings")
  @Can("salaries", "view")
  settings() {
    return this.payroll.settings();
  }

  @Put("settings")
  @Can("salaries", "edit")
  @ApiBody({ schema: schema(payrollSettingsInput) })
  updateSettings(@Body(new ZodPipe(payrollSettingsInput)) b: PayrollSettingsInput) {
    return this.payroll.updateSettings(b);
  }

  @Get("salaries")
  @Can("salaries", "view")
  salaries() {
    return this.payroll.salaries();
  }

  @Put("salaries/:userId")
  @Can("salaries", "edit")
  @ApiBody({ schema: schema(salaryInput) })
  setSalary(@Param("userId", userIdPipe) userId: string, @Body(new ZodPipe(salaryInput)) b: SalaryInput) {
    return this.payroll.setSalary(userId, b);
  }

  @Delete("salaries/:id")
  @Can("salaries", "edit")
  removeSalary(@Param("id", ParseUUIDPipe) id: string) {
    return this.payroll.removeSalary(id);
  }

  @Get("runs")
  @Can("salaries", "view")
  runs() {
    return this.payroll.runs();
  }

  @Post("runs")
  @Can("salaries", "edit")
  @ApiBody({ schema: schema(start) })
  start(@Body(new ZodPipe(start)) b: z.output<typeof start>) {
    return this.payroll.start(b.month);
  }

  @Get("runs/:month")
  @Can("salaries", "view")
  run(@Param("month", monthPipe) month: string) {
    return this.payroll.run(month);
  }

  @Post("runs/:month/refresh")
  @Can("salaries", "edit")
  @HttpCode(200)
  refresh(@Param("month", monthPipe) month: string) {
    return this.payroll.refresh(month);
  }

  @Put("runs/:month/payslips/:userId")
  @Can("salaries", "edit")
  @ApiBody({ schema: schema(payslipChange) })
  change(@Param("month", monthPipe) month: string, @Param("userId", userIdPipe) userId: string, @Body(new ZodPipe(payslipChange)) b: PayslipChange) {
    return this.payroll.change(month, userId, b);
  }

  @Post("runs/:month/lock")
  @Can("salaries", "approve")
  @HttpCode(200)
  lock(@Param("month", monthPipe) month: string) {
    return this.payroll.lock(month);
  }

  @Post("runs/:month/unlock")
  @Can("salaries", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(unlock) })
  unlock(@Param("month", monthPipe) month: string, @Body(new ZodPipe(unlock)) b: z.output<typeof unlock>) {
    return this.payroll.unlock(month, b.reason);
  }

  @Delete("runs/:month")
  @Can("salaries", "edit")
  remove(@Param("month", monthPipe) month: string) {
    return this.payroll.remove(month);
  }

  @Get("runs/:month/bank-sheet")
  @Can("salaries", "approve")
  bankSheet(@Param("month", monthPipe) month: string) {
    return this.payroll.bankSheet(month);
  }
}

/** Each person's own payslips, once their month is locked. */
@ApiTags("payroll")
@Suite("people")
@Controller("payslips")
export class PayslipsController {
  constructor(private readonly payroll: PayrollService) {}

  @Get()
  @Staff()
  mine() {
    return this.payroll.mine();
  }

  @Get(":id")
  @Staff()
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.payroll.payslip(id);
  }
}
