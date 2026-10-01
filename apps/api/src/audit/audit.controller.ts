import { Controller, ForbiddenException, Get, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { auditQuery, type AuditQuery } from "@gm/shared";
import { ZodPipe } from "../common/zod.pipe.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { AuditService } from "./audit.service.js";

@ApiTags("audit")
@Controller("audit")
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly tenant: TenantDb,
  ) {}

  /** The agency's audit log, or one record's history with `entity` and `entityId`. */
  @Get()
  @ApiQuery({ name: "entity", required: false })
  @ApiQuery({ name: "entityId", required: false })
  @ApiQuery({ name: "actorId", required: false })
  @ApiQuery({ name: "from", required: false, description: "ISO date or time, inclusive" })
  @ApiQuery({ name: "to", required: false, description: "ISO date or time, exclusive" })
  @ApiQuery({ name: "cursor", required: false, description: "`next` from the previous page" })
  @ApiQuery({ name: "limit", required: false })
  list(@Query(new ZodPipe(auditQuery)) q: AuditQuery) {
    // Until the permission matrix (P1-11) decides this per role: owners and managers only.
    const role = this.tenant.role;
    if (role && role !== "owner" && role !== "manager") throw new ForbiddenException("Only owners and managers can see the audit log.");
    return this.audit.list(q);
  }
}
