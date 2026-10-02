import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  attendanceCorrectionInput,
  attendanceSettingsInput,
  departmentInput,
  type EmployeeBankInput,
  employeeBankInput,
  type EmployeeInput,
  employeeInput,
  leaveDecision,
  type LeaveRequestInput,
  leaveRequestInput,
  leaveTypesInput,
} from "@gm/shared";
import { Can, Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { AttendanceService } from "./attendance.service.js";
import { EmployeesService } from "./employees.service.js";
import { LeaveService } from "./leave.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const userIdPipe = new ZodPipe(z.string().min(1).max(64));
const decision = z.object({ approved: z.boolean(), note: z.string().trim().max(500).optional() });

/** Employee records (P5-06): HR sees everyone; each person sees their own. */
@ApiTags("people")
@Controller("people")
export class PeopleController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @Staff()
  list() {
    return this.employees.list();
  }

  @Get("departments")
  @Staff()
  departments() {
    return this.employees.departments();
  }

  @Post("departments")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(departmentInput) })
  addDepartment(@Body(new ZodPipe(departmentInput)) b: z.output<typeof departmentInput>) {
    return this.employees.addDepartment(b);
  }

  @Delete("departments/:id")
  @Can("hr", "edit")
  removeDepartment(@Param("id", ParseUUIDPipe) id: string) {
    return this.employees.removeDepartment(id);
  }

  @Get(":userId")
  @Staff()
  get(@Param("userId", userIdPipe) userId: string) {
    return this.employees.get(userId);
  }

  @Put(":userId")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(employeeInput) })
  update(@Param("userId", userIdPipe) userId: string, @Body(new ZodPipe(employeeInput)) b: EmployeeInput) {
    return this.employees.update(userId, b);
  }

  /** Bank account, IFSC, PAN, UAN and ESI number — payroll only. */
  @Put(":userId/bank")
  @Can("salaries", "edit")
  @ApiBody({ schema: schema(employeeBankInput) })
  bank(@Param("userId", userIdPipe) userId: string, @Body(new ZodPipe(employeeBankInput)) b: EmployeeBankInput) {
    return this.employees.updateBank(userId, b);
  }
}

/** Attendance (P5-07): imported through Import from Excel; corrections asked for by anyone, decided by HR. */
@ApiTags("people")
@Controller("attendance")
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  /** The month's days for everyone (HR) or for the person themselves. */
  @Get()
  @Staff()
  @ApiQuery({ name: "month", required: false })
  month(@Query("month") month?: string) {
    return this.attendance.month(month ?? new Date().toISOString().slice(0, 7));
  }

  @Get("settings")
  @Staff()
  settings() {
    return this.attendance.settings();
  }

  @Put("settings")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(attendanceSettingsInput) })
  updateSettings(@Body(new ZodPipe(attendanceSettingsInput)) b: z.output<typeof attendanceSettingsInput>) {
    return this.attendance.updateSettings(b);
  }

  @Get("corrections")
  @Staff()
  @ApiQuery({ name: "state", required: false })
  corrections(@Query("state") state?: string) {
    return this.attendance.corrections(state?.slice(0, 20));
  }

  @Post("corrections")
  @Staff()
  @ApiBody({ schema: schema(attendanceCorrectionInput) })
  requestCorrection(@Body(new ZodPipe(attendanceCorrectionInput)) b: z.output<typeof attendanceCorrectionInput>) {
    return this.attendance.requestCorrection(b);
  }

  @Post("corrections/:id/decision")
  @Can("hr", "approve")
  @HttpCode(200)
  decide(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(decision)) b: z.output<typeof decision>) {
    return this.attendance.decideCorrection(id, b);
  }
}

/** Leave (P5-08): anyone asks for their own; HR approves and keeps the kinds of leave. */
@ApiTags("people")
@Controller("leave")
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get("types")
  @Staff()
  types() {
    return this.leave.types();
  }

  @Put("types")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(leaveTypesInput) })
  saveTypes(@Body(new ZodPipe(leaveTypesInput)) b: z.output<typeof leaveTypesInput>) {
    return this.leave.saveTypes(b);
  }

  /** `?status=pending|approved|rejected|cancelled`, `?mine=1`. */
  @Get()
  @Staff()
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "mine", required: false })
  list(@Query("status") status?: string, @Query("mine") mine?: string) {
    return this.leave.list({ status: status?.slice(0, 20), mine: mine === "1" });
  }

  @Get("balances")
  @Staff()
  @ApiQuery({ name: "year", required: false })
  balances(@Query("year") year?: string) {
    const y = Number(year);
    return this.leave.balances(Number.isInteger(y) && y > 2000 && y < 2100 ? y : new Date().getUTCFullYear());
  }

  @Post()
  @Staff()
  @ApiBody({ schema: schema(leaveRequestInput) })
  request(@Body(new ZodPipe(leaveRequestInput)) b: LeaveRequestInput) {
    return this.leave.request(b);
  }

  @Post(":id/cancel")
  @Staff()
  @HttpCode(200)
  cancel(@Param("id", ParseUUIDPipe) id: string) {
    return this.leave.cancel(id);
  }

  @Post(":id/decision")
  @Can("hr", "approve")
  @HttpCode(200)
  @ApiBody({ schema: schema(leaveDecision) })
  decide(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(leaveDecision)) b: z.output<typeof leaveDecision>) {
    return this.leave.decide(id, b);
  }
}
