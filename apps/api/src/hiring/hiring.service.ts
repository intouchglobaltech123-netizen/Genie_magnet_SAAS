import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TenantTx } from "@gm/db";
import {
  allows,
  type CandidateInput,
  type CandidateRow,
  type CandidateStage,
  candidateInput,
  type Competence,
  DEFAULT_HIRING,
  type HiringSettings,
  hiringSettingsInput,
  type InterviewInput,
  interviewInput,
  type OfferInput,
  type OfferStatus,
  offerInput,
  type OpeningInput,
  type OpeningRow,
  openingInput,
  type Recommendation,
  type ScorecardInput,
  type ScorecardRow,
  scoreOf,
  scorecardInput,
  type StarStep,
} from "@gm/shared";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TeamService } from "../team/team.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const WITH = {
  opening: { select: { id: true, title: true, hiringManagerId: true } },
  interviews: { orderBy: { at: "asc" } },
  scorecards: { orderBy: { createdAt: "asc" } },
} as const satisfies Prisma.CandidateInclude;
type Row = Prisma.CandidateGetPayload<{ include: typeof WITH }>;
type Offer = OfferInput & { status: OfferStatus; madeAt: string };

/** Stages HR moves a candidate between by hand; approval, the offer and joining have their own steps. */
const MOVABLE: CandidateStage[] = ["applied", "screening", "interview", "scorecard"];

/**
 * Hiring (P5-10): openings with the role's task document, candidates through the stages, interviews and scorecards
 * by the agency's own rule, the hire approved, the offer, and joining — which invites them to the workspace. HR sees
 * everything; a hiring manager sees their openings, an interviewer the candidates they interview — without pay.
 */
@Injectable()
export class HiringService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly team: TeamService,
  ) {}

  private hr(level: "view" | "edit" | "approve" = "view") {
    return allows(this.tenant.permissions, "hr", level);
  }

  // ─── Rule ───────────────────────────────────────────────────────────

  async settings(): Promise<HiringSettings> {
    const s = await this.tenant.db.hiringSettings.findUnique({ where: { agencyId: this.tenant.agencyId } });
    return s ? hiringSettingsInput.parse(s.rule) : DEFAULT_HIRING;
  }

  async updateSettings(input: z.input<typeof hiringSettingsInput>) {
    const rule = hiringSettingsInput.parse(input);
    await this.tenant.tx(async (tx) => {
      await tx.hiringSettings.upsert({
        where: { agencyId: this.tenant.agencyId },
        create: { agencyId: this.tenant.agencyId, rule },
        update: { rule },
      });
      await this.audit.record(tx, { action: "update", entity: "hiring_settings", after: rule });
    });
    return this.settings();
  }

  // ─── Openings ───────────────────────────────────────────────────────

  async openings(): Promise<OpeningRow[]> {
    const me = this.tenant.userId ?? "";
    const where: Prisma.OpeningWhereInput = this.hr()
      ? {}
      : { OR: [{ hiringManagerId: me }, { candidates: { some: { interviews: { some: { interviewerId: me } } } } }] };
    const rows = await this.tenant.db.opening.findMany({ where, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
    return this.presentOpenings(rows);
  }

  async opening(id: string) {
    const [o] = (await this.openings()).filter((x) => x.id === id);
    if (!o) throw new NotFoundException("No opening with that id.");
    return o;
  }

  async createOpening(input: OpeningInput) {
    const o = openingInput.parse(input);
    const row = await this.tenant.tx(async (tx) => {
      const created = await tx.opening.create({ data: { agencyId: this.tenant.agencyId, ...this.openingData(o), createdBy: this.tenant.userId ?? null } });
      await this.audit.record(tx, { action: "create", entity: "opening", entityId: created.id, after: { title: o.title, positions: o.positions } });
      return created;
    });
    return this.opening(row.id);
  }

  async updateOpening(id: string, input: OpeningInput) {
    const o = openingInput.parse(input);
    const before = await this.tenant.db.opening.findFirst({ where: { id } });
    if (!before) throw new NotFoundException("No opening with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.opening.update({ where: { id }, data: this.openingData(o) });
      await this.audit.record(tx, {
        action: "update",
        entity: "opening",
        entityId: id,
        before: { title: before.title, status: before.status, positions: before.positions },
        after: { title: o.title, status: o.status, positions: o.positions },
      });
    });
    return this.opening(id);
  }

  private openingData(o: z.output<typeof openingInput>) {
    return {
      title: o.title,
      departmentId: o.departmentId ?? null,
      positions: o.positions,
      hiringManagerId: o.hiringManagerId ?? null,
      budgetFrom: o.budgetFrom ?? null,
      budgetTo: o.budgetTo ?? null,
      status: o.status,
      definition: o.definition,
      deliverables: o.deliverables,
      tasks: o.tasks,
      competence: o.competence,
      star: o.star,
      sources: o.sources,
    };
  }

  private async presentOpenings(rows: Prisma.OpeningGetPayload<object>[]): Promise<OpeningRow[]> {
    const ids = rows.map((r) => r.id);
    const [counts, deps, people] = await Promise.all([
      this.tenant.db.candidate.groupBy({ by: ["openingId", "stage"], where: { openingId: { in: ids } }, _count: { _all: true } }),
      this.tenant.db.department.findMany({ select: { id: true, name: true } }),
      this.names(rows.map((r) => r.hiringManagerId)),
    ]);
    const pay = this.hr();
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      department: deps.find((d) => d.id === r.departmentId) ?? null,
      positions: r.positions,
      hiringManager: r.hiringManagerId ? { id: r.hiringManagerId, name: people.get(r.hiringManagerId) ?? "" } : null,
      budgetFrom: pay ? r.budgetFrom : null,
      budgetTo: pay ? r.budgetTo : null,
      status: r.status as OpeningRow["status"],
      definition: r.definition,
      deliverables: r.deliverables,
      tasks: r.tasks,
      competence: r.competence as OpeningRow["competence"],
      star: r.star as OpeningRow["star"],
      sources: r.sources,
      createdAt: r.createdAt.toISOString(),
      pipeline: Object.fromEntries(counts.filter((c) => c.openingId === r.id).map((c) => [c.stage, c._count._all])),
    }));
  }

  // ─── Candidates ─────────────────────────────────────────────────────

  private visible(): Prisma.CandidateWhereInput {
    if (this.hr()) return {};
    const me = this.tenant.userId ?? "";
    return { OR: [{ opening: { hiringManagerId: me } }, { interviews: { some: { interviewerId: me } } }] };
  }

  async candidates(openingId?: string): Promise<CandidateRow[]> {
    const rows = await this.tenant.db.candidate.findMany({
      where: { ...this.visible(), ...(openingId && { openingId }) },
      include: WITH,
      orderBy: { createdAt: "desc" },
    });
    return this.present(rows, false);
  }

  async candidate(id: string): Promise<CandidateRow> {
    const r = await this.tenant.db.candidate.findFirst({ where: { id, ...this.visible() }, include: WITH });
    if (!r) throw new NotFoundException("No candidate with that id.");
    return (await this.present([r], true))[0]!;
  }

  async addCandidate(input: CandidateInput) {
    const c = candidateInput.parse(input);
    const opening = await this.tenant.db.opening.findFirst({ where: { id: c.openingId } });
    if (!opening) throw new BadRequestException({ message: "Choose one of your openings.", issues: [{ path: "openingId", message: "Choose the opening" }] });
    if (opening.status === "closed") throw new ConflictException("This opening is closed.");
    if (c.email && (await this.tenant.db.candidate.findFirst({ where: { openingId: c.openingId, email: c.email }, select: { id: true } })))
      throw new ConflictException(`${c.email} is already a candidate for ${opening.title}.`);
    const row = await this.tenant.tx(async (tx) => {
      const created = await tx.candidate.create({ data: { agencyId: this.tenant.agencyId, ...this.candidateData(c), createdBy: this.tenant.userId ?? null } });
      await this.audit.record(tx, { action: "create", entity: "candidate", entityId: created.id, after: { name: c.name, opening: opening.title } });
      return created;
    });
    return this.candidate(row.id);
  }

  async updateCandidate(id: string, input: CandidateInput) {
    const c = candidateInput.parse(input);
    await this.find(id);
    await this.tenant.tx(async (tx) => {
      await tx.candidate.update({ where: { id }, data: this.candidateData(c) });
      await this.audit.record(tx, { action: "update", entity: "candidate", entityId: id, after: { name: c.name } });
    });
    return this.candidate(id);
  }

  private candidateData(c: z.output<typeof candidateInput>) {
    return {
      openingId: c.openingId,
      name: c.name,
      email: c.email ?? null,
      phone: c.phone || null,
      city: c.city || null,
      source: c.source || null,
      experience: c.experience || null,
      currentPay: c.currentPay ?? null,
      expectedPay: c.expectedPay ?? null,
      notes: c.notes || null,
    };
  }

  /** HR moves a candidate between the early stages, or ends it with the reason. */
  async move(id: string, stage: CandidateStage, reason?: string) {
    const c = await this.find(id);
    if (c.stage === "joined") throw new ConflictException("They have joined.");
    if (stage !== "rejected" && !MOVABLE.includes(stage)) {
      if (stage !== "approval") throw new BadRequestException("Approval, the offer and joining have their own steps.");
      if (!c.scorecards.length) throw new ConflictException("Ask for approval once someone has filled in a scorecard.");
    }
    await this.tenant.tx(async (tx) => {
      await tx.candidate.update({ where: { id }, data: { stage, rejectedReason: stage === "rejected" ? (reason ?? null) : null } });
      await this.audit.record(tx, {
        action: "update",
        entity: "candidate",
        entityId: id,
        before: { stage: c.stage },
        after: { stage, reason: reason ?? null },
      });
      if (stage === "approval")
        await this.notifications.notify(
          tx,
          { can: { area: "hr", level: "approve" } },
          { kind: "hire_to_approve", title: `Hire ${c.name} as ${c.opening.title}?`, body: this.scoreLine(c), link: `/app/hiring?candidate=${id}` },
        );
    });
    return this.candidate(id);
  }

  /** Approving the hire: the candidate moves to the offer. */
  async approve(id: string, approved: boolean, note?: string) {
    const c = await this.find(id);
    if (c.stage !== "approval") throw new ConflictException("Only a candidate waiting for approval is approved.");
    if (!approved && !note) throw new BadRequestException({ message: "Say why.", issues: [{ path: "note", message: "Say why they are not taken" }] });
    await this.tenant.tx(async (tx) => {
      await tx.candidate.update({
        where: { id },
        data: approved
          ? { stage: "offer", approvedBy: this.tenant.userId ?? null, approvedAt: new Date() }
          : { stage: "rejected", rejectedReason: note ?? null },
      });
      await this.audit.record(tx, { action: approved ? "approve" : "reject", entity: "candidate", entityId: id, after: { name: c.name, note: note ?? null } });
    });
    return this.candidate(id);
  }

  /** The offer made to an approved candidate; a new one replaces it. */
  async offer(id: string, input: OfferInput) {
    const o = offerInput.parse(input);
    const c = await this.find(id);
    if (c.stage !== "offer") throw new ConflictException("Make an offer once the hire is approved.");
    const offer: Offer = { ...o, status: "made", madeAt: new Date().toISOString() };
    await this.tenant.tx(async (tx) => {
      await tx.candidate.update({ where: { id }, data: { offer } });
      await this.audit.record(tx, {
        action: "update",
        entity: "candidate",
        entityId: id,
        after: { offer: { designation: o.designation, joiningDate: o.joiningDate } },
      });
    });
    return this.candidate(id);
  }

  async answer(id: string, accepted: boolean) {
    const c = await this.find(id);
    const offer = c.offer as Offer | null;
    if (c.stage !== "offer" || !offer) throw new ConflictException("There is no offer to answer.");
    await this.tenant.tx(async (tx) => {
      await tx.candidate.update({ where: { id }, data: { offer: { ...offer, status: accepted ? "accepted" : "declined" } } });
      await this.audit.record(tx, { action: accepted ? "accept" : "reject", entity: "offer", entityId: id, after: { name: c.name } });
    });
    return this.candidate(id);
  }

  /** Joining: an invitation to the workspace with the offered role; their employee record follows when they accept. */
  async join(id: string) {
    const c = await this.find(id);
    const offer = c.offer as Offer | null;
    if (c.stage !== "offer" || offer?.status !== "accepted") throw new ConflictException("They join once they accept the offer.");
    if (!c.email) throw new BadRequestException({ message: "Add their email address first.", issues: [{ path: "email", message: "Needed to invite them" }] });
    const invitation = await this.team.invite({ email: c.email, role: offer.role });
    await this.tenant.tx(async (tx) => {
      await tx.candidate.update({ where: { id }, data: { stage: "joined", invitationId: invitation.id } });
      await this.audit.record(tx, {
        action: "update",
        entity: "candidate",
        entityId: id,
        before: { stage: c.stage },
        after: { stage: "joined", invitation: invitation.id },
      });
    });
    return this.candidate(id);
  }

  // ─── Interviews and scorecards ──────────────────────────────────────

  async schedule(id: string, input: InterviewInput) {
    const i = interviewInput.parse(input);
    const c = await this.find(id);
    if (["joined", "rejected"].includes(c.stage)) throw new ConflictException("This candidate's hiring is over.");
    const member = await this.tenant.db.membership.findFirst({ where: { agencyId: this.tenant.agencyId, userId: i.interviewerId }, select: { userId: true } });
    if (!member)
      throw new BadRequestException({ message: "Choose someone in your team.", issues: [{ path: "interviewerId", message: "Choose who interviews" }] });
    await this.tenant.tx(async (tx) => {
      await tx.interview.create({
        data: { agencyId: this.tenant.agencyId, candidateId: id, at: new Date(i.at), interviewerId: i.interviewerId, mode: i.mode, where: i.where || null },
      });
      if (["applied", "screening"].includes(c.stage)) await tx.candidate.update({ where: { id }, data: { stage: "interview" } });
      await this.audit.record(tx, { action: "create", entity: "interview", entityId: id, after: { candidate: c.name, at: i.at } });
      const when = new Date(i.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
      await this.notifications.notify(
        tx,
        { users: [i.interviewerId] },
        { kind: "interview_assigned", title: `Interview ${c.name} for ${c.opening.title}, ${when}`, link: `/app/hiring?candidate=${id}` },
      );
    });
    return this.candidate(id);
  }

  async cancelInterview(interviewId: string) {
    const i = await this.tenant.db.interview.findFirst({ where: { id: interviewId } });
    if (!i) throw new NotFoundException("No interview with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.interview.delete({ where: { id: interviewId } });
      await this.audit.record(tx, { action: "delete", entity: "interview", entityId: i.candidateId, before: { at: i.at.toISOString() } });
    });
    return this.candidate(i.candidateId);
  }

  /** The signed-in person's scorecard for a candidate they interviewed (or HR's, or the hiring manager's). */
  async score(id: string, input: ScorecardInput) {
    const s = scorecardInput.parse(input);
    const me = this.tenant.userId;
    if (!me) throw new ForbiddenException("Sign in first.");
    const c = await this.find(id);
    const mayScore = this.hr("edit") || c.opening.hiringManagerId === me || c.interviews.some((i) => i.interviewerId === me);
    if (!mayScore) throw new ForbiddenException("Only their interviewers, the hiring manager and HR fill in scorecards.");
    if (["joined", "rejected"].includes(c.stage)) throw new ConflictException("This candidate's hiring is over.");
    const { total, percent, recommendation } = scoreOf(s, await this.settings());
    const data = { ratings: s.ratings, star: s.star, taskScore: s.taskScore, remarks: s.remarks, total, percent, recommendation };
    await this.tenant.tx(async (tx) => {
      await tx.interviewScorecard.upsert({
        where: { candidateId_interviewerId: { candidateId: id, interviewerId: me } },
        create: { agencyId: this.tenant.agencyId, candidateId: id, interviewerId: me, ...data },
        update: data,
      });
      if (["applied", "screening", "interview"].includes(c.stage)) await tx.candidate.update({ where: { id }, data: { stage: "scorecard" } });
      await this.audit.record(tx, { action: "update", entity: "scorecard", entityId: id, after: { candidate: c.name, percent, recommendation } });
    });
    return this.candidate(id);
  }

  // ─── Joining, from the invitation ───────────────────────────────────

  /**
   * When someone a candidate's invitation went to accepts it: the candidate becomes them, and their employee record
   * starts from the offer — designation, the opening's department and the joining day.
   */
  static async linkHire(tx: TenantTx, agencyId: string, invitationId: string, userId: string) {
    const c = await tx.candidate.findFirst({ where: { invitationId }, include: { opening: { select: { departmentId: true, hiringManagerId: true } } } });
    if (!c) return;
    const offer = c.offer as Offer | null;
    await tx.candidate.update({ where: { id: c.id }, data: { userId } });
    const data = {
      designation: offer?.designation ?? null,
      departmentId: c.opening.departmentId,
      joiningDate: offer?.joiningDate ? new Date(`${offer.joiningDate}T00:00:00Z`) : null,
      phone: c.phone,
    };
    await tx.employeeProfile.upsert({ where: { agencyId_userId: { agencyId, userId } }, create: { agencyId, userId, ...data }, update: data });
    // Their joining project, from the agency's joining list (P5-21), run by the hiring manager.
    await ProjectsService.joining(tx, agencyId, {
      joinerId: userId,
      ownerId: c.opening.hiringManagerId ?? c.createdBy,
      startOn: offer?.joiningDate ?? null,
      createdBy: c.createdBy,
    });
  }

  // ─── Reading ────────────────────────────────────────────────────────

  private async find(id: string) {
    const c = await this.tenant.db.candidate.findFirst({ where: { id }, include: WITH });
    if (!c) throw new NotFoundException("No candidate with that id.");
    return c;
  }

  private scoreLine(c: Row) {
    const s = this.average(c);
    return s ? `${s.count} ${s.count === 1 ? "scorecard" : "scorecards"}, ${s.percent}% on average` : undefined;
  }

  private average(c: Row): CandidateRow["score"] {
    if (!c.scorecards.length) return null;
    const percent = Math.round(c.scorecards.reduce((s, x) => s + x.percent, 0) / c.scorecards.length);
    const votes = c.scorecards.map((x) => x.recommendation as Recommendation);
    const recommendation: Recommendation = votes.every((v) => v === "hire")
      ? "hire"
      : votes.includes("not_taken") && !votes.includes("hire")
        ? "not_taken"
        : "hold";
    return { percent, recommendation, count: c.scorecards.length };
  }

  private async names(ids: (string | null | undefined)[]) {
    const wanted = [...new Set(ids.filter((x): x is string => !!x))];
    const people = wanted.length ? await this.tenant.db.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } }) : [];
    return new Map(people.map((p) => [p.id, p.name]));
  }

  private async present(rows: Row[], full: boolean): Promise<CandidateRow[]> {
    const names = await this.names([
      ...rows.flatMap((r) => r.interviews.map((i) => i.interviewerId)),
      ...rows.flatMap((r) => r.scorecards.map((s) => s.interviewerId)),
      ...rows.map((r) => r.approvedBy),
    ]);
    const pay = this.hr();
    const now = new Date();
    const invitations = full
      ? await this.tenant.db.invitation.findMany({ where: { id: { in: rows.map((r) => r.invitationId).filter((x): x is string => !!x) }, status: "pending" } })
      : [];
    return rows.map((r) => {
      const offer = r.offer as Offer | null;
      return {
        id: r.id,
        opening: { id: r.opening.id, title: r.opening.title },
        name: r.name,
        email: r.email,
        phone: r.phone,
        city: r.city,
        source: r.source,
        experience: r.experience,
        currentPay: pay ? r.currentPay : null,
        expectedPay: pay ? r.expectedPay : null,
        notes: r.notes,
        stage: r.stage as CandidateStage,
        rejectedReason: r.rejectedReason,
        approvedBy: r.approvedBy ? (names.get(r.approvedBy) ?? null) : null,
        offer: offer && (pay ? offer : { ...offer, monthlyPay: 0 }),
        invitationLink: invitations.some((i) => i.id === r.invitationId) ? this.team.inviteLink(r.invitationId!) : null,
        createdAt: r.createdAt.toISOString(),
        score: this.average(r),
        nextInterview: r.interviews.find((i) => i.at >= now)?.at.toISOString() ?? null,
        ...(full && {
          interviews: r.interviews.map((i) => ({
            id: i.id,
            at: i.at.toISOString(),
            interviewer: { id: i.interviewerId, name: names.get(i.interviewerId) ?? "" },
            mode: i.mode as "in_person" | "video" | "phone",
            where: i.where,
            scored: r.scorecards.some((s) => s.interviewerId === i.interviewerId),
          })),
          scorecards: r.scorecards.map((s): ScorecardRow => ({
            id: s.id,
            interviewer: { id: s.interviewerId, name: names.get(s.interviewerId) ?? "" },
            ratings: s.ratings as Record<Competence, number>,
            star: s.star as Record<StarStep, string>,
            taskScore: s.taskScore,
            remarks: s.remarks,
            total: s.total,
            percent: s.percent,
            recommendation: s.recommendation as Recommendation,
            createdAt: s.createdAt.toISOString(),
          })),
        }),
      };
    });
  }
}
