import { ForbiddenException, Injectable } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import { allows, DEFAULT_PRODUCTION_SETTINGS, type ProductionSettings } from "@gm/shared";
import { AuditService, changes } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

/** Settings → Production: the video code format and every checklist, starting from the Growth OS defaults. */
@Injectable()
export class ProductionSettingsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<ProductionSettings> {
    const s = await this.tenant.db.productionSettings.findUnique({ where: { agencyId: this.tenant.agencyId } });
    if (!s) return DEFAULT_PRODUCTION_SETTINGS;
    return {
      videoCodeFormat: s.videoCodeFormat,
      formats: s.formats as ProductionSettings["formats"],
      editSteps: s.editSteps as string[],
      qcChecks: s.qcChecks as ProductionSettings["qcChecks"],
      kits: s.kits as ProductionSettings["kits"],
      preShoot: s.preShoot as string[],
    };
  }

  /** Changing a checklist never changes what is already ticked on a video; the new list applies from now. */
  async save(input: ProductionSettings) {
    const p = this.tenant.permissions;
    if (!allows(p, "settings", "edit") && !allows(p, "production", "approve"))
      throw new ForbiddenException("Production settings are kept by people who may change agency settings or approve production.");
    const before = await this.get();
    const data = {
      videoCodeFormat: input.videoCodeFormat,
      formats: input.formats as Prisma.InputJsonValue,
      editSteps: input.editSteps as Prisma.InputJsonValue,
      qcChecks: input.qcChecks as Prisma.InputJsonValue,
      kits: input.kits as Prisma.InputJsonValue,
      preShoot: input.preShoot as Prisma.InputJsonValue,
    };
    await this.tenant.tx(async (tx) => {
      await tx.productionSettings.upsert({ where: { agencyId: this.tenant.agencyId }, create: { agencyId: this.tenant.agencyId, ...data }, update: data });
      const diff = changes(before as unknown as Record<string, unknown>, input as unknown as Record<string, unknown>);
      if (diff) await this.audit.record(tx, { action: "update", entity: "production_settings", before: diff.before, after: diff.after });
    });
    return this.get();
  }
}
