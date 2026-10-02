import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { type SheetInput, sheetInput, sheetSettingsInput, type SheetTemplateInput, sheetTemplateInput } from "@gm/shared";
import { Can, Staff } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { DailySheetService } from "./daily-sheet.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const datePipe = new ZodPipe(z.iso.date("Give the day as YYYY-MM-DD"));
const sendBack = z.object({ note: z.string().trim().min(2, "Say what to change").max(500) });
const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

/** The daily data sheet (P5-12). */
@ApiTags("people")
@Controller("daily-sheets")
export class DailySheetController {
  constructor(private readonly sheets: DailySheetService) {}

  @Get("settings")
  @Staff()
  settings() {
    return this.sheets.settings();
  }

  @Put("settings")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(sheetSettingsInput) })
  updateSettings(@Body(new ZodPipe(sheetSettingsInput)) b: z.input<typeof sheetSettingsInput>) {
    return this.sheets.updateSettings(b);
  }

  @Get("templates")
  @Staff()
  templates() {
    return this.sheets.templates();
  }

  @Post("templates")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(sheetTemplateInput) })
  createTemplate(@Body(new ZodPipe(sheetTemplateInput)) b: SheetTemplateInput) {
    return this.sheets.saveTemplate(null, b);
  }

  @Put("templates/:id")
  @Can("hr", "edit")
  @ApiBody({ schema: schema(sheetTemplateInput) })
  updateTemplate(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(sheetTemplateInput)) b: SheetTemplateInput) {
    return this.sheets.saveTemplate(id, b);
  }

  @Delete("templates/:id")
  @Can("hr", "edit")
  removeTemplate(@Param("id", ParseUUIDPipe) id: string) {
    return this.sheets.removeTemplate(id);
  }

  @Get("team")
  @Staff()
  @ApiQuery({ name: "date", required: false })
  team(@Query("date") date?: string) {
    return this.sheets.team(z.iso.date().safeParse(date).success ? date! : today());
  }

  @Get("day/:date")
  @Staff()
  @ApiQuery({ name: "person", required: false })
  day(@Param("date", datePipe) date: string, @Query("person") person?: string) {
    return this.sheets.day(date, person ? person.slice(0, 64) : undefined);
  }

  @Put("day/:date")
  @Staff()
  @ApiBody({ schema: schema(sheetInput) })
  save(@Param("date", datePipe) date: string, @Body(new ZodPipe(sheetInput)) b: SheetInput) {
    return this.sheets.save(date, b);
  }

  @Post("day/:date/submit")
  @Staff()
  @HttpCode(200)
  submit(@Param("date", datePipe) date: string) {
    return this.sheets.submit(date);
  }

  @Post(":id/sign")
  @Staff()
  @HttpCode(200)
  sign(@Param("id", ParseUUIDPipe) id: string) {
    return this.sheets.sign(id);
  }

  @Post(":id/send-back")
  @Staff()
  @HttpCode(200)
  @ApiBody({ schema: schema(sendBack) })
  sendBack(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(sendBack)) b: z.output<typeof sendBack>) {
    return this.sheets.sendBack(id, b.note);
  }
}
