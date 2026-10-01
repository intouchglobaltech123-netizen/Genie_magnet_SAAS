import { Injectable, NotFoundException } from "@nestjs/common";
import { type AgencyProfileInput, BUSINESS_STAGES, type BusinessStage } from "@gm/shared";
import { AuditService, changes } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const PROFILE = {
  id: true,
  name: true,
  slug: true,
  logo: true,
  brandColor: true,
  businessStage: true,
  phone: true,
  email: true,
  website: true,
  city: true,
  windowDays: true,
  reminderDays: true,
  languages: true,
  plan: true,
} as const;

type Stored = "struggle" | "survival" | "stability" | "success" | "scale";
const toLabel = (s: Stored | null) => (s ? (BUSINESS_STAGES.find((l) => l.toLowerCase() === s) ?? null) : null);
const toStored = (s: BusinessStage | null | undefined) => (s === undefined ? undefined : s === null ? null : (s.toLowerCase() as Stored));

/** The audit log notes that the logo changed, never the image itself. */
const forAudit = (v: Record<string, unknown>) => ("logo" in v ? { ...v, logo: v.logo ? "(new logo)" : "(no logo)" } : v);

/** Settings → Agency profile (P1-12): name, logo, colour, stage, contact details and onboarding defaults. */
@Injectable()
export class AgencyService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async get() {
    const agency = await this.tenant.db.agency.findUnique({ where: { id: this.tenant.agencyId }, select: PROFILE });
    if (!agency) throw new NotFoundException("Agency not found.");
    return { ...agency, businessStage: toLabel(agency.businessStage) };
  }

  async update(input: AgencyProfileInput) {
    const current = await this.get();
    const keys = Object.keys(input) as (keyof AgencyProfileInput)[];
    const before = Object.fromEntries(keys.map((k) => [k, current[k]]));
    const after = Object.fromEntries(keys.map((k) => [k, input[k]]));
    const diff = changes(before, after);
    if (!diff) return current;

    await this.tenant.tx(async (tx) => {
      await tx.agency.update({
        where: { id: this.tenant.agencyId },
        data: { ...input, businessStage: toStored(input.businessStage) },
      });
      await this.audit.record(tx, {
        action: "update",
        entity: "agency",
        entityId: this.tenant.agencyId,
        before: forAudit({ name: current.name, ...diff.before }),
        after: forAudit({ name: input.name ?? current.name, ...diff.after }),
      });
    });
    return this.get();
  }
}
