import { Injectable } from "@nestjs/common";
import type { SetupStatus, SetupStep } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

/**
 * The set-up guide on Home (P1-32): which steps the agency has done, worked out from its real data, so each step ticks
 * itself. Anyone on the team may see it; the people who may change settings can hide it for everyone.
 */
@Injectable()
export class SetupService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async status(): Promise<SetupStatus> {
    const db = this.tenant.db;
    const agencyId = this.tenant.agencyId;
    const changedBySomeone = (entity: string) => db.auditLog.count({ where: { entity, actorId: { not: null }, action: { not: "seed" } } });
    const [agency, questionnaire, packages, roles, members, clients, leads, invoices, production, questions, platforms, videos] = await Promise.all([
      db.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { logo: true, brandColor: true, businessStage: true, setupHiddenAt: true } }),
      db.questionnaireResponse.count({ where: { clientId: null, requiredDoneAt: { not: null } } }),
      db.package.count({ where: { active: true } }),
      changedBySomeone("role"),
      db.membership.count({ where: { agencyId } }),
      db.client.count(),
      db.lead.count(),
      db.invoiceSettings.count(),
      db.productionSettings.count(),
      changedBySomeone("questionnaire"),
      db.platformConnection.count(),
      db.video.count(),
    ]);
    const steps: Record<SetupStep, boolean> = {
      agency_questionnaire: questionnaire > 0,
      profile: !!(agency.logo || agency.brandColor || agency.businessStage),
      packages: packages > 0,
      roles: roles > 0,
      team: members > 1,
      clients: clients > 0,
      leads: leads > 0,
      invoices: invoices > 0,
      onboarding_questions: questions > 0,
      production: production > 0,
      platforms: platforms > 0,
      videos: videos > 0,
    };
    return { hidden: !!agency.setupHiddenAt, steps };
  }

  async setHidden(hidden: boolean) {
    await this.tenant.tx(async (tx) => {
      await tx.agency.update({ where: { id: this.tenant.agencyId }, data: { setupHiddenAt: hidden ? new Date() : null } });
      await this.audit.record(tx, {
        action: hidden ? "hide_setup" : "show_setup",
        entity: "agency",
        entityId: this.tenant.agencyId,
        after: { setupGuide: hidden ? "hidden" : "shown" },
      });
    });
    return this.status();
  }
}
