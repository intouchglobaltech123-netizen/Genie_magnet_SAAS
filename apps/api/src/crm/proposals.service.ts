import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@gm/db";
import {
  agreementEndDate,
  allows,
  discountedFee,
  FITMENT_QUADRANTS,
  gstinState,
  type ProposalAnswer,
  type ProposalInput,
  type ProposalStatus,
  type WinInput,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { OnboardingService } from "../onboarding/onboarding.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { PipelineService } from "./pipeline.service.js";

type Row = Prisma.ProposalGetPayload<object>;

const FITMENT: Record<(typeof FITMENT_QUADRANTS)[number], "amazing" | "bread_winning" | "convenience" | "dangerous"> = {
  Amazing: "amazing",
  "Bread-winning": "bread_winning",
  Convenience: "convenience",
  Dangerous: "dangerous",
};

export const presentProposal = (p: Row, leadName?: string) => ({
  id: p.id,
  leadId: p.leadId,
  ...(leadName !== undefined && { leadName }),
  packageId: p.packageId,
  packageName: p.packageName,
  listFee: p.listFee,
  discountPercent: p.discountPercent,
  monthlyFee: p.monthlyFee,
  months: p.months,
  deliverables: p.deliverables,
  notes: p.notes,
  status: p.status as ProposalStatus,
  decisionNote: p.decisionNote,
  decidedBy: p.decidedBy,
  createdBy: p.createdBy,
  createdAt: p.createdAt,
});

/**
 * Proposals (P1-16) and winning the deal (P1-17). A discount within the agency's limit is approved at once; above it,
 * the proposal waits for someone who may approve sales (crm: approve), who approves or rejects with a note.
 * Winning sets up the client, its contact and the agreement in one transaction, each in the audit log.
 */
@Injectable()
export class ProposalsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly pipeline: PipelineService,
    private readonly onboarding: OnboardingService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The lead, if the person may see it (roles limited to their own leads see only theirs). */
  private async lead(id: string) {
    const lead = await this.tenant.db.lead.findFirst({ where: { id, ...this.tenant.ownOnly("crm", "ownerId") } });
    if (!lead) throw new NotFoundException("No lead with that id that you can see.");
    return lead;
  }

  private async proposal(id: string) {
    const p = await this.tenant.db.proposal.findFirst({ where: { id, lead: this.tenant.ownOnly("crm", "ownerId") } });
    if (!p) throw new NotFoundException("No proposal with that id that you can see.");
    return p;
  }

  async list(status?: string) {
    const rows = await this.tenant.db.proposal.findMany({
      where: { ...(status && { status }), lead: this.tenant.ownOnly("crm", "ownerId") },
      include: { lead: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((r) => presentProposal(r, r.lead.name));
  }

  async create(leadId: string, input: ProposalInput & { discountPercent: number; months: number }) {
    const userId = this.tenant.userId;
    if (!userId) throw new UnauthorizedException("Sign in to make a proposal.");
    const lead = await this.lead(leadId);
    const [pkg, agency] = await Promise.all([
      this.tenant.db.package.findFirst({ where: { id: input.packageId, active: true } }),
      this.tenant.db.agency.findUnique({ where: { id: this.tenant.agencyId }, select: { discountLimit: true } }),
    ]);
    if (!pkg) throw new BadRequestException({ message: "Choose one of your active packages.", issues: [{ path: "packageId", message: "Choose a package" }] });
    const limit = agency?.discountLimit ?? 10;
    const needsApproval = input.discountPercent > limit && !allows(this.tenant.permissions, "crm", "approve");
    const status: ProposalStatus = needsApproval ? "pending_approval" : "approved";

    return this.tenant.tx(async (tx) => {
      const p = await tx.proposal.create({
        data: {
          agencyId: this.tenant.agencyId,
          leadId,
          packageId: pkg.id,
          packageName: pkg.name,
          listFee: pkg.monthlyFee,
          discountPercent: input.discountPercent,
          monthlyFee: discountedFee(pkg.monthlyFee, input.discountPercent),
          months: input.months,
          deliverables: pkg.deliverables as Prisma.InputJsonValue,
          notes: input.notes,
          status,
          ...(status === "approved" &&
            input.discountPercent > 0 && {
              decidedBy: userId,
              decidedAt: new Date(),
              decisionNote: input.discountPercent <= limit ? "Within the sales limit" : null,
            }),
          createdBy: userId,
        },
      });
      await this.audit.record(tx, {
        action: "create",
        entity: "proposal",
        entityId: p.id,
        after: { lead: lead.name, package: p.packageName, discountPercent: p.discountPercent, monthlyFee: p.monthlyFee, months: p.months, status },
      });
      if (status === "pending_approval")
        await this.notifications.notify(
          tx,
          { can: { area: "crm", level: "approve" } },
          {
            kind: "discount_approval",
            title: `Discount to approve: ${lead.company ?? lead.name}`,
            body: `${p.packageName} at ${p.discountPercent}% off — above the ${limit}% limit.`,
            link: "/app/sales",
          },
        );
      return presentProposal(p);
    });
  }

  /** Approve or reject a discount above the limit. */
  async decide(id: string, approve: boolean, note?: string) {
    const p = await this.proposal(id);
    if (p.status !== "pending_approval") throw new ConflictException("This proposal is not waiting for approval.");
    return this.tenant.tx(async (tx) => {
      const updated = await tx.proposal.update({
        where: { id },
        data: { status: approve ? "approved" : "rejected", decisionNote: note ?? null, decidedBy: this.tenant.userId, decidedAt: new Date() },
      });
      await this.audit.record(tx, {
        action: approve ? "approve" : "reject",
        entity: "proposal",
        entityId: id,
        before: { status: p.status },
        after: { status: updated.status, discountPercent: p.discountPercent, note: note ?? null },
      });
      await this.notifications.notify(
        tx,
        { users: [p.createdBy] },
        {
          kind: "discount_decided",
          title: `${p.discountPercent}% discount ${approve ? "approved" : "rejected"}: ${p.packageName}`,
          body: note ?? undefined,
          link: "/app/sales",
        },
      );
      return presentProposal(updated);
    });
  }

  async markSent(id: string) {
    const p = await this.proposal(id);
    if (p.status !== "approved")
      throw new ConflictException(p.status === "pending_approval" ? "Its discount needs approval first." : "Only an approved proposal can be sent.");
    return this.setStatus(p, "sent", { sentAt: new Date() });
  }

  /** The client's answer. */
  async answer(id: string, { accepted, note }: ProposalAnswer) {
    const p = await this.proposal(id);
    if (p.status !== "sent" && p.status !== "approved") throw new ConflictException("Record the client's answer on a proposal that was sent.");
    return this.setStatus(p, accepted ? "accepted" : "declined", { decisionNote: note ?? p.decisionNote });
  }

  private async setStatus(p: Row, status: ProposalStatus, data: Prisma.ProposalUpdateInput) {
    return this.tenant.tx(async (tx) => {
      const updated = await tx.proposal.update({ where: { id: p.id }, data: { ...data, status } });
      await this.audit.record(tx, { action: "update", entity: "proposal", entityId: p.id, before: { status: p.status }, after: { status } });
      return presentProposal(updated);
    });
  }

  // ─── Winning the deal (P1-17) ─────────────────────────────────────

  async win(leadId: string, input: WinInput) {
    const agencyId = this.tenant.agencyId;
    if (!allows(this.tenant.permissions, "clients", "edit"))
      throw new ForbiddenException("Your role cannot add clients — ask someone who can to mark this deal as won.");
    const lead = await this.lead(leadId);
    if (lead.clientId) throw new ConflictException("This deal is already won.");
    const proposal = input.proposalId ? await this.proposal(input.proposalId) : null;
    if (proposal && proposal.leadId !== leadId) throw new BadRequestException("That proposal is for another lead.");
    if (proposal && !["approved", "sent", "accepted"].includes(proposal.status)) {
      throw new ConflictException(
        proposal.status === "pending_approval" ? "The proposal's discount still needs approval." : "Use a proposal the client can accept.",
      );
    }
    const pkg = proposal?.packageId ? await this.tenant.db.package.findFirst({ where: { id: proposal.packageId } }) : null;
    const won = (await this.pipeline.stages()).find((s) => s.kind === "won")!;
    const onboarding = await this.onboarding.startingPoint("client");
    const c = input.client;

    try {
      return await this.tenant.tx(async (tx) => {
        const client = await tx.client.create({
          data: {
            agencyId,
            code: c.code,
            name: c.name,
            industry: c.industry,
            city: c.city,
            stage: c.stage ? (c.stage.toLowerCase() as Lowercase<NonNullable<typeof c.stage>>) : undefined,
            fitment: c.fitment ? FITMENT[c.fitment] : undefined,
            whatsappGroupUrl: c.whatsappGroupUrl,
            legalName: c.legalName,
            gstin: c.gstin,
            state: c.state ?? (c.gstin ? gstinState(c.gstin) : undefined),
            billingAddress: c.billingAddress,
            accountOwnerId: lead.ownerId,
            contacts: { create: c.contacts!.map((contact) => ({ ...contact, agencyId })) },
          },
          select: { id: true, code: true, name: true },
        });
        await this.audit.record(tx, {
          action: "create",
          entity: "client",
          entityId: client.id,
          after: { code: client.code, name: client.name, via: `won lead ${lead.name}` },
        });

        let agreementId: string | null = null;
        if (proposal) {
          const agreement = await tx.agreement.create({
            data: {
              agencyId,
              clientId: client.id,
              packageId: proposal.packageId,
              title: `${client.name} · ${proposal.packageName}`,
              status: "active",
              startDate: new Date(`${input.startDate}T00:00:00Z`),
              endDate: new Date(`${agreementEndDate(input.startDate, proposal.months)}T00:00:00Z`),
              monthlyFee: proposal.monthlyFee,
              billing: pkg?.billing ?? "Monthly advance",
              revisionsPerDeliverable: pkg?.revisionsPerDeliverable ?? 2,
              // The proposal's deliverables are the monthly quotas; the accepted proposal is the sign-off.
              deliverables: proposal.deliverables as Prisma.InputJsonValue,
              shootDays: pkg?.shootDays ?? 0,
              platforms: pkg?.platforms ?? [],
              signedBy: this.tenant.userId,
              signedAt: new Date(),
              createdBy: this.tenant.userId,
            },
            select: { id: true, title: true, monthlyFee: true, endDate: true },
          });
          agreementId = agreement.id;
          await this.audit.record(tx, {
            action: "create",
            entity: "agreement",
            entityId: agreement.id,
            after: {
              title: agreement.title,
              monthlyFee: agreement.monthlyFee,
              startDate: input.startDate,
              endDate: agreement.endDate.toISOString().slice(0, 10),
            },
          });
          if (proposal.status !== "accepted") {
            await tx.proposal.update({ where: { id: proposal.id }, data: { status: "accepted" } });
            await this.audit.record(tx, {
              action: "update",
              entity: "proposal",
              entityId: proposal.id,
              before: { status: proposal.status },
              after: { status: "accepted" },
            });
          }
        }

        // Onboarding starts the same day: the questionnaire is ready to share or fill in with the client.
        const onboardingId = await this.onboarding.startInWin(tx, client.id, onboarding);

        await tx.lead.update({ where: { id: leadId }, data: { stage: won.key, clientId: client.id, nextFollowUp: null } });
        await this.audit.record(tx, {
          action: "update",
          entity: "lead",
          entityId: leadId,
          before: { name: lead.name, stage: lead.stage },
          after: { name: lead.name, stage: won.key, clientId: client.id },
        });
        await this.notifications.notify(
          tx,
          { users: [lead.ownerId] },
          { kind: "deal_won", title: `Won: ${client.name} is now a client`, body: "Onboarding is ready to share.", link: `/app/clients/${client.id}` },
        );
        return { clientId: client.id, agreementId, onboardingId };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new BadRequestException({
          message: `Client code ${c.code} is already used.`,
          issues: [{ path: "client.code", message: "Already used by another client" }],
        });
      }
      throw e;
    }
  }
}
