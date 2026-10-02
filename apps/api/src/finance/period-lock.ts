import { ConflictException, Injectable } from "@nestjs/common";
import { TenantDb } from "../tenancy/tenant-context.js";

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * A closed month's books stay as they were closed (P5-05): time and expenses dated in it cannot be added, changed or
 * removed until finance reopens it.
 */
@Injectable()
export class PeriodLock {
  constructor(private readonly tenant: TenantDb) {}

  async isClosed(month: string) {
    const p = await this.tenant.db.financialPeriod.findFirst({ where: { month: new Date(`${month}-01T00:00:00Z`), status: "closed" }, select: { id: true } });
    return !!p;
  }

  /** Refuses a change dated in a closed month. */
  async assertOpen(date: string | Date) {
    const month = (typeof date === "string" ? date : date.toISOString()).slice(0, 7);
    if (await this.isClosed(month)) throw new ConflictException(`${monthName(month)} is closed — finance reopens it before anything dated in it changes.`);
  }
}
