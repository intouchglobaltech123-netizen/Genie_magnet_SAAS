import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import {
  allows,
  ATTENDANCE_STATUSES,
  type AttendanceCorrectionInput,
  type AttendanceCorrectionRow,
  type AttendanceMonth,
  type AttendanceSettings,
  type AttendanceSettingsInput,
  type AttendanceStatus,
  dayStatus,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { PayrollLock } from "../payroll/payroll-lock.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const DAY = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
export const DEFAULT_ATTENDANCE: AttendanceSettings = { workdayStart: "09:30", lateAfter: 15, halfDayBelow: 240, weeklyOffs: [0], holidays: [] };

/** Every date from one day to another, inclusive. */
export function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let t = utc(from).getTime(); t <= utc(to).getTime(); t += DAY) out.push(day(new Date(t)));
  return out;
}

/** A weekly off or holiday by the agency's rules, with the holiday's name. */
export function offDay(s: AttendanceSettings, date: string) {
  const holiday = s.holidays.find((h) => h.date === date);
  if (holiday) return { status: "holiday" as const, name: holiday.name };
  if (s.weeklyOffs.includes(utc(date).getUTCDay())) return { status: "weekly_off" as const, name: null };
  return null;
}

/**
 * Attendance (P5-07): each day of each person, from the agency's attendance export (imported through Import from
 * Excel), corrections HR approves, and approved leave — read by the agency's own rules for start time, lateness, half
 * days, weekly offs and holidays. People see their own; HR sees everyone's.
 */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly payrollLock: PayrollLock,
  ) {}

  async settings(): Promise<AttendanceSettings> {
    const s = await this.tenant.db.attendanceSettings.findUnique({ where: { agencyId: this.tenant.agencyId } });
    if (!s) return DEFAULT_ATTENDANCE;
    return {
      workdayStart: s.workdayStart,
      lateAfter: s.lateAfter,
      halfDayBelow: s.halfDayBelow,
      weeklyOffs: s.weeklyOffs,
      holidays: s.holidays as AttendanceSettings["holidays"],
    };
  }

  async updateSettings(input: AttendanceSettingsInput) {
    const before = await this.settings();
    const data = { ...input, holidays: input.holidays as Prisma.InputJsonValue };
    await this.tenant.tx(async (tx) => {
      await tx.attendanceSettings.upsert({ where: { agencyId: this.tenant.agencyId }, create: { agencyId: this.tenant.agencyId, ...data }, update: data });
      await this.audit.record(tx, { action: "update", entity: "attendance_settings", before: { ...before }, after: { ...input } });
    });
    return this.settings();
  }

  private all() {
    return allows(this.tenant.permissions, "hr", "view");
  }

  /**
   * The month for everyone (HR) or for the person themselves; `everyone` for payroll, whatever HR access the person
   * running it has. A working day with no record is absent when an import covers it (from its first day to its last)
   * and the person is on the attendance device (they have an employee code, or are in an export) and with the agency.
   */
  async month(month: string, everyone = this.all()): Promise<AttendanceMonth> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException("Give the month as YYYY-MM.");
    const start = utc(`${month}-01`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const last = day(new Date(end.getTime() - DAY));
    const mine = everyone ? {} : { userId: this.tenant.userId ?? "" };
    const [s, members, records, leaves, profiles, imports] = await Promise.all([
      this.settings(),
      this.tenant.db.membership.findMany({ where: { agencyId: this.tenant.agencyId, ...mine }, select: { user: { select: { id: true, name: true } } } }),
      this.tenant.db.attendanceRecord.findMany({ where: { date: { gte: start, lt: end }, ...mine } }),
      this.tenant.db.leaveRequest.findMany({
        where: { status: "approved", from: { lt: end }, to: { gte: start }, ...mine },
        select: { userId: true, from: true, to: true },
      }),
      this.tenant.db.employeeProfile.findMany({ select: { userId: true, employeeCode: true, joiningDate: true, exitDate: true } }),
      this.tenant.db.attendanceRecord.groupBy({
        by: ["importId"],
        where: { date: { gte: start, lt: end }, source: "import", importId: { not: null } },
        _min: { date: true },
        _max: { date: true },
      }),
    ]);
    const dates = datesBetween(`${month}-01`, last);
    const covers = imports.map((i) => [day(i._min.date!), day(i._max.date!)] as const);
    const covered = (d: string) => covers.some(([a, b]) => d >= a && d <= b);
    const yesterday = day(new Date(Date.now() - DAY));
    const offDays = dates.flatMap((d) => {
      const o = offDay(s, d);
      return o ? [{ date: d, name: o.name }] : [];
    });
    const people = members
      .map((m) => {
        const days: AttendanceMonth["people"][number]["days"] = {};
        const theirs = records.filter((r) => r.userId === m.user.id);
        for (const r of theirs) days[day(r.date)] = { status: r.status as AttendanceStatus, firstIn: r.firstIn, lastOut: r.lastOut, source: r.source };
        for (const l of leaves.filter((x) => x.userId === m.user.id))
          for (const d of datesBetween(day(l.from), day(l.to)))
            if (d.startsWith(month) && !days[d] && !offDay(s, d)) days[d] = { status: "leave", firstIn: null, lastOut: null, source: "leave" };
        // Absent: working days an import covers without a record, for people on the device (never today or later).
        const prof = profiles.find((p) => p.userId === m.user.id);
        const onDevice = !!prof?.employeeCode || theirs.some((r) => r.source === "import");
        const joined = prof?.joiningDate ? day(prof.joiningDate) : "";
        const left = prof?.exitDate ? day(prof.exitDate) : "9999";
        if (onDevice)
          for (const d of dates)
            if (covered(d) && d >= joined && d <= left && d <= yesterday && !days[d] && !offDay(s, d))
              days[d] = { status: "absent", firstIn: null, lastOut: null, source: "missing" };
        const totals = Object.fromEntries(ATTENDANCE_STATUSES.map((st) => [st, Object.values(days).filter((x) => x.status === st).length])) as Record<
          AttendanceStatus,
          number
        >;
        return { user: m.user, days, totals };
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
    return { month, offDays, people };
  }

  // ─── Corrections ────────────────────────────────────────────────────

  private async present(rows: Prisma.AttendanceCorrectionGetPayload<object>[]): Promise<AttendanceCorrectionRow[]> {
    const users = await this.tenant.db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, name: true } });
    return rows.map((r) => ({
      id: r.id,
      user: { id: r.userId, name: users.find((u) => u.id === r.userId)?.name ?? null },
      date: day(r.date),
      firstIn: r.firstIn,
      lastOut: r.lastOut,
      reason: r.reason,
      state: r.state as AttendanceCorrectionRow["state"],
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async corrections(state?: string) {
    const rows = await this.tenant.db.attendanceCorrection.findMany({
      where: { ...(state && { state }), ...(!this.all() && { userId: this.tenant.userId ?? "" }) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return this.present(rows);
  }

  /** A person asks for a day to be put right (a missed punch, a field shoot). */
  async requestCorrection(input: AttendanceCorrectionInput) {
    if (!this.tenant.userId) throw new ForbiddenException("Sign in first.");
    if (input.date > day(new Date()))
      throw new BadRequestException({ message: "Only a day that has come.", issues: [{ path: "date", message: "Not a future day" }] });
    const c = await this.tenant.tx(async (tx) => {
      const row = await tx.attendanceCorrection.create({
        data: {
          agencyId: this.tenant.agencyId,
          userId: this.tenant.userId!,
          date: utc(input.date),
          firstIn: input.firstIn ?? null,
          lastOut: input.lastOut ?? null,
          reason: input.reason,
        },
      });
      await this.notifications.notify(
        tx,
        { can: { area: "hr", level: "approve" } },
        { kind: "leave_to_approve", title: `Attendance correction for ${input.date}`, body: input.reason, link: "/app/attendance?tab=corrections" },
      );
      return row;
    });
    return (await this.present([c]))[0]!;
  }

  async decideCorrection(id: string, d: { approved: boolean; note?: string }) {
    const c = await this.tenant.db.attendanceCorrection.findFirst({ where: { id } });
    if (!c) throw new NotFoundException("No correction with that id.");
    if (c.state !== "pending") throw new ConflictException("It is already decided.");
    this.tenant.notOwnRequest(c.userId, "correction");
    if (d.approved) await this.payrollLock.assertOpen([day(c.date)], "its attendance");
    const s = await this.settings();
    await this.tenant.tx(async (tx) => {
      await tx.attendanceCorrection.update({
        where: { id },
        data: { state: d.approved ? "approved" : "rejected", decidedBy: this.tenant.userId, decidedAt: new Date(), note: d.note ?? null },
      });
      if (d.approved) {
        const { status, minutes } = dayStatus(s, c.firstIn, c.lastOut);
        const data = { firstIn: c.firstIn, lastOut: c.lastOut, minutes, status, source: "correction", note: c.reason };
        await tx.attendanceRecord.upsert({
          where: { agencyId_userId_date: { agencyId: this.tenant.agencyId, userId: c.userId, date: c.date } },
          create: { agencyId: this.tenant.agencyId, userId: c.userId, date: c.date, ...data },
          update: data,
        });
      }
      await this.audit.record(tx, {
        action: d.approved ? "approve" : "reject",
        entity: "attendance_correction",
        entityId: id,
        after: { date: day(c.date), note: d.note ?? null },
      });
      await this.notifications.notify(
        tx,
        { users: [c.userId] },
        { kind: "leave_decided", title: `Attendance for ${day(c.date)} ${d.approved ? "corrected" : "not changed"}`, body: d.note, link: "/app/attendance" },
      );
    });
    return (await this.corrections()).find((x) => x.id === id) ?? null;
  }
}
