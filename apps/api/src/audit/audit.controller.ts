import { Controller, Get, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { auditQuery, type AuditQuery } from "@gm/shared";
import { Can } from "../access/access.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { AuditService } from "./audit.service.js";

@ApiTags("audit")
@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** The agency's audit log, or one record's history with `entity` and `entityId`. */
  @Get()
  @Can("audit", "view")
  @ApiQuery({ name: "entity", required: false })
  @ApiQuery({ name: "entityId", required: false })
  @ApiQuery({ name: "actorId", required: false })
  @ApiQuery({ name: "from", required: false, description: "ISO date or time, inclusive" })
  @ApiQuery({ name: "to", required: false, description: "ISO date or time, exclusive" })
  @ApiQuery({ name: "cursor", required: false, description: "`next` from the previous page" })
  @ApiQuery({ name: "limit", required: false })
  list(@Query(new ZodPipe(auditQuery)) q: AuditQuery) {
    return this.audit.list(q);
  }
}
