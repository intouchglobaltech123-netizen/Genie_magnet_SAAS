import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { JOB_STATUSES, type JobStatus } from "@gm/shared";
import { Can } from "../access/access.js";
import { JobsService } from "./jobs.service.js";

/** Settings → Background jobs: what ran, what failed, and trying a failed job again. */
@ApiTags("jobs")
@Controller("jobs")
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @Can("settings", "view")
  @ApiQuery({ name: "status", required: false, enum: JOB_STATUSES })
  list(@Query("status") status?: string) {
    return this.jobs.list((JOB_STATUSES as readonly string[]).includes(status ?? "") ? (status as JobStatus) : undefined);
  }

  @Get("overview")
  @Can("settings", "view")
  overview() {
    return this.jobs.overview();
  }

  @Post(":id/retry")
  @Can("settings", "edit")
  @HttpCode(200)
  retry(@Param("id", ParseUUIDPipe) id: string) {
    return this.jobs.retry(id);
  }
}
