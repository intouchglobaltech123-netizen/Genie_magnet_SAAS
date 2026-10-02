import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { createPrisma, setUpAgencyDefaults, withAgency } from "@gm/db";
import { AccessService, PermissionGuard } from "./access/access.js";
import { AuditController } from "./audit/audit.controller.js";
import { AuditService } from "./audit/audit.service.js";
import { AUTH, AUTH_PRISMA, createAuth } from "./auth/auth.js";
import { MeController } from "./auth/me.controller.js";
import { Outbox } from "./auth/outbox.js";
import { AgreementsService } from "./clients/agreements.service.js";
import { AgreementInvoicesController, InvoiceSettingsController, InvoicesController } from "./invoices/invoices.controller.js";
import { InvoicesService } from "./invoices/invoices.service.js";
import { FileStore } from "./files/file-store.js";
import { FilesController, FileTransferController } from "./files/files.controller.js";
import { FilesService } from "./files/files.service.js";
import { NotificationsController } from "./notifications/notifications.controller.js";
import { NotificationsService } from "./notifications/notifications.service.js";
import { ContentService } from "./production/content.service.js";
import { CalendarService } from "./production/calendar.service.js";
import { CyclesService } from "./production/cycles.service.js";
import {
  CalendarController,
  ChangeRequestsController,
  ClientContentController,
  ContentController,
  CyclesController,
  ProductionSettingsController,
  PublishingController,
  ShootsController,
  TimeController,
  TopicListsController,
  VideosController,
} from "./production/production.controller.js";
import { ProductionSettingsService } from "./production/production-settings.service.js";
import { PublishingService } from "./production/publishing.service.js";
import { ShootsService } from "./production/shoots.service.js";
import { VideosService } from "./production/videos.service.js";
import { ClientOnboardingController, OnboardingController, PublicOnboardingController, QuestionnairesController } from "./onboarding/onboarding.controller.js";
import { OnboardingService } from "./onboarding/onboarding.service.js";
import { QuestionnairesService } from "./onboarding/questionnaires.service.js";
import { AgreementsController, ClientsController } from "./clients/clients.controller.js";
import { ClientsService } from "./clients/clients.service.js";
import { ErrorFilter } from "./common/error.filter.js";
import { LeadsController, PipelineController, ProposalsController } from "./crm/crm.controller.js";
import { LeadsService } from "./crm/leads.service.js";
import { PipelineService } from "./crm/pipeline.service.js";
import { ProposalsService } from "./crm/proposals.service.js";
import { RateLimitGuard } from "./common/rate-limit.js";
import { ENV, type Env, loadEnv } from "./env.js";
import { HealthController } from "./health/health.controller.js";
import { ImportsController } from "./imports/imports.controller.js";
import { ImportsService } from "./imports/imports.service.js";
import { DailyChecks } from "./jobs/daily-checks.service.js";
import { JobRunner } from "./jobs/job-runner.js";
import { JobsController } from "./jobs/jobs.controller.js";
import { JobsService } from "./jobs/jobs.service.js";
import { ClientRequestsController, PortalController, PortalLinksController } from "./portal/portal.controller.js";
import { PortalService } from "./portal/portal.service.js";
import { PrismaService } from "./prisma/prisma.service.js";
import { Secrets } from "./common/secrets.js";
import { PostMetricsController, ReportsController } from "./reports/reports.controller.js";
import { ReportsService } from "./reports/reports.service.js";
import { ClientMessages } from "./whatsapp/client-messages.service.js";
import { WhatsAppInbound } from "./whatsapp/inbound.service.js";
import { CloudApiProvider, OutboxProvider, WHATSAPP_PROVIDER } from "./whatsapp/provider.js";
import { ContactWhatsAppController, WhatsAppController, WhatsAppWebhookController } from "./whatsapp/whatsapp.controller.js";
import { WhatsAppService } from "./whatsapp/whatsapp.service.js";
import { AgencyService } from "./settings/agency.service.js";
import { PackagesService } from "./settings/packages.service.js";
import { SetupService } from "./settings/setup.service.js";
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
    AgreementsController,
    InvoiceSettingsController,
    InvoicesController,
    AgreementInvoicesController,
    QuestionnairesController,
    OnboardingController,
    ClientOnboardingController,
    PublicOnboardingController,
    NotificationsController,
    FilesController,
    FileTransferController,
    ProductionSettingsController,
    CyclesController,
    ContentController,
    TopicListsController,
    ClientContentController,
    VideosController,
    ChangeRequestsController,
    ShootsController,
    PublishingController,
    CalendarController,
    TimeController,
    PipelineController,
    LeadsController,
    ProposalsController,
    ImportsController,
    JobsController,
    PortalController,
    PortalLinksController,
    ClientRequestsController,
    WhatsAppController,
    ContactWhatsAppController,
    WhatsAppWebhookController,
    ReportsController,
    PostMetricsController,
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
              setUpAgency: (agencyId) => withAgency(app.client, agencyId, (tx) => setUpAgencyDefaults(tx, agencyId)),
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
    SetupService,
    ClientsService,
    AgreementsService,
    InvoicesService,
    QuestionnairesService,
    OnboardingService,
    NotificationsService,
    FileStore,
    FilesService,
    ProductionSettingsService,
    CyclesService,
    VideosService,
    ContentService,
    ShootsService,
    PublishingService,
    CalendarService,
    PipelineService,
    LeadsService,
    ProposalsService,
    ImportsService,
    JobsService,
    PortalService,
    Secrets,
    // Messages leave through each agency's own WhatsApp number in production; elsewhere they stay in an outbox.
    {
      provide: WHATSAPP_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        (env.WHATSAPP_PROVIDER ?? (env.NODE_ENV === "production" ? "cloud" : "outbox")) === "cloud"
          ? new CloudApiProvider(env.WHATSAPP_API_URL)
          : new OutboxProvider(),
    },
    WhatsAppService,
    ClientMessages,
    WhatsAppInbound,
    ReportsService,
    DailyChecks,
    JobRunner,
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
