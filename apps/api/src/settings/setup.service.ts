import { Injectable } from "@nestjs/common";
import { recommendSuites, type SetupStatus, type SetupStep, type SetupWizard } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { SampleService } from "./sample.service.js";

/** A figure from an answer: a number, or one written with commas ("15,00,000"). */
const amount = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * The set-up guide on Home (P1-32): which steps the agency has done, worked out from its real data, so each step ticks
 * itself. Anyone on the team may see it; the people who may change settings can hide it for everyone.
 */
@Injectable()
export class SetupService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly sample: SampleService,
  ) {}

  async status(): Promise<SetupStatus> {
    const db = this.tenant.db;
    const agencyId = this.tenant.agencyId;
    const changedBySomeone = (entity: string) => db.auditLog.count({ where: { entity, actorId: { not: null }, action: { not: "seed" } } });
    const [agency, questionnaire, packages, roles, members, clients, leads, invoices, production, questions, platforms, videos, whatsapp, portal] =
      await Promise.all([
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
        db.whatsAppConnection.count(),
        db.portalLink.count(),
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
      whatsapp: whatsapp > 0,
      portal: portal > 0,
    };
    return { hidden: !!agency.setupHiddenAt, steps };
  }

  /** The set-up wizard (P6-06): the agency questionnaire's essentials, and what they make so far. */
  async wizard(): Promise<SetupWizard> {
    const db = this.tenant.db;
    const agencyId = this.tenant.agencyId;
    const [response, packages, goals, onTeam, invited, sample] = await Promise.all([
      db.questionnaireResponse.findFirst({
        where: { clientId: null, template: { kind: "agency" } },
        include: { answers: { where: { questionKey: { in: ["a3", "a4", "a13", "a14b", "a20"] } } } },
        orderBy: { createdAt: "desc" },
      }),
      db.package.count({ where: { active: true } }),
      db.goal.count(),
      db.membership.count({ where: { agencyId } }),
      db.invitation.count({ where: { status: "pending" } }),
      this.sample.status(),
    ]);
    const answer = (k: string) => response?.answers.find((a) => a.questionKey === k)?.value;
    const rows = (k: string) => {
      const v = answer(k);
      return Array.isArray(v)
        ? (v as Record<string, unknown>[]).filter((r) => r && typeof r === "object" && Object.values(r).some((x) => String(x ?? "").trim()))
        : [];
    };
    const services = Array.isArray(answer("a3")) ? (answer("a3") as unknown[]).map(String) : [];
    const packageRows = rows("a4").filter((r) => String(r.name ?? "").trim());
    const team = rows("a20").filter((r) => String(r.name ?? "").trim());
    const target = amount(answer("a14b"));
    const aspiration = typeof answer("a13") === "string" && (answer("a13") as string).trim() !== "";
    return {
      questionnaire: response ? { id: response.id, requiredDone: !!response.requiredDoneAt } : null,
      packages: { inAnswers: packageRows.length, made: packages },
      goals: { target, made: goals },
      suites: recommendSuites({
        services,
        packages: packageRows.map((r) => ({ price: amount(r.price), shootDays: amount(r.shootDays) })),
        team: team.length,
        goal: aspiration || target !== null,
      }),
      team: { inAnswers: team.length, onTeam, invited },
      sample,
    };
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
