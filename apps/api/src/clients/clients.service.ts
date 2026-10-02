import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@gm/db";
import {
  allows,
  BUSINESS_STAGES,
  type BusinessStage,
  type ClientInput,
  type ClientUpdate,
  type ContactInput,
  type ContactUpdate,
  FITMENT_QUADRANTS,
  type FitmentQuadrant,
  gstinState,
  gstinStateMismatch,
  scopeOf,
} from "@gm/shared";
import { AuditService, changes } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { AgreementsService } from "./agreements.service.js";

type StoredFitment = "amazing" | "bread_winning" | "convenience" | "dangerous";
type StoredStage = Lowercase<BusinessStage>;

const FITMENT: Record<FitmentQuadrant, StoredFitment> = {
  Amazing: "amazing",
  "Bread-winning": "bread_winning",
  Convenience: "convenience",
  Dangerous: "dangerous",
};
const toFitment = (f: FitmentQuadrant | null | undefined) => (f === undefined ? undefined : f === null ? null : FITMENT[f]);
const toStage = (s: BusinessStage | null | undefined) => (s === undefined ? undefined : s === null ? null : (s.toLowerCase() as StoredStage));
/** Stored values back to the labels the forms use. */
export const stageLabel = (s: string | null) => BUSINESS_STAGES.find((l) => l.toLowerCase() === s) ?? null;
export const fitmentLabel = (f: string | null) => FITMENT_QUADRANTS.find((l) => FITMENT[l] === f) ?? null;

const WITH = {
  contacts: { orderBy: [{ approver: "desc" }, { name: "asc" }] },
  agreements: { select: { id: true, status: true, monthlyFee: true, startDate: true, endDate: true, renewsId: true } },
} as const satisfies Prisma.ClientInclude;
type Row = Prisma.ClientGetPayload<{ include: typeof WITH }>;

/** What the audit log keeps of a client. */
const terms = (c: Omit<Prisma.ClientGetPayload<object>, "id" | "agencyId" | "createdAt" | "health" | "archivedAt">) => ({
  name: c.name,
  code: c.code,
  industry: c.industry,
  city: c.city,
  stage: c.stage,
  fitment: c.fitment,
  whatsappGroupUrl: c.whatsappGroupUrl,
  accountOwnerId: c.accountOwnerId,
  legalName: c.legalName,
  gstin: c.gstin,
  state: c.state,
  billingAddress: c.billingAddress,
  notes: c.notes,
});

const contactTerms = (c: { name: string; title: string | null; email: string | null; phone: string; approver: boolean }) => ({
  name: c.name,
  title: c.title,
  email: c.email,
  phone: c.phone,
  approver: c.approver,
});

const codeTaken = (code: string) =>
  new ConflictException({
    message: `Client code ${code} is already used in this agency.`,
    issues: [{ path: "code", message: "Already used by another client" }],
  });

/**
 * Clients and their contacts (P1-18). Roles limited to their own clients see and change only the clients they
 * look after; a client they add is theirs.
 */
@Injectable()
export class ClientsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly agreements: AgreementsService,
  ) {}

  private async names(ids: (string | null)[]) {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (!wanted.length) return new Map<string, string>();
    const people = await this.tenant.db.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
    return new Map(people.map((p) => [p.id, p.name]));
  }

  private async present(rows: Row[]) {
    const [names, notice] = await Promise.all([this.names(rows.map((r) => r.accountOwnerId)), this.agreements.notice()]);
    const today = new Date().toISOString().slice(0, 10);
    return rows.map((c) => {
      // Running now: signed and started (a signed renewal that starts later is not counted yet).
      const live = c.agreements.filter((a) => (a.status === "active" || a.status === "renewal_due") && a.startDate.toISOString().slice(0, 10) <= today);
      const renewed = new Set(c.agreements.map((a) => a.renewsId));
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        industry: c.industry,
        city: c.city,
        stage: c.stage,
        fitment: c.fitment,
        health: c.health,
        whatsappGroupUrl: c.whatsappGroupUrl,
        accountOwnerId: c.accountOwnerId,
        accountOwner: c.accountOwnerId ? { id: c.accountOwnerId, name: names.get(c.accountOwnerId) ?? null } : null,
        legalName: c.legalName,
        gstin: c.gstin,
        state: c.state,
        billingAddress: c.billingAddress,
        notes: c.notes,
        archivedAt: c.archivedAt,
        createdAt: c.createdAt,
        contacts: c.contacts.map((p) => ({ id: p.id, ...contactTerms(p) })),
        /** Fees a month of its active agreements. */
        monthlyFee: live.reduce((n, a) => n + a.monthlyFee, 0),
        activeAgreements: live.length,
        renewalDue: live.some((a) => !renewed.has(a.id) && this.agreements.isRenewalDue(a.endDate, notice, today)),
      };
    });
  }

  /** Every client the person may see, archived ones included (the screens hide them unless asked). */
  async list() {
    const rows = await this.tenant.db.client.findMany({
      where: this.tenant.ownOnly("clients", "accountOwnerId"),
      include: WITH,
      orderBy: { name: "asc" },
    });
    return this.present(rows);
  }

  private async find(id: string) {
    const row = await this.tenant.db.client.findFirst({ where: { id, ...this.tenant.ownOnly("clients", "accountOwnerId") }, include: WITH });
    if (!row) throw new NotFoundException("No client with that id that you can see.");
    return row;
  }

  /** The client page: details, contacts, agreements (for roles that may see them), and the lead it was won from. */
  async get(id: string) {
    const row = await this.find(id);
    const [[client], lead, agreements, videos, invoices] = await Promise.all([
      this.present([row]),
      this.tenant.db.lead.findFirst({ where: { clientId: id }, select: { id: true, name: true, company: true } }),
      allows(this.tenant.permissions, "agreements", "view") ? this.agreements.list({ clientId: id }) : Promise.resolve(null),
      this.tenant.db.video.count({ where: { clientId: id } }),
      this.tenant.db.invoice.count({ where: { clientId: id } }),
    ]);
    return {
      ...client!,
      agreements,
      lead,
      /** Only a client with nothing attached can be deleted; others are archived. */
      canDelete: !row.agreements.length && !lead && !videos && !invoices,
    };
  }

  /** The account owner must be on the team; roles limited to their own clients can only keep them. */
  private async owner(wanted: string | null | undefined, current: string | null) {
    if (wanted === undefined || wanted === current) return undefined;
    if (scopeOf(this.tenant.permissions, "clients") === "own") throw new ForbiddenException("Your role cannot hand a client to someone else.");
    if (wanted === null) return null;
    const member = await this.tenant.db.membership.findFirst({ where: { agencyId: this.tenant.agencyId, userId: wanted }, select: { id: true } });
    if (!member)
      throw new BadRequestException({
        message: "That person is not in this agency.",
        issues: [{ path: "accountOwnerId", message: "Pick someone in your team" }],
      });
    return wanted;
  }

  async create(input: ClientInput) {
    const agencyId = this.tenant.agencyId;
    const state = input.state ?? (input.gstin ? gstinState(input.gstin) : undefined);
    if (gstinStateMismatch(input.gstin, state))
      throw new BadRequestException({
        message: "The GSTIN is registered in another state.",
        issues: [{ path: "state", message: "The GSTIN is registered in another state" }],
      });
    try {
      const id = await this.tenant.tx(async (tx) => {
        const client = await tx.client.create({
          data: {
            agencyId,
            code: input.code,
            name: input.name,
            industry: input.industry,
            city: input.city,
            stage: toStage(input.stage),
            fitment: toFitment(input.fitment),
            whatsappGroupUrl: input.whatsappGroupUrl,
            legalName: input.legalName,
            gstin: input.gstin,
            state,
            billingAddress: input.billingAddress,
            // Someone who may only handle their own clients becomes the account owner of the ones they add.
            accountOwnerId: scopeOf(this.tenant.permissions, "clients") === "own" ? this.tenant.userId : undefined,
            contacts: { create: input.contacts.map((c) => ({ ...c, agencyId })) },
          },
        });
        await this.audit.record(tx, { action: "create", entity: "client", entityId: client.id, after: { code: client.code, name: client.name } });
        return client.id;
      });
      return (await this.present([await this.find(id)]))[0]!;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw codeTaken(input.code);
      throw e;
    }
  }

  async update(id: string, input: ClientUpdate) {
    const current = await this.find(id);
    const accountOwnerId = await this.owner(input.accountOwnerId, current.accountOwnerId);
    if (input.code && input.code !== current.code && (await this.tenant.db.video.count({ where: { clientId: id } }))) {
      throw new ConflictException({
        message: `Its videos already use ${current.code} in their codes, so the code stays.`,
        issues: [{ path: "code", message: "In use by its videos" }],
      });
    }
    const gstin = input.gstin === undefined ? current.gstin : input.gstin;
    // A GSTIN brings its state with it when no state is chosen.
    const state = input.state === undefined ? (input.gstin && !current.state ? gstinState(input.gstin) : current.state) : input.state;
    if (gstinStateMismatch(gstin, state))
      throw new BadRequestException({
        message: "The GSTIN is registered in another state.",
        issues: [{ path: "state", message: "The GSTIN is registered in another state" }],
      });

    const data = {
      name: input.name,
      code: input.code,
      industry: input.industry,
      city: input.city,
      stage: toStage(input.stage),
      fitment: toFitment(input.fitment),
      whatsappGroupUrl: input.whatsappGroupUrl,
      accountOwnerId,
      legalName: input.legalName,
      gstin: input.gstin,
      state: state ?? null,
      billingAddress: input.billingAddress,
      notes: input.notes,
    };
    const set = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as Partial<typeof data>;
    const diff = changes(terms(current), terms({ ...current, ...set } as typeof current));
    if (diff) {
      try {
        await this.tenant.tx(async (tx) => {
          await tx.client.update({ where: { id }, data: set });
          await this.audit.record(tx, {
            action: "update",
            entity: "client",
            entityId: id,
            before: { name: current.name, ...diff.before },
            after: { name: set.name ?? current.name, ...diff.after },
          });
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw codeTaken(input.code!);
        throw e;
      }
    }
    return this.get(id);
  }

  /** Archived clients leave the lists and keep their history; a client with a running agreement cannot be archived. */
  async setArchived(id: string, archived: boolean) {
    const current = await this.find(id);
    if (archived === !!current.archivedAt) return this.get(id);
    if (archived && current.agreements.some((a) => ["active", "renewal_due", "paused"].includes(a.status))) {
      throw new ConflictException("End its running agreements first — an archived client has no work in progress.");
    }
    await this.tenant.tx(async (tx) => {
      await tx.client.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
      await this.audit.record(tx, {
        action: archived ? "archive" : "restore",
        entity: "client",
        entityId: id,
        after: { code: current.code, name: current.name },
      });
    });
    return this.get(id);
  }

  /** Only a client added by mistake: no agreements, not won from a lead, no videos. Others are archived. */
  async remove(id: string) {
    const client = await this.get(id);
    if (!client.canDelete) throw new ConflictException("This client has agreements or history, so it can be archived but not deleted.");
    await this.tenant.tx(async (tx) => {
      await tx.client.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "client", entityId: id, before: { code: client.code, name: client.name } });
    });
  }

  // ─── Contacts ─────────────────────────────────────────────────────

  async addContact(clientId: string, input: ContactInput) {
    const client = await this.find(clientId);
    await this.tenant.tx(async (tx) => {
      const contact = await tx.contact.create({ data: { ...input, agencyId: this.tenant.agencyId, clientId } });
      await this.audit.record(tx, { action: "create", entity: "contact", entityId: contact.id, after: { client: client.name, ...contactTerms(contact) } });
    });
    return this.get(clientId);
  }

  private contact(client: Row, contactId: string) {
    const contact = client.contacts.find((c) => c.id === contactId);
    if (!contact) throw new NotFoundException("No contact with that id on this client.");
    return contact;
  }

  async updateContact(clientId: string, contactId: string, input: ContactUpdate) {
    const client = await this.find(clientId);
    const current = this.contact(client, contactId);
    const set = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<typeof current>;
    const diff = changes(contactTerms(current), contactTerms({ ...current, ...set }));
    if (diff) {
      await this.tenant.tx(async (tx) => {
        await tx.contact.update({ where: { id: contactId }, data: set });
        await this.audit.record(tx, {
          action: "update",
          entity: "contact",
          entityId: contactId,
          before: { client: client.name, name: current.name, ...diff.before },
          after: { client: client.name, name: set.name ?? current.name, ...diff.after },
        });
      });
    }
    return this.get(clientId);
  }

  async removeContact(clientId: string, contactId: string) {
    const client = await this.find(clientId);
    const current = this.contact(client, contactId);
    if (client.contacts.length === 1) throw new ConflictException("A client keeps at least one contact — add the new one first.");
    await this.tenant.tx(async (tx) => {
      await tx.contact.delete({ where: { id: contactId } });
      await this.audit.record(tx, { action: "delete", entity: "contact", entityId: contactId, before: { client: client.name, ...contactTerms(current) } });
    });
    return this.get(clientId);
  }
}
