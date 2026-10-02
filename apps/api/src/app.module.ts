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
import { InvoicePayLinkController, PaymentsController, RazorpayWebhookController } from "./payments/payments.controller.js";
import { PaymentsService } from "./payments/payments.service.js";
import { OutboxPaymentsProvider, PAYMENTS_PROVIDER, RazorpayProvider } from "./payments/provider.js";
import { ReportsService } from "./reports/reports.service.js";
import { ClientMessages } from "./whatsapp/client-messages.service.js";
import { WhatsAppInbound } from "./whatsapp/inbound.service.js";
import { CloudApiProvider, OutboxProvider, WHATSAPP_PROVIDER } from "./whatsapp/provider.js";
import { LiveSocialNetworks, OutboxSocialNetworks, SOCIAL_NETWORKS } from "./social/provider.js";
import { ClientSocialController, SocialController, SocialWebhookController } from "./social/social.controller.js";
import { SocialService } from "./social/social.service.js";
import { GenieController } from "./genie/genie.controller.js";
import { CollectionsService } from "./finance/collections.service.js";
import { FinanceReportService } from "./finance/finance-report.service.js";
import { PeriodLock } from "./finance/period-lock.js";
import { AttendanceService } from "./people/attendance.service.js";
import { EmployeesService } from "./people/employees.service.js";
import { LeaveService } from "./people/leave.service.js";
import { AttendanceController, LeaveController, PeopleController } from "./people/people.controller.js";
import { PayrollController, PayslipsController } from "./payroll/payroll.controller.js";
import { HiringController } from "./hiring/hiring.controller.js";
import { LearningService } from "./performance/learning.service.js";
import { PerformanceMetrics } from "./performance/metrics.js";
import { LearningController, PerformanceController } from "./performance/performance.controller.js";
import { PerformanceService } from "./performance/performance.service.js";
import { HiringService } from "./hiring/hiring.service.js";
import { PayrollLock } from "./payroll/payroll-lock.js";
import { PayrollService } from "./payroll/payroll.service.js";
import { CostingService } from "./finance/costing.service.js";
import { ExpensesService } from "./finance/expenses.service.js";
import { CollectionsController, CostingController, ExpensesController, FinanceController, VendorsController } from "./finance/finance.controller.js";
import { GenieService } from "./genie/genie.service.js";
import { AskService } from "./genie/ask.service.js";
import { DraftsService } from "./genie/drafts.service.js";
import { ClaudeModel, GENIE_MODEL, NoModel, StandInModel } from "./genie/model.js";
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
    PaymentsController,
    InvoicePayLinkController,
    RazorpayWebhookController,
    SocialController,
    ClientSocialController,
    SocialWebhookController,
    GenieController,
    ExpensesController,
    VendorsController,
    CostingController,
    CollectionsController,
    FinanceController,
    PeopleController,
    AttendanceController,
    LeaveController,
    PayrollController,
    PayslipsController,
    HiringController,
    PerformanceController,
    LearningController,
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
              joined: (agencyId, invitationId, userId) => withAgency(app.client, agencyId, (tx) => HiringService.linkHire(tx, agencyId, invitationId, userId)),
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
    // Payment links through each agency's own Razorpay in production; pretend links elsewhere.
    {
      provide: PAYMENTS_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        (env.PAYMENTS_PROVIDER ?? (env.NODE_ENV === "production" ? "razorpay" : "outbox")) === "razorpay"
          ? new RazorpayProvider(env.RAZORPAY_API_URL)
          : new OutboxPaymentsProvider(),
    },
    PaymentsService,
    // Clients' Instagram, Facebook Pages and YouTube through our Meta and Google apps in production; pretend platforms elsewhere.
    {
      provide: SOCIAL_NETWORKS,
      inject: [ENV],
      useFactory: (env: Env) =>
        (env.SOCIAL_PROVIDER ?? (env.NODE_ENV === "production" ? "live" : "outbox")) === "live"
          ? new LiveSocialNetworks({
              metaAppId: env.META_APP_ID,
              metaAppSecret: env.META_APP_SECRET,
              graphUrl: env.META_GRAPH_URL,
              googleClientId: env.GOOGLE_CLIENT_ID,
              googleClientSecret: env.GOOGLE_CLIENT_SECRET,
            })
          : new OutboxSocialNetworks(),
    },
    SocialService,
    // Genie Assistant's model: Claude on our own Anthropic account; a stand-in on development and test servers; off on a
    // real server until the key is set.
    {
      provide: GENIE_MODEL,
      inject: [ENV],
      useFactory: (env: Env) => {
        const mode = env.GENIE_AI ?? (env.ANTHROPIC_API_KEY ? "claude" : env.NODE_ENV === "production" ? "off" : "stand-in");
        if (mode === "claude" && env.ANTHROPIC_API_KEY) return new ClaudeModel(env.ANTHROPIC_API_KEY, env.GENIE_MODEL);
        return mode === "stand-in" ? new StandInModel() : new NoModel();
      },
    },
    GenieService,
    DraftsService,
    AskService,
    ExpensesService,
    CostingService,
    CollectionsService,
    FinanceReportService,
    PeriodLock,
    EmployeesService,
    AttendanceService,
    LeaveService,
    PayrollLock,
    PayrollService,
    HiringService,
    PerformanceMetrics,
    PerformanceService,
    LearningService,
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
