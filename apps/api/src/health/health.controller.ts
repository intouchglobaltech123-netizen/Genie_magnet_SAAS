import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../access/access.js";
import { RateLimit } from "../common/rate-limit.js";
import { PrismaService } from "../prisma/prisma.service.js";

@ApiTags("health")
@RateLimit(false)
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. */
  @Get()
  live() {
    return { status: "ok", service: "api" };
  }

  /** Readiness: the database answers. No tenant data is read. */
  @Get("ready")
  async ready() {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
      return { status: "ok", database: "ok" };
    } catch {
      throw new ServiceUnavailableException("The database is unreachable.");
    }
  }
}
