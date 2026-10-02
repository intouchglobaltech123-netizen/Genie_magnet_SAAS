import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { asPlatform, withAgency } from "@gm/db";
import { type PlatformAgencyRow, platformSubscriptionInput } from "@gm/shared";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { entitlementsOf } from "../billing/entitlements.js";
import { usageOf } from "../billing/plan.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { PlatformSettingsService } from "./platform-settings.service.js";

/**
 * The platform console (P6-01, ADR 0011): every agency with its plan, usage and health — the numbers, counted inside
 * each agency, never its records — and each agency's subscription, which the platform's team may set.
 */
@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: PlatformSettingsService,
    private readonly audit: AuditService,
  ) {}

  async agencies(): Promise<PlatformAgencyRow[]> {
    const [agencies, subs] = await asPlatform(this.prisma.client, (tx) =>
      Promise.all([
        tx.agency.findMany({ select: { id: true, name: true, slug: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
        tx.subscription.findMany(),
      ]),
    );
    const settings = await this.settings.get();
    return Promise.all(
      agencies.map(async (a) => {
        const ent = entitlementsOf(subs.find((s) => s.agencyId === a.id) ?? null, settings);
        // Counted inside the agency; only the numbers come out.
        const [usage, last, failedJobs] = await withAgency(this.prisma.client, a.id, (tx) =>
          Promise.all([
            usageOf(tx, a.id),
            tx.auditLog.findFirst({ orderBy: { at: "desc" }, select: { at: true } }),
            tx.job.count({ where: { status: "failed" } }),
          ]),
        );
        return {
          id: a.id,
          name: a.name,
          slug: a.slug,
          createdAt: a.createdAt.toISOString(),
          plan: ent.plan,
          status: ent.status,
          trialEndsAt: ent.trialEndsAt,
          readOnly: ent.readOnly,
          people: usage.users,
          clients: usage.clients,
          aiDraftsThisMonth: usage.aiDrafts,
          whatsappThisMonth: usage.whatsappMessages,
          storageBytes: usage.storageBytes,
          lastActivityAt: last?.at.toISOString() ?? null,
          failedJobs,
        };
      }),
    );
  }

  /** Sets an agency's plan, or takes it off plans (every suite, no limits); the agency's own audit log records it. */
  async setSubscription(agencyId: string, input: z.input<typeof platformSubscriptionInput>, by: string | undefined) {
    const p = platformSubscriptionInput.parse(input);
    const settings = await this.settings.get();
    if (p.plan && !settings.plans.some((x) => x.key === p.plan))
      throw new BadRequestException({ message: "Choose one of the plans.", issues: [{ path: "plan", message: "Choose a plan" }] });
    // A day given here ends at midnight in India.
    const endOf = (d: string | null) => (d ? new Date(`${d}T23:59:59+05:30`) : null);
    const found = await asPlatform(this.prisma.client, async (tx) => {
      if (!(await tx.agency.findUnique({ where: { id: agencyId }, select: { id: true } }))) return false;
      if (!p.plan) await tx.subscription.deleteMany({ where: { agencyId } });
      else {
        const data = { planKey: p.plan, status: p.status, trialEndsAt: endOf(p.trialEndsAt), currentPeriodEnd: endOf(p.currentPeriodEnd), graceUntil: null };
        await tx.subscription.upsert({ where: { agencyId }, create: { agencyId, ...data }, update: data });
      }
      return true;
    });
    if (!found) throw new NotFoundException("No agency with that id.");
    await this.audit.recordFor(agencyId, by, {
      action: "update",
      entity: "subscription",
      entityId: agencyId,
      after: { plan: p.plan, status: p.plan ? p.status : null, byPlatform: true },
    });
    return (await this.agencies()).find((a) => a.id === agencyId)!;
  }
}
