import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@gm/db";
import { allows, type EmployeeBankInput, type EmployeeInput, type EmployeeRow, type EmploymentType, employeeBankInput, employeeInput } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { Secrets } from "../common/secrets.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const utc = (d: string | null | undefined) => (d ? new Date(`${d}T00:00:00Z`) : null);

/**
 * Employee records (P5-06): one per team member, kept by HR. Bank account and PAN are encrypted and seen (as their
 * last characters) only by people who may see payroll, and by the person themselves. Departments are the agency's own.
 */
@Injectable()
export class EmployeesService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly secrets: Secrets,
  ) {}

  private hr(level: "view" | "edit") {
    return allows(this.tenant.permissions, "hr", level);
  }

  async list(): Promise<EmployeeRow[]> {
    const all = this.hr("view");
    const [members, profiles, departments] = await Promise.all([
      this.tenant.db.membership.findMany({
        where: { agencyId: this.tenant.agencyId, ...(!all && { userId: this.tenant.userId ?? "" }) },
        select: { role: true, user: { select: { id: true, name: true, email: true } } },
      }),
      this.tenant.db.employeeProfile.findMany(),
      this.tenant.db.department.findMany(),
    ]);
    const payroll = allows(this.tenant.permissions, "salaries", "view");
    const managerIds = [...new Set(profiles.map((p) => p.managerId).filter((x): x is string => !!x))];
    const names = new Map(
      (managerIds.length ? await this.tenant.db.user.findMany({ where: { id: { in: managerIds } }, select: { id: true, name: true } }) : []).map((u) => [
        u.id,
        u.name,
      ]),
    );
    return members
      .map((m) => {
        const p = profiles.find((x) => x.userId === m.user.id);
        const dep = p?.departmentId ? departments.find((d) => d.id === p.departmentId) : null;
        const ownOrPayroll = payroll || m.user.id === this.tenant.userId;
        return {
          user: m.user,
          role: m.role,
          employeeCode: p?.employeeCode ?? null,
          department: dep ? { id: dep.id, name: dep.name } : null,
          designation: p?.designation ?? null,
          employmentType: (p?.employmentType ?? "full_time") as EmploymentType,
          joiningDate: day(p?.joiningDate ?? null),
          exitDate: day(p?.exitDate ?? null),
          phone: p?.phone ?? null,
          personalEmail: p?.personalEmail ?? null,
          dateOfBirth: day(p?.dateOfBirth ?? null),
          address: p?.address ?? null,
          emergencyName: p?.emergencyName ?? null,
          emergencyPhone: p?.emergencyPhone ?? null,
          manager: p?.managerId ? { id: p.managerId, name: names.get(p.managerId) ?? "" } : null,
          kraTemplateId: p?.kraTemplateId ?? null,
          sheetTemplateId: p?.sheetTemplateId ?? null,
          bank: ownOrPayroll
            ? { account: p?.bankHint ?? null, ifsc: p?.ifsc ?? null, pan: p?.panHint ?? null, uan: p?.uan ?? null, esiNumber: p?.esiNumber ?? null }
            : null,
        };
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }

  async get(userId: string) {
    const row = (await this.list()).find((r) => r.user.id === userId);
    if (!row) throw new NotFoundException("No one in this agency with that id.");
    return row;
  }

  private async member(userId: string) {
    const m = await this.tenant.db.membership.findFirst({ where: { agencyId: this.tenant.agencyId, userId }, select: { user: { select: { name: true } } } });
    if (!m) throw new NotFoundException("No one in this agency with that id.");
    return m;
  }

  async update(userId: string, raw: EmployeeInput) {
    if (!this.hr("edit")) throw new ForbiddenException("Employee records are kept by HR.");
    const m = await this.member(userId);
    const input = employeeInput.parse(raw);
    if (input.departmentId && !(await this.tenant.db.department.findFirst({ where: { id: input.departmentId }, select: { id: true } })))
      throw new BadRequestException({ message: "Choose one of your departments.", issues: [{ path: "departmentId", message: "Choose the department" }] });
    if (input.managerId === userId)
      throw new BadRequestException({ message: "Someone else is their manager.", issues: [{ path: "managerId", message: "Not themselves" }] });
    if (
      input.managerId &&
      !(await this.tenant.db.membership.findFirst({ where: { agencyId: this.tenant.agencyId, userId: input.managerId }, select: { id: true } }))
    )
      throw new BadRequestException({ message: "Choose someone in your team.", issues: [{ path: "managerId", message: "Choose their manager" }] });
    if (input.sheetTemplateId && !(await this.tenant.db.sheetTemplate.findFirst({ where: { id: input.sheetTemplateId }, select: { id: true } })))
      throw new BadRequestException({ message: "Choose one of your daily sheets.", issues: [{ path: "sheetTemplateId", message: "Choose the sheet" }] });
    if (input.kraTemplateId && !(await this.tenant.db.kraTemplate.findFirst({ where: { id: input.kraTemplateId }, select: { id: true } })))
      throw new BadRequestException({ message: "Choose one of your KRA templates.", issues: [{ path: "kraTemplateId", message: "Choose the KRAs" }] });
    const data = {
      employeeCode: input.employeeCode ?? null,
      departmentId: input.departmentId ?? null,
      designation: input.designation ?? null,
      employmentType: input.employmentType,
      joiningDate: utc(input.joiningDate),
      exitDate: utc(input.exitDate),
      phone: input.phone ?? null,
      personalEmail: input.personalEmail ?? null,
      dateOfBirth: utc(input.dateOfBirth),
      address: input.address ?? null,
      emergencyName: input.emergencyName ?? null,
      emergencyPhone: input.emergencyPhone ?? null,
      ...(input.managerId !== undefined && { managerId: input.managerId }),
      ...(input.kraTemplateId !== undefined && { kraTemplateId: input.kraTemplateId }),
      ...(input.sheetTemplateId !== undefined && { sheetTemplateId: input.sheetTemplateId }),
    };
    try {
      await this.tenant.tx(async (tx) => {
        await tx.employeeProfile.upsert({
          where: { agencyId_userId: { agencyId: this.tenant.agencyId, userId } },
          create: { agencyId: this.tenant.agencyId, userId, ...data },
          update: data,
        });
        await this.audit.record(tx, {
          action: "update",
          entity: "employee",
          entityId: userId,
          after: { name: m.user.name, code: data.employeeCode, designation: data.designation },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new ConflictException({ message: "Someone else has that employee code.", issues: [{ path: "employeeCode", message: "Already used" }] });
      throw e;
    }
    return this.get(userId);
  }

  /** Bank account and PAN: payroll changes them; the audit log records that they changed, never the numbers. */
  async updateBank(userId: string, raw: EmployeeBankInput) {
    if (!allows(this.tenant.permissions, "salaries", "edit")) throw new ForbiddenException("Bank details are kept by payroll.");
    const m = await this.member(userId);
    const input = employeeBankInput.parse(raw);
    const data = {
      ...(input.bankAccount !== undefined && {
        bankAccount: input.bankAccount ? this.secrets.encrypt(input.bankAccount) : null,
        bankHint: input.bankAccount ? `…${input.bankAccount.slice(-4)}` : null,
      }),
      ...(input.ifsc !== undefined && { ifsc: input.ifsc || null }),
      ...(input.pan !== undefined && { pan: input.pan ? this.secrets.encrypt(input.pan) : null, panHint: input.pan ? `…${input.pan.slice(-4)}` : null }),
      ...(input.uan !== undefined && { uan: input.uan ?? null }),
      ...(input.esiNumber !== undefined && { esiNumber: input.esiNumber ?? null }),
    };
    await this.tenant.tx(async (tx) => {
      await tx.employeeProfile.upsert({
        where: { agencyId_userId: { agencyId: this.tenant.agencyId, userId } },
        create: { agencyId: this.tenant.agencyId, userId, ...data },
        update: data,
      });
      await this.audit.record(tx, { action: "update", entity: "employee_bank", entityId: userId, after: { name: m.user.name, changed: Object.keys(data) } });
    });
    return this.get(userId);
  }

  // ─── Departments ────────────────────────────────────────────────────

  async departments() {
    const [rows, counts] = await Promise.all([
      this.tenant.db.department.findMany({ orderBy: { name: "asc" } }),
      this.tenant.db.employeeProfile.groupBy({ by: ["departmentId"], _count: { _all: true } }),
    ]);
    return rows.map((d) => ({ id: d.id, name: d.name, headId: d.headId, people: counts.find((c) => c.departmentId === d.id)?._count._all ?? 0 }));
  }

  async addDepartment(input: { name: string; headId?: string | null }) {
    if (!this.hr("edit")) throw new ForbiddenException("Departments are kept by HR.");
    try {
      await this.tenant.tx(async (tx) => {
        const d = await tx.department.create({ data: { agencyId: this.tenant.agencyId, name: input.name, headId: input.headId ?? null } });
        await this.audit.record(tx, { action: "create", entity: "department", entityId: d.id, after: { name: d.name } });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new ConflictException({ message: "There is already a department with that name.", issues: [{ path: "name", message: "Already there" }] });
      throw e;
    }
    return this.departments();
  }

  async removeDepartment(id: string) {
    if (!this.hr("edit")) throw new ForbiddenException("Departments are kept by HR.");
    const d = await this.tenant.db.department.findFirst({ where: { id } });
    if (!d) throw new NotFoundException("No department with that id.");
    if (await this.tenant.db.employeeProfile.count({ where: { departmentId: id } }))
      throw new ConflictException("Move its people to another department first.");
    await this.tenant.tx(async (tx) => {
      await tx.department.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "department", entityId: id, before: { name: d.name } });
    });
    return this.departments();
  }
}
