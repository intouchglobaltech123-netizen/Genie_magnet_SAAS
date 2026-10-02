import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@gm/db";
import { allows, type ExpenseCategory, type ExpenseInput, type ExpenseRow, type ExpenseStatus, expenseInput } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { PeriodLock } from "./period-lock.js";

const day = (d: Date) => d.toISOString().slice(0, 10);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const WITH = { vendor: { select: { id: true, name: true } } } as const satisfies Prisma.ExpenseInclude;
type Row = Prisma.ExpenseGetPayload<{ include: typeof WITH }>;

/**
 * Expenses (P5-02): anyone in the team submits what they spent, with the receipt; finance approves or rejects it; each
 * is allocated to a video, to a client (shared across its videos that month) or to overheads. People without finance
 * access see and change only their own, and only while they wait.
 */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly lock: PeriodLock,
  ) {}

  private all() {
    return allows(this.tenant.permissions, "finance", "view");
  }

  private async present(rows: Row[]): Promise<ExpenseRow[]> {
    const ids = (k: "videoId" | "clientId") => [...new Set(rows.map((r) => r[k]).filter((x): x is string => !!x))];
    const people = [...new Set(rows.flatMap((r) => [r.submittedBy, r.decidedBy]).filter((x): x is string => !!x))];
    const [videos, clients, users, receipts] = await Promise.all([
      this.tenant.db.video.findMany({ where: { id: { in: ids("videoId") } }, select: { id: true, code: true, title: true } }),
      this.tenant.db.client.findMany({ where: { id: { in: ids("clientId") } }, select: { id: true, name: true } }),
      this.tenant.db.user.findMany({ where: { id: { in: people } }, select: { id: true, name: true } }),
      this.tenant.db.fileObject.groupBy({
        by: ["entityId"],
        where: { entity: "expense", entityId: { in: rows.map((r) => r.id) }, status: "ready" },
        _count: { _all: true },
      }),
    ]);
    const who = (id: string | null) => (id ? { id, name: users.find((u) => u.id === id)?.name ?? null } : null);
    return rows.map((r) => ({
      id: r.id,
      date: day(r.date),
      vendor: r.vendor,
      category: r.category as ExpenseCategory,
      description: r.description,
      amount: r.amount,
      gst: r.gst,
      status: r.status as ExpenseStatus,
      video: videos.find((v) => v.id === r.videoId) ?? null,
      client: clients.find((c) => c.id === r.clientId) ?? null,
      submittedBy: who(r.submittedBy),
      decidedBy: who(r.decidedBy),
      decisionNote: r.decisionNote,
      receipts: receipts.find((x) => x.entityId === r.id)?._count._all ?? 0,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** `status`, `month` (YYYY-MM), `mine`: finance sees everyone's, others only their own. */
  async list(f: { status?: string; month?: string; mine?: boolean }) {
    const month = f.month && /^\d{4}-\d{2}$/.test(f.month) ? f.month : null;
    const end = month ? new Date(utc(`${month}-01`)) : null;
    end?.setUTCMonth(end.getUTCMonth() + 1);
    const rows = await this.tenant.db.expense.findMany({
      where: {
        ...(!this.all() || f.mine ? { submittedBy: this.tenant.userId ?? "" } : {}),
        ...(f.status && { status: f.status }),
        ...(month && { date: { gte: utc(`${month}-01`), lt: end! } }),
      },
      include: WITH,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 1000,
    });
    return this.present(rows);
  }

  private async find(id: string) {
    const e = await this.tenant.db.expense.findFirst({ where: { id }, include: WITH });
    if (!e || (!this.all() && e.submittedBy !== this.tenant.userId)) throw new NotFoundException("No expense with that id.");
    return e;
  }

  async get(id: string) {
    return (await this.present([await this.find(id)]))[0]!;
  }

  /** The vendor by name (added the first time), and what the expense is for: a video carries its client. */
  private async resolve(input: ReturnType<typeof expenseInput.parse>) {
    let clientId = input.clientId ?? null;
    if (input.videoId) {
      const v = await this.tenant.db.video.findFirst({ where: { id: input.videoId }, select: { clientId: true } });
      if (!v) throw new BadRequestException({ message: "Choose one of your videos.", issues: [{ path: "videoId", message: "Choose the video" }] });
      clientId = v.clientId;
    } else if (clientId && !(await this.tenant.db.client.findFirst({ where: { id: clientId }, select: { id: true } })))
      throw new BadRequestException({ message: "Choose one of your clients.", issues: [{ path: "clientId", message: "Choose the client" }] });
    let vendorId: string | null = null;
    if (input.vendor) {
      const name = input.vendor;
      const found = await this.tenant.db.vendor.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
      vendorId = found?.id ?? (await this.tenant.db.vendor.create({ data: { agencyId: this.tenant.agencyId, name }, select: { id: true } })).id;
    }
    return { videoId: input.videoId ?? null, clientId, vendorId };
  }

  async create(raw: ExpenseInput) {
    const input = expenseInput.parse(raw);
    await this.lock.assertOpen(input.date);
    const links = await this.resolve(input);
    const id = await this.tenant.tx(async (tx) => {
      const e = await tx.expense.create({
        data: {
          agencyId: this.tenant.agencyId,
          date: utc(input.date),
          category: input.category,
          description: input.description,
          amount: input.amount,
          gst: input.gst,
          submittedBy: this.tenant.userId,
          ...links,
        },
      });
      await this.audit.record(tx, { action: "create", entity: "expense", entityId: e.id, after: { category: e.category, amount: e.amount, date: input.date } });
      await this.notifications.notify(
        tx,
        { can: { area: "finance", level: "approve" } },
        {
          kind: "expense_to_approve",
          title: `Expense to approve: ${money(e.amount + e.gst)} · ${e.category}`,
          body: e.description,
          link: "/app/expenses?status=submitted",
        },
      );
      return e.id;
    });
    return this.get(id);
  }

  /** The submitter changes it while it waits; finance changes it until it is approved. */
  private mayChange(e: Row) {
    if (e.status === "approved") throw new ConflictException("An approved expense stays as it was approved.");
    if (allows(this.tenant.permissions, "finance", "edit")) return;
    if (e.submittedBy !== this.tenant.userId || e.status !== "submitted")
      throw new ForbiddenException("Only the person who submitted it changes it, while it waits.");
  }

  async update(id: string, raw: ExpenseInput) {
    const e = await this.find(id);
    this.mayChange(e);
    const input = expenseInput.parse(raw);
    await this.lock.assertOpen(e.date);
    await this.lock.assertOpen(input.date);
    const links = await this.resolve(input);
    await this.tenant.tx(async (tx) => {
      await tx.expense.update({
        where: { id },
        data: {
          date: utc(input.date),
          category: input.category,
          description: input.description,
          amount: input.amount,
          gst: input.gst,
          status: "submitted",
          ...links,
        },
      });
      await this.audit.record(tx, {
        action: "update",
        entity: "expense",
        entityId: id,
        before: { amount: e.amount, category: e.category },
        after: { amount: input.amount, category: input.category },
      });
    });
    return this.get(id);
  }

  async remove(id: string) {
    const e = await this.find(id);
    this.mayChange(e);
    await this.lock.assertOpen(e.date);
    await this.tenant.tx(async (tx) => {
      await tx.expense.delete({ where: { id } });
      await this.audit.record(tx, {
        action: "delete",
        entity: "expense",
        entityId: id,
        before: { amount: e.amount, category: e.category, description: e.description },
      });
    });
  }

  async decide(id: string, d: { approved: boolean; note?: string }) {
    const e = await this.find(id);
    if (e.status !== "submitted") throw new ConflictException("Only an expense that waits is approved or rejected.");
    await this.lock.assertOpen(e.date);
    await this.tenant.tx(async (tx) => {
      await tx.expense.update({
        where: { id },
        data: { status: d.approved ? "approved" : "rejected", decidedBy: this.tenant.userId, decidedAt: new Date(), decisionNote: d.note ?? null },
      });
      await this.audit.record(tx, {
        action: d.approved ? "approve" : "reject",
        entity: "expense",
        entityId: id,
        after: { amount: e.amount, note: d.note ?? null },
      });
      await this.notifications.notify(
        tx,
        { users: [e.submittedBy] },
        {
          kind: "expense_decided",
          title: `${d.approved ? "Approved" : "Rejected"}: ${money(e.amount + e.gst)} · ${e.description}`,
          body: d.note,
          link: "/app/expenses",
        },
      );
    });
    return this.get(id);
  }

  async vendors() {
    return this.tenant.db.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, category: true } });
  }
}
