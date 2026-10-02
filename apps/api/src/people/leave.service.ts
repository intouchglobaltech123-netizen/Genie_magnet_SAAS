import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import {
  allows,
  DEFAULT_LEAVE_TYPES,
  type LeaveBalanceRow,
  type LeaveRequestInput,
  type LeaveRequestRow,
  type LeaveTypeRow,
  leaveRequestInput,
  leaveTypesInput,
} from "@gm/shared";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { AttendanceService, datesBetween, offDay } from "./attendance.service.js";

const day = (d: Date) => d.toISOString().slice(0, 10);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const WITH = { type: { select: { id: true, name: true, paid: true } } } as const satisfies Prisma.LeaveRequestInclude;
type Row = Prisma.LeaveRequestGetPayload<{ include: typeof WITH }>;

/**
 * Leave (P5-08): the agency's own kinds of leave and yearly allowances (unused days carry over up to a limit),
 * requests that HR approves — seeing first the shoots and due videos they clash with — and balances. Approved leave
 * shows on the attendance; unpaid leave is taken off pay.
 */
@Injectable()
export class LeaveService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly attendance: AttendanceService,
  ) {}

  private all() {
    return allows(this.tenant.permissions, "hr", "view");
  }

  // ─── Kinds of leave ─────────────────────────────────────────────────

  async types(): Promise<LeaveTypeRow[]> {
    let rows = await this.tenant.db.leaveType.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
    if (!rows.length) {
      // Every agency starts with the usual kinds, and changes them.
      await this.tenant.db.leaveType.createMany({
        data: DEFAULT_LEAVE_TYPES.map((t, i) => ({ ...t, agencyId: this.tenant.agencyId, position: i })),
        skipDuplicates: true,
      });
      rows = await this.tenant.db.leaveType.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
    }
    return rows.map((t) => ({ id: t.id, name: t.name, daysPerYear: t.daysPerYear, paid: t.paid, carryForward: t.carryForward, active: t.active }));
  }

  /** The full list: kinds left out are switched off (never deleted — requests use them). */
  async saveTypes(input: z.output<typeof leaveTypesInput>) {
    if (!allows(this.tenant.permissions, "hr", "edit")) throw new ForbiddenException("Kinds of leave are kept by HR.");
    const current = await this.types();
    await this.tenant.tx(async (tx) => {
      for (const [i, t] of input.types.entries()) {
        const data = { name: t.name, daysPerYear: t.daysPerYear, paid: t.paid, carryForward: t.carryForward, active: t.active, position: i };
        const existing = t.id ? current.find((c) => c.id === t.id) : current.find((c) => c.name.toLowerCase() === t.name.toLowerCase());
        if (existing) await tx.leaveType.update({ where: { id: existing.id }, data });
        else await tx.leaveType.create({ data: { ...data, agencyId: this.tenant.agencyId } });
      }
      const kept = new Set(input.types.map((t) => t.id).filter(Boolean));
      const named = new Set(input.types.map((t) => t.name.toLowerCase()));
      const off = current.filter((c) => !kept.has(c.id) && !named.has(c.name.toLowerCase())).map((c) => c.id);
      if (off.length) await tx.leaveType.updateMany({ where: { id: { in: off } }, data: { active: false } });
      await this.audit.record(tx, { action: "update", entity: "leave_types", after: { types: input.types.map((t) => `${t.name}: ${t.daysPerYear}`) } });
    });
    return this.types();
  }

  // ─── Requests ───────────────────────────────────────────────────────

  /** Working days a request takes, by the agency's weekly offs and holidays. */
  private async days(from: string, to: string, halfDay: boolean) {
    const s = await this.attendance.settings();
    const working = datesBetween(from, to).filter((d) => !offDay(s, d)).length;
    return halfDay ? working * 0.5 : working;
  }

  private async clashes(rows: Row[]) {
    if (!rows.length) return new Map<string, LeaveRequestRow["clashes"]>();
    const min = rows.reduce((m, r) => (r.from < m ? r.from : m), rows[0]!.from);
    const max = rows.reduce((m, r) => (r.to > m ? r.to : m), rows[0]!.to);
    const users = [...new Set(rows.map((r) => r.userId))];
    const [shoots, videos] = await Promise.all([
      this.tenant.db.shoot.findMany({
        where: { date: { gte: min, lte: max }, OR: [{ cameraId: { in: users } }, { directorId: { in: users } }] },
        select: { id: true, title: true, date: true, cameraId: true, directorId: true },
      }),
      this.tenant.db.video.findMany({
        where: { dueDate: { gte: min, lte: max }, editorId: { in: users }, stage: { notIn: ["approved", "published"] } },
        select: { id: true, code: true, title: true, dueDate: true, editorId: true },
      }),
    ]);
    return new Map(
      rows.map((r) => [
        r.id,
        [
          ...shoots
            .filter((s) => (s.cameraId === r.userId || s.directorId === r.userId) && s.date >= r.from && s.date <= r.to)
            .map((s) => ({ kind: "shoot" as const, label: s.title, date: day(s.date), link: `/app/shoots/${s.id}` })),
          ...videos
            .filter((v) => v.editorId === r.userId && v.dueDate! >= r.from && v.dueDate! <= r.to)
            .map((v) => ({ kind: "video" as const, label: `${v.code} due`, date: day(v.dueDate!), link: `/app/production/${v.id}` })),
        ],
      ]),
    );
  }

  private async present(rows: Row[]): Promise<LeaveRequestRow[]> {
    const ids = [...new Set(rows.flatMap((r) => [r.userId, r.decidedBy]).filter((x): x is string => !!x))];
    const [users, clashes] = await Promise.all([
      this.tenant.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
      this.clashes(rows),
    ]);
    const name = (id: string | null) => (id ? (users.find((u) => u.id === id)?.name ?? null) : null);
    return rows.map((r) => ({
      id: r.id,
      user: { id: r.userId, name: name(r.userId) },
      type: r.type,
      from: day(r.from),
      to: day(r.to),
      halfDay: r.halfDay,
      days: r.days,
      reason: r.reason,
      status: r.status as LeaveRequestRow["status"],
      note: r.note,
      decidedBy: name(r.decidedBy),
      clashes: clashes.get(r.id) ?? [],
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async list(f: { status?: string; mine?: boolean }) {
    const rows = await this.tenant.db.leaveRequest.findMany({
      where: { ...(f.status && { status: f.status }), ...((!this.all() || f.mine) && { userId: this.tenant.userId ?? "" }) },
      include: WITH,
      orderBy: { from: "desc" },
      take: 500,
    });
    return this.present(rows);
  }

  async request(raw: LeaveRequestInput) {
    if (!this.tenant.userId) throw new ForbiddenException("Sign in first.");
    const input = leaveRequestInput.parse(raw);
    const type = await this.tenant.db.leaveType.findFirst({ where: { id: input.typeId, active: true } });
    if (!type) throw new BadRequestException({ message: "Choose one of your kinds of leave.", issues: [{ path: "typeId", message: "Choose the kind" }] });
    const days = await this.days(input.from, input.to, input.halfDay);
    if (!days)
      throw new BadRequestException({ message: "Those days are weekly offs or holidays already.", issues: [{ path: "from", message: "No working days" }] });
    if (type.daysPerYear) {
      const [b] = await this.balances(Number(input.from.slice(0, 4)), this.tenant.userId);
      const left = b?.types.find((t) => t.id === type.id);
      if (left && left.left !== null && left.left - left.pending < days)
        throw new ConflictException(`Only ${left.left - left.pending} days of ${type.name} are left this year (with what waits for approval).`);
    }
    const overlap = await this.tenant.db.leaveRequest.findFirst({
      where: { userId: this.tenant.userId, status: { in: ["pending", "approved"] }, from: { lte: utc(input.to) }, to: { gte: utc(input.from) } },
    });
    if (overlap) throw new ConflictException("You already asked for leave on some of those days.");
    const r = await this.tenant.tx(async (tx) => {
      const row = await tx.leaveRequest.create({
        data: {
          agencyId: this.tenant.agencyId,
          userId: this.tenant.userId!,
          typeId: type.id,
          from: utc(input.from),
          to: utc(input.to),
          halfDay: input.halfDay,
          days,
          reason: input.reason,
        },
        include: WITH,
      });
      await this.audit.record(tx, { action: "create", entity: "leave", entityId: row.id, after: { type: type.name, from: input.from, to: input.to, days } });
      const me = await tx.user.findUnique({ where: { id: this.tenant.userId! }, select: { name: true } });
      await this.notifications.notify(
        tx,
        { can: { area: "hr", level: "approve" } },
        {
          kind: "leave_to_approve",
          title: `${me?.name ?? "Someone"} asks for ${days} ${days === 1 ? "day" : "days"} of ${type.name}`,
          body: input.reason,
          link: "/app/leave",
        },
      );
      return row;
    });
    return (await this.present([r]))[0]!;
  }

  async cancel(id: string) {
    const r = await this.tenant.db.leaveRequest.findFirst({ where: { id }, include: WITH });
    if (!r || r.userId !== this.tenant.userId) throw new NotFoundException("No leave request of yours with that id.");
    if (r.status !== "pending") throw new ConflictException("Only a request that waits is withdrawn; ask HR to change an approved one.");
    await this.tenant.db.leaveRequest.update({ where: { id }, data: { status: "cancelled" } });
    return (await this.list({ mine: true })).find((x) => x.id === id)!;
  }

  /** HR approves (the days show as leave on the attendance) or says no, with a reason. */
  async decide(id: string, d: { approved: boolean; note?: string }) {
    const r = await this.tenant.db.leaveRequest.findFirst({ where: { id }, include: WITH });
    if (!r) throw new NotFoundException("No leave request with that id.");
    if (r.status !== "pending") throw new ConflictException("It is already decided.");
    this.tenant.notOwnRequest(r.userId, "leave");
    const s = await this.attendance.settings();
    await this.tenant.tx(async (tx) => {
      await tx.leaveRequest.update({
        where: { id },
        data: { status: d.approved ? "approved" : "rejected", decidedBy: this.tenant.userId, decidedAt: new Date(), note: d.note ?? null },
      });
      if (d.approved)
        for (const date of datesBetween(day(r.from), day(r.to)).filter((x) => !offDay(s, x))) {
          const at = utc(date);
          const existing = await tx.attendanceRecord.findUnique({
            where: { agencyId_userId_date: { agencyId: this.tenant.agencyId, userId: r.userId, date: at } },
          });
          // A day they came in for stays as it was recorded.
          if (existing && existing.firstIn) continue;
          const data = { status: r.halfDay ? "half_day" : "leave", source: "leave", minutes: 0, firstIn: null, lastOut: null, note: r.type.name };
          await tx.attendanceRecord.upsert({
            where: { agencyId_userId_date: { agencyId: this.tenant.agencyId, userId: r.userId, date: at } },
            create: { agencyId: this.tenant.agencyId, userId: r.userId, date: at, ...data },
            update: data,
          });
        }
      await this.audit.record(tx, {
        action: d.approved ? "approve" : "reject",
        entity: "leave",
        entityId: id,
        after: { type: r.type.name, from: day(r.from), to: day(r.to), note: d.note ?? null },
      });
      await this.notifications.notify(
        tx,
        { users: [r.userId] },
        {
          kind: "leave_decided",
          title: `${r.type.name} ${day(r.from)}${r.to > r.from ? ` to ${day(r.to)}` : ""}: ${d.approved ? "approved" : "not approved"}`,
          body: d.note,
          link: "/app/leave",
        },
      );
    });
    return (await this.list({})).find((x) => x.id === id)!;
  }

  // ─── Balances ───────────────────────────────────────────────────────

  async balances(year: number, onlyUser?: string): Promise<LeaveBalanceRow[]> {
    const who = onlyUser ?? (this.all() ? undefined : (this.tenant.userId ?? ""));
    const [types, members, requests] = await Promise.all([
      this.types(),
      this.tenant.db.membership.findMany({
        where: { agencyId: this.tenant.agencyId, ...(who && { userId: who }) },
        select: { user: { select: { id: true, name: true } } },
      }),
      this.tenant.db.leaveRequest.findMany({
        where: { status: { in: ["approved", "pending"] }, from: { gte: utc(`${year - 1}-01-01`), lt: utc(`${year + 1}-01-01`) }, ...(who && { userId: who }) },
        select: { userId: true, typeId: true, from: true, days: true, status: true },
      }),
    ]);
    const sum = (userId: string, typeId: string, y: number, status: string) =>
      requests
        .filter((r) => r.userId === userId && r.typeId === typeId && r.status === status && r.from.getUTCFullYear() === y)
        .reduce((n, r) => n + r.days, 0);
    return members
      .map((m) => ({
        user: m.user,
        year,
        types: types
          .filter((t) => t.active)
          .map((t) => {
            const allowance = t.daysPerYear || null;
            const carried = allowance && t.carryForward ? Math.min(t.carryForward, Math.max(0, allowance - sum(m.user.id, t.id, year - 1, "approved"))) : 0;
            const taken = sum(m.user.id, t.id, year, "approved");
            return {
              id: t.id,
              name: t.name,
              allowance,
              carried,
              taken,
              pending: sum(m.user.id, t.id, year, "pending"),
              left: allowance === null ? null : allowance + carried - taken,
            };
          }),
      }))
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }
}
