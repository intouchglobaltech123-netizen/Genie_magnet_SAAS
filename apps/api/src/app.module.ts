import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { ClientsController } from "./clients/clients.controller.js";
import { ClientsService } from "./clients/clients.service.js";
import { ENV, loadEnv } from "./env.js";
import { HealthController } from "./health/health.controller.js";
import { PrismaService } from "./prisma/prisma.service.js";
import { TenantDb, TenantMiddleware } from "./tenancy/tenant-context.js";

// Modular monolith: each business module (clients, agreements, content, production…) gets its own
// folder with controller + service, talks to the database only through TenantDb, and to other
// modules only through their services. See docs/adr/0001-modular-monolith.md.
@Module({
  controllers: [HealthController, ClientsController],
  providers: [{ provide: ENV, useFactory: () => loadEnv() }, PrismaService, TenantDb, ClientsService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes("*path");
  }
}
