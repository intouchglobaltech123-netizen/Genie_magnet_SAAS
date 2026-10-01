import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@gm/db";
import { type PackageInput, packageTotals } from "@gm/shared";
import { AuditService, changes } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

type Row = Prisma.PackageGetPayload<{ include: { _count: { select: { agreements: true } } } }>;

const present = (p: Row) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  monthlyFee: p.monthlyFee,
  deliverables: p.deliverables as PackageInput["deliverables"],
  videosPerMonth: p.videosPerMonth,
  postsPerMonth: p.postsPerMonth,
  shootDays: p.shootDays,
  revisionsPerDeliverable: p.revisionsPerDeliverable,
  platforms: p.platforms,
  billing: p.billing,
  active: p.active,
  agreements: p._count.agreements,
  createdAt: p.createdAt,
});

const terms = (p: Pick<Row, "name" | "description" | "monthlyFee" | "deliverables" | "shootDays" | "revisionsPerDeliverable" | "platforms" | "billing">) => ({
  name: p.name,
  description: p.description ?? null,
  monthlyFee: p.monthlyFee,
  deliverables: p.deliverables,
  shootDays: p.shootDays,
  revisionsPerDeliverable: p.revisionsPerDeliverable,
  platforms: p.platforms,
  billing: p.billing ?? null,
});

const withCount = { _count: { select: { agreements: true } } } as const;

/**
 * Packages (P1-13): what the agency sells, with its deliverables a month. Agreements copy the terms when they are
 * made, so editing or archiving a package never changes an agreement already signed. Every change is audited.
 */
@Injectable()
export class PackagesService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async list(includeArchived: boolean) {
    const rows = await this.tenant.db.package.findMany({
      where: includeArchived ? {} : { active: true },
      include: withCount,
      orderBy: [{ active: "desc" }, { createdAt: "asc" }, { name: "asc" }],
    });
    return rows.map(present);
  }

  private async find(id: string) {
    const row = await this.tenant.db.package.findFirst({ where: { id }, include: withCount });
    if (!row) throw new NotFoundException("No package with that id in this agency.");
    return row;
  }

  async create(input: PackageInput) {
    const agencyId = this.tenant.agencyId;
    return this.unique(input.name, () =>
      this.tenant.tx(async (tx) => {
        const created = await tx.package.create({
          data: { agencyId, ...input, deliverables: input.deliverables as Prisma.InputJsonArray, ...packageTotals(input.deliverables) },
          include: withCount,
        });
        await this.audit.record(tx, { action: "create", entity: "package", entityId: created.id, after: terms(created) });
        return present(created);
      }),
    );
  }

  async update(id: string, input: Partial<PackageInput>) {
    const current = await this.find(id);
    const next = { ...terms(current), ...input };
    const diff = changes(terms(current), next);
    if (!diff) return present(current);
    return this.unique(next.name, () =>
      this.tenant.tx(async (tx) => {
        const updated = await tx.package.update({
          where: { id },
          data: {
            ...input,
            ...(input.deliverables && { deliverables: input.deliverables as Prisma.InputJsonArray, ...packageTotals(input.deliverables) }),
          },
          include: withCount,
        });
        await this.audit.record(tx, {
          action: "update",
          entity: "package",
          entityId: id,
          before: { name: current.name, ...diff.before },
          after: { name: updated.name, ...diff.after },
        });
        return present(updated);
      }),
    );
  }

  /** Archived packages stay on their agreements but cannot be chosen for new ones. */
  async setActive(id: string, active: boolean) {
    const current = await this.find(id);
    if (current.active === active) return present(current);
    return this.tenant.tx(async (tx) => {
      const updated = await tx.package.update({ where: { id }, data: { active }, include: withCount });
      await this.audit.record(tx, { action: active ? "restore" : "archive", entity: "package", entityId: id, after: { name: current.name } });
      return present(updated);
    });
  }

  async remove(id: string) {
    const current = await this.find(id);
    if (current._count.agreements) {
      throw new ConflictException(`${current._count.agreements} agreements use "${current.name}". Archive it instead, so they keep it.`);
    }
    await this.tenant.tx(async (tx) => {
      await tx.package.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "package", entityId: id, before: terms(current) });
    });
  }

  private async unique<T>(name: string, run: () => Promise<T>) {
    try {
      return await run();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException(`There is already a package called "${name}".`);
      }
      throw e;
    }
  }
}
