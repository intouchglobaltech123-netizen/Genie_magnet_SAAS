import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { postMetricInput, reportMake, reportNote } from "@gm/shared";
import { Can } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { ReportsService } from "./reports.service.js";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
const thisMonth = () => new Date().toISOString().slice(0, 7);

/** Monthly reports (P3-09): seen by people who may see reports; made, noted and released by people who change clients. */
@ApiTags("reports")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @Can("reports", "view")
  @ApiQuery({ name: "month", required: false })
  list(@Query("month") month?: string) {
    return this.reports.list(month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : thisMonth());
  }

  @Post()
  @Can("clients", "edit")
  @ApiBody({ schema: schema(reportMake) })
  make(@Body(new ZodPipe(reportMake)) b: z.output<typeof reportMake>) {
    return this.reports.make(b.clientId, b.month);
  }

  @Get(":id")
  @Can("reports", "view")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.reports.get(id);
  }

  @Post(":id/refresh")
  @Can("clients", "edit")
  @HttpCode(200)
  refresh(@Param("id", ParseUUIDPipe) id: string) {
    return this.reports.refresh(id);
  }

  @Put(":id/note")
  @Can("clients", "edit")
  @ApiBody({ schema: schema(reportNote) })
  note(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(reportNote)) b: z.output<typeof reportNote>) {
    return this.reports.setNote(id, b.note);
  }

  @Post(":id/release")
  @Can("clients", "edit")
  @HttpCode(200)
  release(@Param("id", ParseUUIDPipe) id: string) {
    return this.reports.release(id);
  }
}

/** A published post's numbers, entered by the people who publish. */
@ApiTags("reports")
@Controller("publishing/posts/:id/metrics")
export class PostMetricsController {
  constructor(private readonly reports: ReportsService) {}

  @Put()
  @Can("publishing", "edit")
  @ApiBody({ schema: schema(postMetricInput) })
  set(@Param("id", ParseUUIDPipe) id: string, @Body(new ZodPipe(postMetricInput)) b: z.output<typeof postMetricInput>) {
    return this.reports.setMetrics(id, b);
  }
}
