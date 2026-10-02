import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import {
  allows,
  type AssetCategory,
  type AssetCondition,
  type AssetDetail,
  type AssetInput,
  type AssetPerson,
  type AssetReservationRow,
  type AssetRow,
  type AssetShootRef,
  type AssetStatus,
  assetInput,
  type BackInServiceInput,
  backInServiceInput,
  bookValueOn,
  type CheckOutInput,
  checkOutInput,
  type MaintenanceInput,
  maintenanceInput,
  perHourCost,
  type ReservationInput,
  reservationInput,
  type ReturnInput,
  returnInput,
} from "@gm/shared";
import { AuditService, changes } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const IST = 330 * 60_000;
const today = () => new Date(Date.now() + IST).toISOString().slice(0, 10);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dayDate = (d: string) => new Date(`${d}T00:00:00Z`);

type Full = Prisma.AssetGetPayload<{ include: { custody: true; reservations: true; maintenance: true } }>;
type Lookups = { names: Map<string, string | null>; shoots: Map<string, AssetShootRef> };

/**
 * Equipment and assets (P5-20). Everyone who may use the equipment checks items out (for a shoot or a purpose) and
 * back, reserves them for a day, and reports problems; those who may approve keep the register, log repairs, put
 * items back in service and retire them. Movements and register changes are audited.
 */
@Injectable()
export class AssetsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  private me() {
    return this.tenant.userId ?? "";
  }

  private async lookups(people: (string | null | undefined)[], shootIds: (string | null | undefined)[]): Promise<Lookups> {
    const ids = [...new Set(people.filter((x): x is string => !!x))];
    const sids = [...new Set(shootIds.filter((x): x is string => !!x))];
    const [users, shoots] = await Promise.all([
      ids.length ? this.tenant.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [],
      sids.length
        ? this.tenant.db.shoot.findMany({ where: { id: { in: sids } }, select: { id: true, title: true, date: true, client: { select: { name: true } } } })
        : [],
    ]);
    return {
      names: new Map(users.map((u) => [u.id, u.name])),
      shoots: new Map(shoots.map((s) => [s.id, { id: s.id, title: s.title, date: iso(s.date), client: s.client.name }])),
    };
  }

  private person(l: Lookups, id: string): AssetPerson;
  private person(l: Lookups, id: string | null): AssetPerson | null;
  private person(l: Lookups, id: string | null) {
    return id ? { id, name: l.names.get(id) ?? null } : null;
  }

  private load(where: Prisma.AssetWhereInput) {
    return this.tenant.db.asset.findMany({
      where,
      include: {
        custody: { orderBy: { outAt: "desc" } },
        reservations: { where: { date: { gte: dayDate(today()) } }, orderBy: { date: "asc" } },
        maintenance: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      },
      orderBy: { tag: "asc" },
    });
  }

  private row(a: Full, l: Lookups): AssetRow {
    const t = today();
    const open = a.custody.find((c) => !c.returnedAt);
    const repair = a.maintenance.find((m) => m.outOfService && !m.closedAt);
    const next = a.reservations[0];
    const status: AssetStatus = a.retiredAt
      ? "retired"
      : repair
        ? "maintenance"
        : open
          ? open.kind === "assigned"
            ? "assigned"
            : "checked_out"
          : next && iso(next.date) === t
            ? "reserved"
            : "available";
    const dep = { purchaseDate: iso(a.purchaseDate), purchaseValue: a.purchaseValue, residualValue: a.residualValue, usefulLifeYears: a.usefulLifeYears };
    return {
      id: a.id,
      tag: a.tag,
      name: a.name,
      category: a.category as AssetCategory,
      serialNo: a.serialNo,
      ...dep,
      hoursPerYear: a.hoursPerYear,
      condition: a.condition as AssetCondition,
      location: a.location,
      notes: a.notes,
      status,
      out: open
        ? {
            id: open.id,
            kind: open.kind as "out" | "assigned",
            holder: this.person(l, open.userId),
            since: open.outAt.toISOString(),
            dueOn: open.dueOn ? iso(open.dueOn) : null,
            overdue: !!open.dueOn && iso(open.dueOn) < t,
            purpose: open.purpose,
            shoot: open.shootId ? (l.shoots.get(open.shootId) ?? null) : null,
          }
        : null,
      openRepair: repair ? { id: repair.id, title: repair.title, since: iso(repair.date) } : null,
      nextReservation: next ? { id: next.id, date: iso(next.date), for: this.person(l, next.userId), purpose: next.purpose } : null,
      hoursUsed: Math.round(a.custody.reduce((n, c) => n + (c.minutes ?? 0), 0) / 6) / 10,
      bookValue: bookValueOn(dep, t),
      perHour: perHourCost({ ...dep, hoursPerYear: a.hoursPerYear }),
      retiredAt: a.retiredAt?.toISOString() ?? null,
      retiredNote: a.retiredNote,
    };
  }

  private async rows(list: Full[]) {
    const l = await this.lookups(
      list.flatMap((a) => [...a.custody.map((c) => c.userId), ...a.reservations.map((r) => r.userId)]),
      list.flatMap((a) => a.custody.filter((c) => !c.returnedAt).map((c) => c.shootId)),
    );
    return list.map((a) => this.row(a, l));
  }

  async list(): Promise<AssetRow[]> {
    return this.rows(await this.load({}));
  }

  async get(id: string): Promise<AssetDetail> {
    const [a] = await this.load({ id });
    if (!a) throw new NotFoundException("That item is not in the register.");
    const l = await this.lookups(
      [
        ...a.custody.flatMap((c) => [c.userId, c.outBy, c.returnedTo]),
        ...a.reservations.flatMap((r) => [r.userId, r.createdBy]),
        ...a.maintenance.flatMap((m) => [m.closedBy, m.createdBy]),
      ],
      [...a.custody.map((c) => c.shootId), ...a.reservations.map((r) => r.shootId)],
    );
    const row = this.row(a, l);
    return {
      ...row,
      custody: a.custody.map((c) => ({
        id: c.id,
        kind: c.kind as "out" | "assigned",
        holder: this.person(l, c.userId),
        shoot: c.shootId ? (l.shoots.get(c.shootId) ?? null) : null,
        purpose: c.purpose,
        outAt: c.outAt.toISOString(),
        outBy: this.person(l, c.outBy),
        dueOn: c.dueOn ? iso(c.dueOn) : null,
        note: c.note,
        returnedAt: c.returnedAt?.toISOString() ?? null,
        returnedTo: this.person(l, c.returnedTo),
        returnCondition: (c.returnCondition as AssetCondition | null) ?? null,
        hours: c.minutes === null ? null : Math.round(c.minutes / 6) / 10,
        returnNote: c.returnNote,
      })),
      reservations: a.reservations.map((r) => this.reservationRow(r, a, l)),
      maintenance: a.maintenance.map((m) => ({
        id: m.id,
        date: iso(m.date),
        title: m.title,
        by: m.by,
        cost: m.cost,
        note: m.note,
        outOfService: m.outOfService,
        closedAt: m.closedAt?.toISOString() ?? null,
        closedBy: this.person(l, m.closedBy),
        closeCondition: (m.closeCondition as AssetCondition | null) ?? null,
        createdBy: this.person(l, m.createdBy),
      })),
      recovered: row.perHour === null ? null : Math.round(row.perHour * row.hoursUsed),
    };
  }

  private reservationRow(r: Prisma.AssetReservationGetPayload<object>, a: { id: string; tag: string; name: string }, l: Lookups): AssetReservationRow {
    return {
      id: r.id,
      asset: { id: a.id, tag: a.tag, name: a.name },
      date: iso(r.date),
      for: this.person(l, r.userId),
      shoot: r.shootId ? (l.shoots.get(r.shootId) ?? null) : null,
      purpose: r.purpose,
      location: r.location,
      createdBy: this.person(l, r.createdBy),
    };
  }

  /** Upcoming reservations of every item, soonest first. */
  async reservations(): Promise<AssetReservationRow[]> {
    const rows = await this.tenant.db.assetReservation.findMany({
      where: { date: { gte: dayDate(today()) } },
      include: { asset: { select: { id: true, tag: true, name: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      take: 200,
    });
    const l = await this.lookups(
      rows.flatMap((r) => [r.userId, r.createdBy]),
      rows.map((r) => r.shootId),
    );
    return rows.map((r) => this.reservationRow(r, r.asset, l));
  }

  /** The team, to choose who has an item or who it is reserved for (client people are not offered). */
  async people(): Promise<AssetPerson[]> {
    const [members, clientRoles] = await Promise.all([
      this.tenant.db.membership.findMany({ where: { agencyId: this.tenant.agencyId }, select: { role: true, user: { select: { id: true, name: true } } } }),
      this.tenant.db.role.findMany({ where: { isClient: true }, select: { key: true } }),
    ]);
    const clients = new Set(clientRoles.map((r) => r.key));
    return members
      .filter((m) => !clients.has(m.role))
      .map((m) => ({ id: m.user.id, name: m.user.name }))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }

  /** Shoots to check kit out or reserve it for: from a week ago to two months ahead, not closed. */
  async shoots(): Promise<AssetShootRef[]> {
    const t = dayDate(today());
    const rows = await this.tenant.db.shoot.findMany({
      where: { date: { gte: new Date(t.getTime() - 7 * 86_400_000), lte: new Date(t.getTime() + 60 * 86_400_000) }, status: { not: "closed" } },
      select: { id: true, title: true, date: true, client: { select: { name: true } } },
      orderBy: { date: "asc" },
    });
    return rows.map((s) => ({ id: s.id, title: s.title, date: iso(s.date), client: s.client.name }));
  }

  // ─── The register ───────────────────────────────────────────────────

  private async tagFree(tag: string, except?: string) {
    const taken = await this.tenant.db.asset.findFirst({ where: { tag: { equals: tag, mode: "insensitive" }, ...(except && { id: { not: except } }) } });
    if (taken)
      throw new ConflictException({ message: `${taken.tag} is already the tag of ${taken.name}.`, issues: [{ path: "tag", message: "This tag is taken" }] });
  }

  private data(a: ReturnType<typeof assetInput.parse>) {
    return { ...a, purchaseDate: dayDate(a.purchaseDate) };
  }

  async create(input: AssetInput) {
    const a = assetInput.parse(input);
    await this.tagFree(a.tag);
    const row = await this.tenant.tx(async (tx) => {
      const created = await tx.asset.create({ data: { agencyId: this.tenant.agencyId, ...this.data(a), createdBy: this.me() || null } });
      await this.audit.record(tx, {
        action: "create",
        entity: "asset",
        entityId: created.id,
        after: { tag: a.tag, name: a.name, purchaseValue: a.purchaseValue },
      });
      return created;
    });
    return this.get(row.id);
  }

  async update(id: string, input: AssetInput) {
    const a = assetInput.parse(input);
    const before = await this.tenant.db.asset.findFirst({ where: { id } });
    if (!before) throw new NotFoundException("That item is not in the register.");
    await this.tagFree(a.tag, id);
    const was = {
      tag: before.tag,
      name: before.name,
      category: before.category,
      purchaseDate: iso(before.purchaseDate),
      purchaseValue: before.purchaseValue,
      residualValue: before.residualValue,
      usefulLifeYears: before.usefulLifeYears,
      hoursPerYear: before.hoursPerYear,
      condition: before.condition,
    };
    const now = {
      tag: a.tag,
      name: a.name,
      category: a.category,
      purchaseDate: a.purchaseDate,
      purchaseValue: a.purchaseValue,
      residualValue: a.residualValue,
      usefulLifeYears: a.usefulLifeYears,
      hoursPerYear: a.hoursPerYear,
      condition: a.condition,
    };
    await this.tenant.tx(async (tx) => {
      await tx.asset.update({ where: { id }, data: this.data(a) });
      const diff = changes(was, now);
      if (diff) await this.audit.record(tx, { action: "update", entity: "asset", entityId: id, ...diff });
    });
    return this.get(id);
  }

  async retire(id: string, note: string) {
    const a = await this.current(id);
    if (a.out) throw new ConflictException(`${a.tag} is with ${a.out.holder.name ?? "someone"}. Take it back first.`);
    await this.tenant.tx(async (tx) => {
      await tx.asset.update({ where: { id }, data: { retiredAt: new Date(), retiredNote: note } });
      await tx.assetReservation.deleteMany({ where: { assetId: id } });
      await this.audit.record(tx, { action: "update", entity: "asset", entityId: id, after: { tag: a.tag, retired: true, note } });
    });
    return this.get(id);
  }

  private async current(id: string) {
    const [a] = await this.load({ id });
    if (!a) throw new NotFoundException("That item is not in the register.");
    return { ...(await this.rows([a]))[0]!, raw: a };
  }

  private async assertMember(userId: string) {
    if (!(await this.tenant.db.membership.count({ where: { agencyId: this.tenant.agencyId, userId } })))
      throw new BadRequestException({ message: "Choose someone in your team.", issues: [{ path: "userId", message: "Choose the person" }] });
  }

  private async shoot(shootId: string | null) {
    if (!shootId) return null;
    const s = await this.tenant.db.shoot.findFirst({ where: { id: shootId }, select: { id: true, title: true, date: true } });
    if (!s) throw new BadRequestException({ message: "Choose one of your shoots.", issues: [{ path: "shootId", message: "Choose the shoot" }] });
    return s;
  }

  // ─── Check-out and return ───────────────────────────────────────────

  async checkOut(id: string, input: CheckOutInput) {
    const c = checkOutInput.parse(input);
    const a = await this.current(id);
    if (a.status === "retired") throw new ConflictException(`${a.tag} is retired.`);
    if (a.openRepair) throw new ConflictException(`${a.tag} is out for repair: ${a.openRepair.title}.`);
    if (a.out) throw new ConflictException(`${a.tag} is already with ${a.out.holder.name ?? "someone"}.`);
    await this.assertMember(c.userId);
    const shoot = await this.shoot(c.shootId);
    const t = today();
    const booked = a.raw.reservations.find((r) => iso(r.date) === t);
    const mine = booked && (booked.userId === c.userId || (!!c.shootId && booked.shootId === c.shootId));
    if (booked && !mine) {
      const l = await this.lookups([booked.userId], []);
      throw new ConflictException(`${a.tag} is reserved today for ${l.names.get(booked.userId) ?? "someone"}: ${booked.purpose}.`);
    }
    await this.tenant.tx(async (tx) => {
      await tx.assetCustody.create({
        data: {
          agencyId: this.tenant.agencyId,
          assetId: id,
          kind: c.kind,
          userId: c.userId,
          shootId: shoot?.id ?? null,
          purpose: c.purpose || shoot?.title || "",
          dueOn: c.dueOn ? dayDate(c.dueOn) : c.kind === "out" && shoot ? shoot.date : null,
          note: c.note,
          outBy: this.me() || null,
        },
      });
      // The reservation it was booked under is used.
      if (booked) await tx.assetReservation.delete({ where: { id: booked.id } });
      await this.audit.record(tx, {
        action: "update",
        entity: "asset",
        entityId: id,
        after: { tag: a.tag, [c.kind === "assigned" ? "assignedTo" : "checkedOutTo"]: c.userId },
      });
    });
    return this.get(id);
  }

  async giveBack(id: string, input: ReturnInput) {
    const r = returnInput.parse(input);
    const a = await this.current(id);
    if (!a.out) throw new ConflictException(`${a.tag} is not checked out.`);
    const holder = a.out.holder;
    await this.tenant.tx(async (tx) => {
      await tx.assetCustody.update({
        where: { id: a.out!.id },
        data: {
          returnedAt: new Date(),
          returnedTo: this.me() || null,
          returnCondition: r.condition,
          minutes: r.hours === null ? null : Math.round(r.hours * 60),
          returnNote: r.note,
        },
      });
      await tx.asset.update({ where: { id }, data: { condition: r.condition } });
      // Something wrong with it takes it out of service until it is repaired.
      if (r.condition === "Needs repair")
        await tx.assetMaintenance.create({
          data: {
            agencyId: this.tenant.agencyId,
            assetId: id,
            date: dayDate(today()),
            title: `Reported on return: ${r.note}`.slice(0, 160),
            by: holder.name ?? "",
            note: r.note,
            outOfService: true,
            createdBy: this.me() || null,
          },
        });
      await this.audit.record(tx, { action: "update", entity: "asset", entityId: id, after: { tag: a.tag, returnedBy: holder.id, condition: r.condition } });
    });
    return this.get(id);
  }

  // ─── Reservations ───────────────────────────────────────────────────

  async reserve(id: string, input: ReservationInput) {
    const r = reservationInput.parse(input);
    if (r.date < today())
      throw new BadRequestException({ message: "Reserve it for today or a later day.", issues: [{ path: "date", message: "Not a past day" }] });
    const a = await this.current(id);
    if (a.status === "retired") throw new ConflictException(`${a.tag} is retired.`);
    if (a.out?.kind === "assigned") throw new ConflictException(`${a.tag} is assigned to ${a.out.holder.name ?? "someone"}.`);
    await this.assertMember(r.userId);
    await this.shoot(r.shootId);
    const clash = a.raw.reservations.find((x) => iso(x.date) === r.date);
    if (clash) {
      const l = await this.lookups([clash.userId], []);
      const alt = await this.alternative(a.raw, r.date);
      throw new ConflictException(
        `${a.tag} is already reserved on that day for ${l.names.get(clash.userId) ?? "someone"}: ${clash.purpose}.` +
          (alt ? ` ${alt.tag} ${alt.name} is free that day.` : ""),
      );
    }
    await this.tenant.db.assetReservation.create({
      data: {
        agencyId: this.tenant.agencyId,
        assetId: id,
        date: dayDate(r.date),
        userId: r.userId,
        shootId: r.shootId,
        purpose: r.purpose || (await this.shoot(r.shootId))?.title || "",
        location: r.location,
        createdBy: this.me() || null,
      },
    });
    return this.get(id);
  }

  /** Another item of the same kind that is in service and free on the day. */
  private async alternative(a: Full, date: string) {
    return this.tenant.db.asset.findFirst({
      where: {
        id: { not: a.id },
        category: a.category,
        retiredAt: null,
        reservations: { none: { date: dayDate(date) } },
        maintenance: { none: { outOfService: true, closedAt: null } },
        custody: { none: { kind: "assigned", returnedAt: null } },
      },
      orderBy: { tag: "asc" },
      select: { tag: true, name: true },
    });
  }

  async cancelReservation(reservationId: string) {
    const r = await this.tenant.db.assetReservation.findFirst({ where: { id: reservationId } });
    if (!r) throw new NotFoundException("That reservation is not there any more.");
    const me = this.me();
    if (r.userId !== me && r.createdBy !== me && !allows(this.tenant.permissions, "equipment", "approve"))
      throw new ForbiddenException("Only the person it is for, whoever made it, or someone who keeps the register can cancel it.");
    await this.tenant.db.assetReservation.delete({ where: { id: reservationId } });
    return this.get(r.assetId);
  }

  // ─── Problems and repairs ───────────────────────────────────────────

  async reportProblem(id: string, note: string) {
    const a = await this.current(id);
    if (a.status === "retired") throw new ConflictException(`${a.tag} is retired.`);
    if (a.openRepair) throw new ConflictException(`${a.tag} is already out for repair: ${a.openRepair.title}.`);
    const l = await this.lookups([this.me()], []);
    await this.tenant.tx(async (tx) => {
      await tx.assetMaintenance.create({
        data: {
          agencyId: this.tenant.agencyId,
          assetId: id,
          date: dayDate(today()),
          title: `Problem reported: ${note}`.slice(0, 160),
          by: l.names.get(this.me()) ?? "",
          note,
          outOfService: true,
          createdBy: this.me() || null,
        },
      });
      await tx.asset.update({ where: { id }, data: { condition: "Needs repair" } });
      await this.audit.record(tx, { action: "update", entity: "asset", entityId: id, after: { tag: a.tag, problem: note } });
    });
    return this.get(id);
  }

  async addMaintenance(id: string, input: MaintenanceInput) {
    const m = maintenanceInput.parse(input);
    const a = await this.current(id);
    if (m.outOfService) {
      if (a.openRepair) throw new ConflictException(`${a.tag} is already out for repair: ${a.openRepair.title}.`);
      if (a.out?.kind === "out") throw new ConflictException(`${a.tag} is with ${a.out.holder.name ?? "someone"}. Take it back first.`);
    }
    await this.tenant.tx(async (tx) => {
      await tx.assetMaintenance.create({ data: { agencyId: this.tenant.agencyId, assetId: id, ...m, date: dayDate(m.date), createdBy: this.me() || null } });
      await this.audit.record(tx, { action: "update", entity: "asset", entityId: id, after: { tag: a.tag, maintenance: m.title, cost: m.cost } });
    });
    return this.get(id);
  }

  async backInService(maintenanceId: string, input: BackInServiceInput) {
    const b = backInServiceInput.parse(input);
    const m = await this.tenant.db.assetMaintenance.findFirst({ where: { id: maintenanceId } });
    if (!m) throw new NotFoundException("That repair is not there any more.");
    if (!m.outOfService || m.closedAt) throw new ConflictException("That item is not out for repair.");
    await this.tenant.tx(async (tx) => {
      await tx.assetMaintenance.update({
        where: { id: maintenanceId },
        data: {
          closedAt: new Date(),
          closedBy: this.me() || null,
          closeCondition: b.condition,
          ...(b.cost !== null && { cost: b.cost }),
          ...(b.note && { note: m.note ? `${m.note}\n${b.note}` : b.note }),
        },
      });
      await tx.asset.update({ where: { id: m.assetId }, data: { condition: b.condition } });
      await this.audit.record(tx, {
        action: "update",
        entity: "asset",
        entityId: m.assetId,
        after: { backInService: true, condition: b.condition, cost: b.cost },
      });
    });
    return this.get(m.assetId);
  }
}
