import { ConflictException, Injectable } from "@nestjs/common";
import { TenantDb } from "../tenancy/tenant-context.js";

export const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * A month whose payroll is locked keeps the attendance it was paid on (P5-09): imports, corrections and leave dated
 * in it are refused until payroll unlocks it.
 */
@Injectable()
export class PayrollLock {
  constructor(private readonly tenant: TenantDb) {}

  /** Refuses a change to attendance on these days (YYYY-MM-DD) when a month they fall in is locked. */
  async assertOpen(days: string[], what: string) {
    const months = [...new Set(days.map((d) => d.slice(0, 7)))];
    if (!months.length) return;
    const locked = await this.tenant.db.payrollRun.findFirst({
      where: { month: { in: months }, status: "locked" },
      select: { month: true },
      orderBy: { month: "asc" },
    });
    if (locked) throw new ConflictException(`Payroll for ${monthName(locked.month)} is locked — unlock it before ${what} changes.`);
  }
}
