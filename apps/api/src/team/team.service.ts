import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { type InvitationInput, type MemberUpdate, OWNER_ROLE } from "@gm/shared";
import { AuditService, changes } from "../audit/audit.service.js";
import { Outbox } from "../auth/outbox.js";
import { PlanService } from "../billing/plan.service.js";
import { ENV, type Env } from "../env.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { matrixOf, RolesService } from "./roles.service.js";

const INVITATION_DAYS = 7;

/**
 * People in the agency (P1-09): invitations, role changes and removals, checked against the agency's
 * permission matrix and audited. Accepting an invitation stays with sign-in (Better Auth), which checks
 * that the invited email is the signed-in, confirmed one.
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
    private readonly outbox: Outbox,
    @Inject(ENV) private readonly env: Env,
    private readonly plans: PlanService,
  ) {}

  async list() {
    // Always filter memberships by agency: a person can also see their own memberships in other agencies.
    const agencyId = this.tenant.agencyId;
    const [members, invitations, roles] = await Promise.all([
      this.tenant.db.membership.findMany({
        where: { agencyId },
        select: { id: true, role: true, title: true, createdAt: true, user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.tenant.db.invitation.findMany({
        where: { agencyId, status: "pending", expiresAt: { gt: new Date() } },
        select: { id: true, email: true, role: true, expiresAt: true, inviterId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.tenant.db.role.findMany({ select: { key: true, name: true } }),
    ]);
    const roleName = new Map(roles.map((r) => [r.key, r.name]));
    const names = new Map(members.map((m) => [m.user.id, m.user.name]));
    return {
      members: members.map((m) => ({
        id: m.id,
        user: m.user,
        role: { key: m.role, name: roleName.get(m.role) ?? m.role },
        title: m.title,
        joinedAt: m.createdAt,
      })),
      invitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: { key: i.role, name: roleName.get(i.role) ?? i.role },
        expiresAt: i.expiresAt,
        invitedBy: names.get(i.inviterId) ?? null,
        link: this.inviteLink(i.id),
      })),
    };
  }

  async invite(input: InvitationInput) {
    const agencyId = this.tenant.agencyId;
    const inviterId = this.tenant.userId;
    if (!inviterId) throw new UnauthorizedException("Sign in to invite people.");
    const role = await this.roles.find(input.role);
    this.assertMayGive(role.key, matrixOf(role));
    // The plan's room for people on the team (client people do not count).
    if (!role.isClient) await this.plans.assertRoom("users");

    const existing = await this.tenant.db.user.findFirst({ where: { email: input.email, memberships: { some: { agencyId } } }, select: { id: true } });
    if (existing) throw new ConflictException(`${input.email} is already in this agency.`);

    const invitation = await this.tenant.tx(async (tx) => {
      // A new invitation replaces any earlier one to the same address.
      await tx.invitation.updateMany({ where: { agencyId, email: input.email, status: "pending" }, data: { status: "canceled" } });
      const created = await tx.invitation.create({
        data: { agencyId, email: input.email, role: role.key, status: "pending", inviterId, expiresAt: new Date(Date.now() + INVITATION_DAYS * 86_400_000) },
      });
      await this.audit.record(tx, { action: "create", entity: "invitation", entityId: created.id, after: { email: input.email, role: role.key } });
      return created;
    });

    const [agency, inviter] = await Promise.all([
      this.tenant.db.agency.findUnique({ where: { id: agencyId }, select: { name: true } }),
      this.tenant.db.user.findUnique({ where: { id: inviterId }, select: { name: true } }),
    ]);
    const link = this.inviteLink(invitation.id);
    await this.outbox.send({
      to: input.email,
      subject: `${inviter?.name ?? "Someone"} invited you to ${agency?.name ?? "an agency"} on Genie Magnet OS`,
      text: link,
      link,
    });
    return { id: invitation.id, email: invitation.email, role: { key: role.key, name: role.name }, expiresAt: invitation.expiresAt, link };
  }

  /** The page where the invited person signs in or signs up and accepts. Shown to the inviter too, to share it themselves. */
  inviteLink(id: string) {
    return `${this.env.WEB_ORIGIN}/app/invite/${id}`;
  }

  async cancelInvitation(id: string) {
    const agencyId = this.tenant.agencyId;
    const invitation = await this.tenant.db.invitation.findFirst({ where: { id, agencyId, status: "pending" } });
    if (!invitation) throw new NotFoundException("No pending invitation with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.invitation.update({ where: { id }, data: { status: "canceled" } });
      await this.audit.record(tx, { action: "cancel", entity: "invitation", entityId: id, before: { email: invitation.email, role: invitation.role } });
    });
  }

  async changeRole(membershipId: string, input: MemberUpdate) {
    const member = await this.member(membershipId);
    const role = await this.roles.find(input.role);
    await this.assertMayManage(member.role);
    this.assertMayGive(role.key, matrixOf(role));
    if (member.role === OWNER_ROLE && role.key !== OWNER_ROLE) await this.assertAnotherOwner(member.id);

    const diff = changes({ name: member.user.name, role: member.role }, { name: member.user.name, role: role.key });
    if (diff) {
      await this.tenant.tx(async (tx) => {
        await tx.membership.update({ where: { id: member.id }, data: { role: role.key } });
        await this.audit.record(tx, {
          action: "update",
          entity: "membership",
          entityId: member.id,
          before: { name: member.user.name, role: member.role },
          after: { name: member.user.name, role: role.key },
        });
      });
    }
    return { id: member.id, role: { key: role.key, name: role.name } };
  }

  async remove(membershipId: string) {
    const member = await this.member(membershipId);
    await this.assertMayManage(member.role);
    if (member.role === OWNER_ROLE) await this.assertAnotherOwner(member.id);
    await this.tenant.tx(async (tx) => {
      await tx.membership.delete({ where: { id: member.id } });
      await this.audit.record(tx, {
        action: "delete",
        entity: "membership",
        entityId: member.id,
        before: { userId: member.user.id, name: member.user.name, role: member.role },
      });
    });
  }

  private async member(id: string) {
    const member = await this.tenant.db.membership.findFirst({
      where: { id, agencyId: this.tenant.agencyId },
      select: { id: true, role: true, user: { select: { id: true, name: true } } },
    });
    if (!member) throw new NotFoundException("No one with that membership id in this agency.");
    return member;
  }

  /** Only owners make or unmake owners; nobody hands out a role with more access than their own. */
  private assertMayGive(roleKey: string, permissions: ReturnType<typeof matrixOf>) {
    if (this.tenant.role === OWNER_ROLE) return;
    if (roleKey === OWNER_ROLE) throw new ForbiddenException("Only an owner can make someone an owner.");
    this.roles.assertWithinOwn(permissions);
  }

  /** You cannot change or remove someone whose role has more access than yours. */
  private async assertMayManage(currentRole: string) {
    if (this.tenant.role === OWNER_ROLE) return;
    if (currentRole === OWNER_ROLE) throw new ForbiddenException("Only an owner can change or remove an owner.");
    const role = await this.tenant.db.role.findUnique({ where: { agencyId_key: { agencyId: this.tenant.agencyId, key: currentRole } } });
    if (role) this.roles.assertWithinOwn(matrixOf(role));
  }

  private async assertAnotherOwner(exceptMembershipId: string) {
    const others = await this.tenant.db.membership.count({ where: { agencyId: this.tenant.agencyId, role: OWNER_ROLE, id: { not: exceptMembershipId } } });
    if (!others) throw new ConflictException("An agency needs at least one owner. Make someone else an owner first.");
  }
}
