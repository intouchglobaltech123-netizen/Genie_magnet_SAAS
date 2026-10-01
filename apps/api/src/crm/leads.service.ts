import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import { type ActivityInput, type LeadInput, type LeadUpdate, scopeOf } from "@gm/shared";
import { AuditService, changes } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { PipelineService } from "./pipeline.service.js";

type LeadRow = Prisma.LeadGetPayload<{ include: { _count: { select: { activities: true } } } }>;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const date = (s: string | null | undefined) => (s === undefined ? undefined : s === null ? null : new Date(`${s}T00:00:00Z`));

/** What the audit log keeps of a lead. */
const terms = (
  l: Pick<LeadRow, "name" | "company" | "phone" | "email" | "source" | "stage" | "value" | "ownerId" | "nextFollowUp" | "notes" | "lostReason">,
) => ({
  name: l.name,
  company: l.company,
  phone: l.phone,
  email: l.email,
  source: l.source,
  stage: l.stage,
  value: l.value,
  ownerId: l.ownerId,
  nextFollowUp: day(l.nextFollowUp),
  notes: l.notes,
  lostReason: l.lostReason,
});

export interface LeadFilter {
  stage?: string;
  ownerId?: string;
  q?: string;
  /** Only leads whose follow-up is today or overdue. */
  due?: boolean;
}

/**
 * Leads (P1-14) and their activities (P1-15). Roles limited to their own records see and change only the leads they
 * follow up; anything they add is theirs.
 */
@Injectable()
export class LeadsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly pipeline: PipelineService,
  ) {}

  private ownOnly() {
    return scopeOf(this.tenant.permissions, "crm") === "own";
  }

  private async names(ids: (string | null)[]) {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (!wanted.length) return new Map<string, string>();
    const people = await this.tenant.db.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
    return new Map(people.map((p) => [p.id, p.name]));
  }

  private present(l: LeadRow, names: Map<string, string>) {
    return {
      ...terms(l),
      id: l.id,
      owner: l.ownerId ? { id: l.ownerId, name: names.get(l.ownerId) ?? null } : null,
      clientId: l.clientId,
      activities: l._count.activities,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    };
  }

  async list(f: LeadFilter) {
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const rows = await this.tenant.db.lead.findMany({
      where: {
        ...this.tenant.ownOnly("crm", "ownerId"),
        ...(f.stage && { stage: f.stage }),
        ...(f.ownerId && { ownerId: f.ownerId }),
        ...(f.due && { nextFollowUp: { lte: today } }),
        ...(f.q && {
          OR: [
            { name: { contains: f.q, mode: "insensitive" as const } },
            { company: { contains: f.q, mode: "insensitive" as const } },
            { phone: { contains: f.q } },
            { email: { contains: f.q, mode: "insensitive" as const } },
          ],
        }),
      },
      include: { _count: { select: { activities: true } } },
      orderBy: [{ nextFollowUp: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 1000,
    });
    const names = await this.names(rows.map((r) => r.ownerId));
    return rows.map((r) => this.present(r, names));
  }

  private async find(id: string) {
    const row = await this.tenant.db.lead.findFirst({
      where: { id, ...this.tenant.ownOnly("crm", "ownerId") },
      include: { _count: { select: { activities: true } } },
    });
    if (!row) throw new NotFoundException("No lead with that id that you can see.");
    return row;
  }

  async get(id: string) {
    const lead = await this.find(id);
    const activities = await this.tenant.db.activity.findMany({ where: { leadId: id }, orderBy: { at: "desc" }, take: 200 });
    const names = await this.names([lead.ownerId, ...activities.map((a) => a.createdBy)]);
    return {
      ...this.present(lead, names),
      history: activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        summary: a.summary,
        outcome: a.outcome,
        at: a.at,
        by: a.createdBy ? { id: a.createdBy, name: names.get(a.createdBy) ?? null } : null,
      })),
    };
  }

  /** The owner must be on the team; roles limited to their own leads always own what they add. */
  private async owner(wanted: string | undefined | null) {
    const userId = this.tenant.userId;
    if (this.ownOnly()) {
      if (wanted && wanted !== userId) throw new ForbiddenException("Your role works only with its own leads.");
      return userId ?? null;
    }
    if (!wanted) return wanted === null ? null : (userId ?? null);
    const member = await this.tenant.db.membership.findFirst({ where: { agencyId: this.tenant.agencyId, userId: wanted }, select: { id: true } });
    if (!member)
      throw new BadRequestException({ message: "That person is not in this agency.", issues: [{ path: "ownerId", message: "Pick someone in your team" }] });
    return wanted;
  }

  async create(input: LeadInput & { value: number }) {
    const stages = await this.pipeline.stages();
    const stage = input.stage ? (await this.pipeline.stage(input.stage)).key : stages.find((s) => s.kind === "open")!.key;
    const ownerId = await this.owner(input.ownerId);
    const id = await this.tenant.tx(async (tx) => {
      const lead = await tx.lead.create({
        data: { ...input, agencyId: this.tenant.agencyId, stage, ownerId, nextFollowUp: date(input.nextFollowUp) },
      });
      await this.audit.record(tx, { action: "create", entity: "lead", entityId: lead.id, after: terms(lead) });
      return lead.id;
    });
    return this.get(id);
  }

  async update(id: string, input: LeadUpdate) {
    const current = await this.find(id);
    if (input.stage) await this.pipeline.stage(input.stage);
    const ownerId = input.ownerId !== undefined ? await this.owner(input.ownerId) : undefined;
    const data = { ...input, ownerId, nextFollowUp: date(input.nextFollowUp) };
    const next = terms({ ...current, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) } as LeadRow);
    const diff = changes(terms(current), next);
    if (!diff) return this.get(id);
    await this.tenant.tx(async (tx) => {
      await tx.lead.update({ where: { id }, data });
      await this.audit.record(tx, {
        action: "update",
        entity: "lead",
        entityId: id,
        before: { name: current.name, ...diff.before },
        after: { name: next.name, ...diff.after },
      });
    });
    return this.get(id);
  }

  async remove(id: string) {
    const current = await this.find(id);
    await this.tenant.tx(async (tx) => {
      await tx.lead.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "lead", entityId: id, before: terms(current) });
    });
  }

  /** Logs a call, meeting, message or note; can set the next follow-up at the same time. */
  async addActivity(leadId: string, input: ActivityInput) {
    const lead = await this.find(leadId);
    const createdBy = this.tenant.userId;
    if (!createdBy) throw new UnauthorizedException("Sign in to log activity.");
    await this.tenant.tx(async (tx) => {
      await tx.activity.create({
        data: {
          agencyId: this.tenant.agencyId,
          leadId,
          kind: input.kind,
          summary: input.summary,
          outcome: input.outcome,
          at: input.at ? new Date(input.at) : undefined,
          createdBy,
        },
      });
      const nextFollowUp = date(input.nextFollowUp);
      await tx.lead.update({ where: { id: leadId }, data: { updatedAt: new Date(), ...(nextFollowUp && { nextFollowUp }) } });
      if (nextFollowUp && day(nextFollowUp) !== day(lead.nextFollowUp)) {
        await this.audit.record(tx, {
          action: "update",
          entity: "lead",
          entityId: leadId,
          before: { name: lead.name, nextFollowUp: day(lead.nextFollowUp) },
          after: { name: lead.name, nextFollowUp: day(nextFollowUp) },
        });
      }
    });
    return this.get(leadId);
  }
}
