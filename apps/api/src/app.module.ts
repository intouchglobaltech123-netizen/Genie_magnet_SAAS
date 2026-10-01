import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { createPrisma, ensureDefaultRoles, withAgency } from "@gm/db";
import { AccessService, PermissionGuard } from "./access/access.js";
import { AuditController } from "./audit/audit.controller.js";
import { AuditService } from "./audit/audit.service.js";
import { AUTH, AUTH_PRISMA, createAuth } from "./auth/auth.js";
import { MeController } from "./auth/me.controller.js";
import { Outbox } from "./auth/outbox.js";
import { ClientsController } from "./clients/clients.controller.js";
import { ClientsService } from "./clients/clients.service.js";
import { ErrorFilter } from "./common/error.filter.js";
import { RateLimitGuard } from "./common/rate-limit.js";
import { ENV, type Env, loadEnv } from "./env.js";
import { HealthController } from "./health/health.controller.js";
import { ImportsController } from "./imports/imports.controller.js";
import { ImportsService } from "./imports/imports.service.js";
import { PrismaService } from "./prisma/prisma.service.js";
import { AgencyService } from "./settings/agency.service.js";
import { PackagesService } from "./settings/packages.service.js";
import { AgencyController, PackagesController } from "./settings/settings.controller.js";
import { RolesService } from "./team/roles.service.js";
import { RolesController, TeamController } from "./team/team.controller.js";
import { TeamService } from "./team/team.service.js";
import { TenantDb, TenantMiddleware } from "./tenancy/tenant-context.js";

// Modular monolith: each business module (clients, agreements, content, production…) gets its own
// folder with controller + service, talks to the database only through TenantDb, and to other
// modules only through their services. See docs/adr/0001-modular-monolith.md.
@Module({
  controllers: [
    HealthController,
    MeController,
    AgencyController,
    PackagesController,
    TeamController,
    RolesController,
    AuditController,
    ClientsController,
    ImportsController,
  ],
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    PrismaService,
    Outbox,
    // Sign-in runs on its own database role (genie_auth) — see migration 20261019000000_auth.
    { provide: AUTH_PRISMA, inject: [ENV], useFactory: (env: Env) => (env.AUTH_DATABASE_URL ? createPrisma(env.AUTH_DATABASE_URL) : null) },
    {
      provide: AUTH,
      inject: [ENV, AUTH_PRISMA, Outbox, AuditService, PrismaService],
      useFactory: (env: Env, db: ReturnType<typeof createPrisma> | null, outbox: Outbox, audit: AuditService, app: PrismaService) =>
        db && env.BETTER_AUTH_SECRET
          ? createAuth(env, db, {
              outbox,
              audit: audit.recordFor,
              setUpAgency: (agencyId) => withAgency(app.client, agencyId, (tx) => ensureDefaultRoles(tx, agencyId)),
            })
          : null,
    },
    TenantDb,
    AccessService,
    AuditService,
    RolesService,
    TeamService,
    AgencyService,
    PackagesService,
    ClientsService,
    ImportsService,
    // Order matters: rate limit first, then permissions; errors in one shape.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes("*path");
  }
}
