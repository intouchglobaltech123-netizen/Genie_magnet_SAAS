import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TenantTx } from "@gm/db";
import {
  type AgreementEnding,
  agreementEndDate,
  type AgreementInput,
  agreementMonths,
  type AgreementRenewal,
  type AgreementStatus,
  type AgreementUpdate,
  dayAfter,
  daysUntil,
  DEFAULT_RENEWAL_NOTICE_DAYS,
  type DeliverableInput,
  packageTotals,
} from "@gm/shared";
import { AuditService, changes } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const WITH = { client: { select: { id: true, name: true, code: true } }, package: { select: { name: true } } } as const satisfies Prisma.AgreementInclude;
type Row = Prisma.AgreementGetPayload<{ include: typeof WITH }>;

const day = (d: Date) => d.toISOString().slice(0, 10);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const today = () => new Date().toISOString().slice(0, 10);

/** Due for renewal used to be stored; it is now worked out from the end date. */
const statusOf = (s: string): AgreementStatus => (s === "renewal_due" ? "active" : (s as AgreementStatus));

/** What the audit log keeps of an agreement's terms. */
type Terms = Pick<
  Row,
  "title" | "packageId" | "startDate" | "endDate" | "monthlyFee" | "billing" | "revisionsPerDeliverable" | "shootDays" | "platforms" | "notes"
>;
const terms = (a: Terms & { deliverables: unknown }) => ({
  title: a.title,
  packageId: a.packageId,
  startDate: day(a.startDate),
  endDate: day(a.endDate),
  monthlyFee: a.monthlyFee,
  billing: a.billing,
  revisionsPerDeliverable: a.revisionsPerDeliverable,
  shootDays: a.shootDays,
  platforms: a.platforms,
  deliverables: a.deliverables,
  notes: a.notes,
});

export interface AgreementFilter {
  status?: string;
  clientId?: string;
  /** Only those due for renewal. */
  renewal?: boolean;
}

/**
 * Agreements (P1-19). Made as a draft from a package (its terms copied, so package edits never change a signed
 * agreement), signed off by someone who may approve agreements, then running, paused or ended. Renewing makes a new
 * draft that follows the old one. "Due for renewal" is worked out from the end date and the agency's notice period.
 */
@Injectable()
export class AgreementsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Days before the end that an agreement shows as due for renewal (Settings → Agency profile). */
  async notice() {
    const agency = await this.tenant.db.agency.findUnique({ where: { id: this.tenant.agencyId }, select: { renewalNoticeDays: true } });
    return agency?.renewalNoticeDays ?? DEFAULT_RENEWAL_NOTICE_DAYS;
  }

  isRenewalDue(endDate: Date, notice: number, on = today()) {
    return daysUntil(day(endDate), on) <= notice;
  }

  private async names(ids: (string | null)[]) {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (!wanted.length) return new Map<string, string>();
    const people = await this.tenant.db.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
    return new Map(people.map((p) => [p.id, p.name]));
  }

  private async present(rows: Row[]) {
    const [notice, names, renewals] = await Promise.all([
      this.notice(),
      this.names(rows.map((r) => r.signedBy)),
      rows.length
        ? this.tenant.db.agreement.findMany({ where: { renewsId: { in: rows.map((r) => r.id) } }, select: { id: true, renewsId: true } })
        : Promise.resolve([]),
    ]);
    const renewedBy = new Map(renewals.map((r) => [r.renewsId!, r.id]));
    const on = today();
    return rows.map((a) => {
      const status = statusOf(a.status);
      const startDate = day(a.startDate);
      const endDate = day(a.endDate);
      const deliverables = a.deliverables as unknown as DeliverableInput[];
      const renewedById = renewedBy.get(a.id) ?? null;
      const daysLeft = daysUntil(endDate, on);
      return {
        id: a.id,
        clientId: a.clientId,
        client: a.client,
        packageId: a.packageId,
        packageName: a.package?.name ?? null,
        title: a.title,
        status,
        startDate,
        endDate,
        months: agreementMonths(startDate, endDate),
        monthlyFee: a.monthlyFee,
        billing: a.billing,
        revisionsPerDeliverable: a.revisionsPerDeliverable,
        shootDays: a.shootDays,
        platforms: a.platforms,
        deliverables,
        ...packageTotals(deliverables),
        notes: a.notes,
        statusNote: a.statusNote,
        renewsId: a.renewsId,
        renewedById,
        signedBy: a.signedBy ? { id: a.signedBy, name: names.get(a.signedBy) ?? null } : null,
        signedAt: a.signedAt,
        createdAt: a.createdAt,
        daysLeft,
        /** Signed off, but its start date is still to come. */
        upcoming: status === "active" && startDate > on,
        /** Running, not renewed yet, and within the agency's notice period of its end (or past it). */
        renewalDue: status === "active" && !renewedById && daysLeft <= notice,
      };
    });
  }

  async list(f: AgreementFilter = {}) {
    const rows = await this.tenant.db.agreement.findMany({
      where: {
        ...(f.clientId && { clientId: f.clientId }),
        ...(f.status && { status: { in: f.status === "active" ? ["active", "renewal_due"] : [f.status as AgreementStatus] } }),
        ...(f.renewal && { status: { in: ["active", "renewal_due"] } }),
      },
      include: WITH,
      orderBy: [{ startDate: "desc" }],
      take: 1000,
    });
    const all = await this.present(rows);
    return f.renewal ? all.filter((a) => a.renewalDue).sort((a, b) => a.daysLeft - b.daysLeft) : all;
  }

  private async find(id: string) {
    const row = await this.tenant.db.agreement.findFirst({ where: { id }, include: WITH });
    if (!row) throw new NotFoundException("No agreement with that id.");
    return row;
  }

  async get(id: string) {
    return (await this.present([await this.find(id)]))[0]!;
  }

  /** A package can be chosen for a new agreement only while it is active. */
  private async package(packageId: string | undefined) {
    if (!packageId) return null;
    const pkg = await this.tenant.db.package.findFirst({ where: { id: packageId, active: true }, select: { id: true } });
    if (!pkg) throw new BadRequestException({ message: "Choose one of your active packages.", issues: [{ path: "packageId", message: "Choose a package" }] });
    return pkg;
  }

  private data(input: Omit<AgreementInput, "platforms"> & { platforms: string[] }) {
    return {
      packageId: input.packageId ?? null,
      title: input.title,
      startDate: utc(input.startDate),
      endDate: utc(agreementEndDate(input.startDate, input.months)),
      monthlyFee: input.monthlyFee,
      billing: input.billing,
      revisionsPerDeliverable: input.revisionsPerDeliverable,
      shootDays: input.shootDays,
      platforms: input.platforms,
      deliverables: input.deliverables as Prisma.InputJsonValue,
      notes: input.notes ?? null,
    };
  }

  private async insert(tx: TenantTx, clientId: string, data: ReturnType<AgreementsService["data"]>, extra: { renewsId?: string } = {}) {
    const a = await tx.agreement.create({
      data: { ...data, ...extra, agencyId: this.tenant.agencyId, clientId, status: "draft", createdBy: this.tenant.userId },
    });
    await this.audit.record(tx, { action: "create", entity: "agreement", entityId: a.id, after: { status: "draft", ...terms(a), ...extra } });
    await this.notifications.notify(
      tx,
      { can: { area: "agreements", level: "approve" } },
      {
        kind: "agreement_signoff",
        title: `Agreement to sign off: ${a.title}`,
        body: extra.renewsId ? "A renewal." : undefined,
        link: `/app/clients/${clientId}`,
      },
    );
    return a.id;
  }

  /** A new draft for a client. */
  async create(clientId: string, input: Omit<AgreementInput, "platforms"> & { platforms: string[] }) {
    const client = await this.tenant.db.client.findFirst({ where: { id: clientId }, select: { archivedAt: true } });
    if (!client) throw new NotFoundException("No client with that id.");
    if (client.archivedAt) throw new ConflictException("This client is archived — restore it first.");
    await this.package(input.packageId);
    const id = await this.tenant.tx((tx) => this.insert(tx, clientId, this.data(input)));
    return this.get(id);
  }

  /** Only a draft's terms change; a signed agreement changes by renewing it. */
  async update(id: string, input: AgreementUpdate) {
    const current = await this.find(id);
    if (current.status !== "draft") throw new ConflictException("A signed agreement keeps its terms — renew it to change them.");
    if (input.packageId && input.packageId !== current.packageId) await this.package(input.packageId);
    const start = input.startDate ?? day(current.startDate);
    const months = input.months ?? agreementMonths(day(current.startDate), day(current.endDate));
    const merged = this.data({
      packageId: input.packageId ?? current.packageId ?? undefined,
      title: input.title ?? current.title,
      startDate: start,
      months,
      monthlyFee: input.monthlyFee ?? current.monthlyFee,
      billing: input.billing ?? current.billing,
      revisionsPerDeliverable: input.revisionsPerDeliverable ?? current.revisionsPerDeliverable,
      shootDays: input.shootDays ?? current.shootDays,
      platforms: input.platforms ?? current.platforms,
      deliverables: input.deliverables ?? (current.deliverables as unknown as DeliverableInput[]),
      notes: input.notes === undefined ? (current.notes ?? undefined) : input.notes,
    });
    const diff = changes(terms(current), terms({ ...current, ...merged }));
    if (diff) {
      await this.tenant.tx(async (tx) => {
        await tx.agreement.update({ where: { id }, data: merged });
        await this.audit.record(tx, {
          action: "update",
          entity: "agreement",
          entityId: id,
          before: { title: current.title, ...diff.before },
          after: { title: merged.title, ...diff.after },
        });
      });
    }
    return this.get(id);
  }

  private async move(current: Row, status: AgreementStatus, action: string, extra: Prisma.AgreementUpdateInput = {}, note?: string | null) {
    await this.tenant.tx(async (tx) => {
      await tx.agreement.update({ where: { id: current.id }, data: { status, ...extra } });
      await this.audit.record(tx, {
        action,
        entity: "agreement",
        entityId: current.id,
        before: { title: current.title, status: statusOf(current.status) },
        after: { title: current.title, status, ...(note !== undefined && { note }), ...(extra.endDate instanceof Date && { endDate: day(extra.endDate) }) },
      });
    });
    return this.get(current.id);
  }

  /** Someone who may approve agreements signs off a draft; it is then running. */
  async signOff(id: string) {
    const current = await this.find(id);
    if (current.status !== "draft") throw new ConflictException("Only a draft is signed off.");
    const signed = await this.move(current, "active", "approve", { signedBy: this.tenant.userId, signedAt: new Date() });
    await this.tenant.tx((tx) =>
      this.notifications.notify(
        tx,
        { users: [current.createdBy] },
        { kind: "agreement_signed", title: `Signed off: ${current.title}`, link: `/app/clients/${current.clientId}` },
      ),
    );
    return signed;
  }

  async pause(id: string, note?: string) {
    const current = await this.find(id);
    if (statusOf(current.status) !== "active") throw new ConflictException("Only a running agreement can be paused.");
    return this.move(current, "paused", "pause", { statusNote: note ?? null }, note ?? null);
  }

  async resume(id: string) {
    const current = await this.find(id);
    if (current.status !== "paused") throw new ConflictException("Only a paused agreement can be resumed.");
    return this.move(current, "active", "resume", { statusNote: null });
  }

  /** Ends it: early on the date given (today when left out), or on its own end date if that comes first. */
  async end(id: string, input: AgreementEnding) {
    const current = await this.find(id);
    if (!["active", "renewal_due", "paused"].includes(current.status)) throw new ConflictException("Only a running or paused agreement can be ended.");
    const wanted = input.endDate ?? today();
    if (wanted < day(current.startDate))
      throw new BadRequestException({ message: "It cannot end before it starts.", issues: [{ path: "endDate", message: "On or after the start date" }] });
    const endDate = wanted < day(current.endDate) ? utc(wanted) : current.endDate;
    return this.move(current, "ended", "end", { statusNote: input.note, endDate }, input.note);
  }

  /** A new draft that follows this one, on the same terms unless the fee or length change. */
  async renew(id: string, input: AgreementRenewal) {
    const current = await this.find(id);
    if (current.status === "draft") throw new ConflictException("Sign off this draft first; a draft is changed, not renewed.");
    const existing = await this.tenant.db.agreement.findFirst({ where: { renewsId: id }, select: { id: true } });
    if (existing) throw new ConflictException("It is already renewed — open the renewal to change it.");
    const startDate = input.startDate ?? dayAfter(day(current.endDate));
    const data = this.data({
      packageId: current.packageId ?? undefined,
      title: current.title,
      startDate,
      months: input.months,
      monthlyFee: input.monthlyFee ?? current.monthlyFee,
      billing: current.billing,
      revisionsPerDeliverable: current.revisionsPerDeliverable,
      shootDays: current.shootDays,
      platforms: current.platforms,
      deliverables: current.deliverables as unknown as DeliverableInput[],
      notes: current.notes ?? undefined,
    });
    const newId = await this.tenant.tx((tx) => this.insert(tx, current.clientId, data, { renewsId: id }));
    return this.get(newId);
  }

  /** Only a draft can be deleted. */
  async remove(id: string) {
    const current = await this.find(id);
    if (current.status !== "draft") throw new ConflictException("Only a draft can be deleted; end a signed agreement instead.");
    await this.tenant.tx(async (tx) => {
      await tx.agreement.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "agreement", entityId: id, before: { status: "draft", ...terms(current) } });
    });
  }
}
