import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TenantTx } from "@gm/db";
import {
  allows,
  DEFAULT_PAYROLL,
  type PayrollRunRow,
  type PayrollSettings,
  type PayrollSettingsInput,
  type PayslipBasis,
  type PayslipChange,
  type PayslipDays,
  type PayslipRow,
  payrollSettingsInput,
  payslipChange,
  rupeesInWords,
  type SalaryInput,
  type SalaryRow,
  salaryInput,
  workOutPayslip,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { Secrets } from "../common/secrets.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { AttendanceService, datesBetween, offDay } from "../people/attendance.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { monthName } from "./payroll-lock.js";

const day = (d: Date) => d.toISOString().slice(0, 10);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const lastDay = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return day(new Date(Date.UTC(y, m, 0)));
};
const total = (earnings: { amount: number }[]) => earnings.reduce((s, e) => s + e.amount, 0);
type Earnings = { name: string; amount: number }[];
type Person = {
  name: string;
  employeeCode: string | null;
  designation: string | null;
  department: string | null;
  bankHint: string | null;
  panHint: string | null;
  uan: string | null;
};
type Slip = Prisma.PayslipGetPayload<{ include: { run: { select: { month: true; status: true } } } }>;

/**
 * Payroll (P5-09): each person's salary in parts, the agency's own deductions, and the month's run — a draft worked out
 * from attendance and leave that payroll checks and adjusts, then locks. Locking hands each person their payslip and
 * keeps the month's attendance as it was paid. Amounts are seen only by those who may see salaries, and by each person
 * for their own payslips.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly attendance: AttendanceService,
    private readonly secrets: Secrets,
  ) {}

  // ─── Rules ──────────────────────────────────────────────────────────

  async settings(): Promise<PayrollSettings> {
    const s = await this.tenant.db.payrollSettings.findUnique({ where: { agencyId: this.tenant.agencyId } });
    if (!s) return DEFAULT_PAYROLL;
    return payrollSettingsInput.parse({ dayBasis: s.dayBasis, latesPerHalfDay: s.latesPerHalfDay, deductions: s.deductions });
  }

  async updateSettings(input: PayrollSettingsInput) {
    const s = payrollSettingsInput.parse(input);
    const data = { dayBasis: s.dayBasis, latesPerHalfDay: s.latesPerHalfDay, deductions: s.deductions as Prisma.InputJsonValue };
    await this.tenant.tx(async (tx) => {
      await tx.payrollSettings.upsert({ where: { agencyId: this.tenant.agencyId }, create: { agencyId: this.tenant.agencyId, ...data }, update: data });
      await this.audit.record(tx, {
        action: "update",
        entity: "payroll_settings",
        after: { dayBasis: s.dayBasis, latesPerHalfDay: s.latesPerHalfDay, deductions: s.deductions.map((d) => d.name) },
      });
    });
    return this.settings();
  }

  // ─── Salaries ───────────────────────────────────────────────────────

  async salaries(): Promise<SalaryRow[]> {
    const [members, rows, profiles] = await Promise.all([
      this.tenant.db.membership.findMany({ where: { agencyId: this.tenant.agencyId }, select: { user: { select: { id: true, name: true } } } }),
      this.tenant.db.salaryStructure.findMany({ orderBy: { from: "desc" } }),
      this.tenant.db.employeeProfile.findMany({ select: { userId: true, employeeCode: true } }),
    ]);
    const today = day(new Date());
    return members
      .map(({ user }) => {
        const theirs = rows.filter((r) => r.userId === user.id);
        const now = theirs.find((r) => day(r.from) <= today) ?? theirs.at(-1) ?? null;
        return {
          user,
          employeeCode: profiles.find((p) => p.userId === user.id)?.employeeCode ?? null,
          current: now && { id: now.id, from: day(now.from), earnings: now.earnings as Earnings, total: total(now.earnings as Earnings), note: now.note },
          history: theirs.map((r) => ({ id: r.id, from: day(r.from), total: total(r.earnings as Earnings) })),
        };
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }

  /** A salary from a day on; a second one on the same day replaces it. The audit log says it changed, never by how much. */
  async setSalary(userId: string, input: SalaryInput) {
    const s = salaryInput.parse(input);
    const member = await this.tenant.db.membership.findFirst({
      where: { agencyId: this.tenant.agencyId, userId },
      select: { user: { select: { name: true } } },
    });
    if (!member) throw new NotFoundException("No one in your team with that id.");
    const data = { earnings: s.earnings as Prisma.InputJsonValue, note: s.note ?? null, createdBy: this.tenant.userId ?? null };
    await this.tenant.tx(async (tx) => {
      await tx.salaryStructure.upsert({
        where: { agencyId_userId_from: { agencyId: this.tenant.agencyId, userId, from: utc(s.from) } },
        create: { agencyId: this.tenant.agencyId, userId, from: utc(s.from), ...data },
        update: data,
      });
      await this.audit.record(tx, { action: "update", entity: "salary", entityId: userId, after: { person: member.user.name, from: s.from } });
    });
    return (await this.salaries()).find((r) => r.user.id === userId)!;
  }

  async removeSalary(id: string) {
    const s = await this.tenant.db.salaryStructure.findFirst({ where: { id } });
    if (!s) throw new NotFoundException("No salary with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.salaryStructure.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "salary", entityId: s.userId, before: { from: day(s.from) } });
    });
    return { removed: true };
  }

  // ─── The month's run ────────────────────────────────────────────────

  async runs(): Promise<PayrollRunRow[]> {
    const runs = await this.tenant.db.payrollRun.findMany({ orderBy: { month: "desc" }, include: { payslips: true } });
    return Promise.all(runs.map((r) => this.presentRun(r, false)));
  }

  async run(month: string): Promise<PayrollRunRow> {
    const r = await this.tenant.db.payrollRun.findFirst({ where: { month }, include: { payslips: true } });
    if (!r) throw new NotFoundException(`No payroll for ${monthName(month)} yet.`);
    return this.presentRun(r, true);
  }

  /** Works out a draft for the month: everyone with a salary by its end, from their attendance and leave. */
  async start(month: string) {
    if (month > day(new Date()).slice(0, 7))
      throw new BadRequestException({ message: "Only a month that has begun.", issues: [{ path: "month", message: "Not a future month" }] });
    if (await this.tenant.db.payrollRun.findFirst({ where: { month }, select: { id: true } }))
      throw new ConflictException(`Payroll for ${monthName(month)} is already started.`);
    await this.tenant.tx(async (tx) => {
      const run = await tx.payrollRun.create({ data: { agencyId: this.tenant.agencyId, month, createdBy: this.tenant.userId ?? null } });
      await this.workOut(tx, run.id, month, new Map());
      await this.audit.record(tx, { action: "create", entity: "payroll", entityId: run.id, after: { month } });
    });
    return this.run(month);
  }

  /** Works the draft out again from the attendance and leave as they are now, keeping what payroll entered. */
  async refresh(month: string) {
    const run = await this.draft(month);
    const kept = new Map(run.payslips.map((p) => [p.userId, { adjustments: p.adjustments, entries: p.entries, extraLop: p.extraLop } as PayslipChange]));
    await this.tenant.tx((tx) => this.workOut(tx, run.id, month, kept));
    return this.run(month);
  }

  /** Bonus, reimbursement or recovery; amounts for deductions entered each month; extra days without pay. */
  async change(month: string, userId: string, input: PayslipChange) {
    const c = payslipChange.parse(input);
    const run = await this.draft(month);
    const slip = run.payslips.find((p) => p.userId === userId);
    if (!slip) throw new NotFoundException("This person has no payslip in this month's payroll.");
    const kept = new Map(run.payslips.map((p) => [p.userId, { adjustments: p.adjustments, entries: p.entries, extraLop: p.extraLop } as PayslipChange]));
    kept.set(userId, c);
    await this.tenant.tx(async (tx) => {
      await this.workOut(tx, run.id, month, kept, [userId]);
      await this.audit.record(tx, { action: "update", entity: "payslip", entityId: slip.id, after: { month, person: (slip.person as Person).name } });
    });
    return this.run(month);
  }

  /** Locks the month: each person's payslip becomes theirs to see, and the month's attendance stops changing. */
  async lock(month: string) {
    const run = await this.draft(month);
    const below = run.payslips.filter((p) => p.net < 0).map((p) => (p.person as Person).name);
    if (below.length) throw new ConflictException(`Net pay is below zero for ${below.join(", ")} — change their payslips first.`);
    if (!run.payslips.length) throw new ConflictException("There are no payslips to lock — set salaries first.");
    await this.tenant.tx(async (tx) => {
      await tx.payrollRun.update({ where: { id: run.id }, data: { status: "locked", lockedBy: this.tenant.userId ?? null, lockedAt: new Date() } });
      await this.audit.record(tx, { action: "approve", entity: "payroll", entityId: run.id, after: { month, people: run.payslips.length } });
      for (const p of run.payslips)
        await this.notifications.notify(
          tx,
          { users: [p.userId] },
          { kind: "payslip_ready", title: `Your payslip for ${monthName(month)} is ready`, link: `/app/payslips/${p.id}` },
        );
    });
    return this.run(month);
  }

  /** Unlocks a locked month, with the reason, to correct it. */
  async unlock(month: string, reason: string) {
    const run = await this.tenant.db.payrollRun.findFirst({ where: { month } });
    if (!run) throw new NotFoundException(`No payroll for ${monthName(month)} yet.`);
    if (run.status !== "locked") throw new ConflictException("It is not locked.");
    await this.tenant.tx(async (tx) => {
      await tx.payrollRun.update({ where: { id: run.id }, data: { status: "draft", lockedBy: null, lockedAt: null } });
      await this.audit.record(tx, { action: "reopen", entity: "payroll", entityId: run.id, after: { month, reason } });
    });
    return this.run(month);
  }

  async remove(month: string) {
    const run = await this.draft(month);
    await this.tenant.tx(async (tx) => {
      await tx.payrollRun.delete({ where: { id: run.id } });
      await this.audit.record(tx, { action: "delete", entity: "payroll", entityId: run.id, before: { month } });
    });
    return { removed: true };
  }

  /** The bank's transfer sheet for a locked month: each person's account, IFSC and net pay. */
  async bankSheet(month: string) {
    const run = await this.tenant.db.payrollRun.findFirst({ where: { month }, include: { payslips: true } });
    if (!run) throw new NotFoundException(`No payroll for ${monthName(month)} yet.`);
    if (run.status !== "locked") throw new ConflictException("Lock the month's payroll first.");
    const profiles = await this.tenant.db.employeeProfile.findMany({ where: { userId: { in: run.payslips.map((p) => p.userId) } } });
    const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const lines = [["Name", "Employee code", "Account number", "IFSC", "Net pay"].join(",")];
    const missing: string[] = [];
    for (const p of [...run.payslips].sort((a, b) => (a.person as Person).name.localeCompare((b.person as Person).name))) {
      const who = p.person as Person;
      const prof = profiles.find((x) => x.userId === p.userId);
      if (!prof?.bankAccount || !prof.ifsc) missing.push(who.name);
      lines.push(
        [who.name, who.employeeCode ?? "", prof?.bankAccount ? this.secrets.decrypt(prof.bankAccount) : "", prof?.ifsc ?? "", p.net].map(cell).join(","),
      );
    }
    await this.tenant.tx((tx) => this.audit.record(tx, { action: "export", entity: "payroll", entityId: run.id, after: { month, sheet: "bank transfer" } }));
    return { fileName: `salaries-${month}.csv`, csv: `${lines.join("\n")}\n`, missing };
  }

  // ─── Payslips ───────────────────────────────────────────────────────

  /** Each person's own payslips, once their month is locked. */
  async mine(): Promise<PayslipRow[]> {
    const rows = await this.tenant.db.payslip.findMany({
      where: { userId: this.tenant.userId ?? "", run: { status: "locked" } },
      include: { run: { select: { month: true, status: true } } },
      orderBy: { run: { month: "desc" } },
    });
    return rows.map((r) => this.presentSlip(r));
  }

  async payslip(id: string): Promise<PayslipRow> {
    const r = await this.tenant.db.payslip.findFirst({ where: { id }, include: { run: { select: { month: true, status: true } } } });
    const mine = r?.userId === this.tenant.userId && r?.run.status === "locked";
    if (!r || !(mine || allows(this.tenant.permissions, "salaries", "view"))) throw new NotFoundException("No payslip with that id.");
    const [agency, invoicing] = await Promise.all([
      this.tenant.db.agency.findUnique({ where: { id: this.tenant.agencyId }, select: { name: true, logo: true, brandColor: true } }),
      this.tenant.db.invoiceSettings.findUnique({ where: { agencyId: this.tenant.agencyId }, select: { legalName: true, address: true } }),
    ]);
    return {
      ...this.presentSlip(r),
      employer: {
        name: invoicing?.legalName ?? agency?.name ?? "",
        address: invoicing?.address ?? null,
        logo: agency?.logo ?? null,
        brandColor: agency?.brandColor ?? null,
      },
    };
  }

  // ─── Working it out ─────────────────────────────────────────────────

  private async draft(month: string) {
    const run = await this.tenant.db.payrollRun.findFirst({ where: { month }, include: { payslips: true } });
    if (!run) throw new NotFoundException(`No payroll for ${monthName(month)} yet.`);
    if (run.status !== "draft") throw new ConflictException(`Payroll for ${monthName(month)} is locked — unlock it to change it.`);
    return run;
  }

  /**
   * Works out each payslip of a draft (or only those of `only`), keeping what payroll entered on each. People with no
   * salary by the month's end are left out and named in the run's notes.
   */
  private async workOut(tx: TenantTx, runId: string, month: string, kept: Map<string, PayslipChange>, only?: string[]) {
    const from = `${month}-01`;
    const to = lastDay(month);
    const [settings, rules, attendance, members, salaries, profiles, departments, unpaid, paidLeave] = await Promise.all([
      this.settings(),
      this.attendance.settings(),
      this.attendance.month(month, true),
      tx.membership.findMany({ where: { agencyId: this.tenant.agencyId }, select: { user: { select: { id: true, name: true } } } }),
      tx.salaryStructure.findMany({ where: { from: { lte: utc(to) } }, orderBy: { from: "asc" } }),
      tx.employeeProfile.findMany(),
      tx.department.findMany({ select: { id: true, name: true } }),
      tx.leaveRequest.findMany({ where: { status: "approved", from: { lte: utc(to) }, to: { gte: utc(from) }, type: { paid: false } } }),
      tx.leaveRequest.findMany({ where: { status: "approved", from: { lte: utc(to) }, to: { gte: utc(from) }, type: { paid: true } } }),
    ]);
    const offDays = new Set(datesBetween(from, to).filter((d) => offDay(rules, d)));
    const leaveDays = (rows: typeof unpaid, userId: string) => {
      const out: Record<string, number> = {};
      for (const l of rows.filter((x) => x.userId === userId))
        for (const d of datesBetween(day(l.from), day(l.to))) if (d.startsWith(month) && !offDays.has(d)) out[d] = l.halfDay ? 0.5 : 1;
      return out;
    };
    const notes: string[] = [];
    const without: string[] = [];
    const slips: { userId: string; data: Omit<Prisma.PayslipUncheckedCreateInput, "agencyId" | "runId" | "userId"> }[] = [];
    for (const { user } of members) {
      const prof = profiles.find((p) => p.userId === user.id);
      const theirs = salaries.filter((s) => s.userId === user.id).map((s) => ({ from: day(s.from), earnings: s.earnings as Earnings }));
      const joined = prof?.joiningDate ? day(prof.joiningDate) : null;
      const left = prof?.exitDate ? day(prof.exitDate) : null;
      if (left && left < from) continue;
      if (!theirs.length) {
        without.push(user.name);
        continue;
      }
      // Each day's attendance; a day of approved paid leave is leave, whatever the punches say.
      const days = attendance.people.find((p) => p.user.id === user.id)?.days ?? {};
      const status: Record<string, string> = Object.fromEntries(Object.entries(days).map(([d, v]) => [d, v.source === "leave" ? "leave" : v.status]));
      for (const d of Object.keys(leaveDays(paidLeave, user.id))) status[d] = "leave";
      const change = payslipChange.parse(kept.get(user.id) ?? {});
      const basis: PayslipBasis = {
        month,
        settings,
        salaries: theirs,
        joined,
        left,
        offDays,
        attendance: status,
        unpaidLeave: leaveDays(unpaid, user.id),
        change: { adjustments: change.adjustments, entries: change.entries, extraLop: change.extraLop },
      };
      const w = workOutPayslip(basis);
      const person: Person = {
        name: user.name,
        employeeCode: prof?.employeeCode ?? null,
        designation: prof?.designation ?? null,
        department: departments.find((d) => d.id === prof?.departmentId)?.name ?? null,
        bankHint: prof?.bankHint ?? null,
        panHint: prof?.panHint ?? null,
        uan: prof?.uan ?? null,
      };
      slips.push({
        userId: user.id,
        data: {
          person,
          days: w.days as unknown as Prisma.InputJsonValue,
          earnings: w.earnings,
          deductions: w.deductions,
          contributions: w.contributions,
          adjustments: change.adjustments,
          entries: change.entries,
          extraLop: change.extraLop,
          gross: w.gross,
          totalDeductions: w.totalDeductions,
          net: w.net,
          employerCost: w.contributions.reduce((s, c) => s + c.amount, 0),
          notes: w.notes,
        },
      });
    }
    if (without.length) notes.push(`No salary set for ${without.join(", ")} — left out.`);
    const keep = slips.map((s) => s.userId);
    if (!only) await tx.payslip.deleteMany({ where: { runId, userId: { notIn: keep } } });
    for (const s of slips.filter((x) => !only || only.includes(x.userId)))
      await tx.payslip.upsert({
        where: { runId_userId: { runId, userId: s.userId } },
        create: { agencyId: this.tenant.agencyId, runId, userId: s.userId, ...s.data },
        update: s.data,
      });
    if (!only) await tx.payrollRun.update({ where: { id: runId }, data: { notes } });
  }

  private async presentRun(r: Prisma.PayrollRunGetPayload<{ include: { payslips: true } }>, withSlips: boolean): Promise<PayrollRunRow> {
    const sum = (k: "gross" | "totalDeductions" | "net" | "employerCost") => r.payslips.reduce((s, p) => s + p[k], 0);
    const lockedBy = r.lockedBy ? await this.tenant.db.user.findUnique({ where: { id: r.lockedBy }, select: { name: true } }) : null;
    return {
      id: r.id,
      month: r.month,
      status: r.status as PayrollRunRow["status"],
      people: r.payslips.length,
      gross: sum("gross"),
      deductions: sum("totalDeductions"),
      net: sum("net"),
      contributions: sum("employerCost"),
      lockedAt: r.lockedAt?.toISOString() ?? null,
      lockedBy: lockedBy?.name ?? null,
      notes: r.notes as string[],
      ...(withSlips && {
        payslips: r.payslips
          .map((p) => this.presentSlip({ ...p, run: { month: r.month, status: r.status } }))
          .sort((a, b) => a.user.name.localeCompare(b.user.name)),
      }),
    };
  }

  private presentSlip(p: Slip): PayslipRow {
    const who = p.person as Person;
    return {
      id: p.id,
      month: p.run.month,
      status: p.run.status as PayslipRow["status"],
      user: { id: p.userId, name: who.name },
      employeeCode: who.employeeCode,
      designation: who.designation,
      department: who.department,
      bankHint: who.bankHint,
      panHint: who.panHint,
      uan: who.uan,
      days: p.days as unknown as PayslipDays,
      earnings: p.earnings as PayslipRow["earnings"],
      deductions: p.deductions as PayslipRow["deductions"],
      contributions: p.contributions as PayslipRow["contributions"],
      adjustments: p.adjustments as PayslipRow["adjustments"],
      entries: p.entries as Record<string, number>,
      extraLop: p.extraLop,
      gross: p.gross,
      totalDeductions: p.totalDeductions,
      net: p.net,
      netInWords: rupeesInWords(Math.max(0, p.net)),
      notes: p.notes as string[],
    };
  }
}
