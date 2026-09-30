import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { createPrisma } from "@gm/db";
import { AUTH, AUTH_PRISMA, createAuth } from "./auth/auth.js";
import { MeController } from "./auth/me.controller.js";
import { Outbox } from "./auth/outbox.js";
import { ClientsController } from "./clients/clients.controller.js";
import { ClientsService } from "./clients/clients.service.js";
import { ENV, type Env, loadEnv } from "./env.js";
import { HealthController } from "./health/health.controller.js";
import { PrismaService } from "./prisma/prisma.service.js";
import { TenantDb, TenantMiddleware } from "./tenancy/tenant-context.js";

// Modular monolith: each business module (clients, agreements, content, production…) gets its own
// folder with controller + service, talks to the database only through TenantDb, and to other
// modules only through their services. See docs/adr/0001-modular-monolith.md.
@Module({
  controllers: [HealthController, MeController, ClientsController],
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    PrismaService,
    Outbox,
    // Sign-in runs on its own database role (genie_auth) — see migration 20261019000000_auth.
    { provide: AUTH_PRISMA, inject: [ENV], useFactory: (env: Env) => (env.AUTH_DATABASE_URL ? createPrisma(env.AUTH_DATABASE_URL) : null) },
    {
      provide: AUTH,
      inject: [ENV, AUTH_PRISMA, Outbox],
      useFactory: (env: Env, db: ReturnType<typeof createPrisma> | null, outbox: Outbox) => (db && env.BETTER_AUTH_SECRET ? createAuth(env, db, outbox) : null),
    },
    TenantDb,
    ClientsService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes("*path");
  }
}
