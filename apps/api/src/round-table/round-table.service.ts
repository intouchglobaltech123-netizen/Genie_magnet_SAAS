import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import { allows, type RtFeedback, type RtSessionInput, type RtSessionRow, type RtStatus, rtSessionInput } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

/** A moment's grace after the buzzer, for answers already on their way. */
const GRACE = 5_000;
const DAY = 86_400_000;
type Session = Prisma.RtSessionGetPayload<{ include: { answers: true } }>;
const three = (a: string[]) => [a[0] ?? "", a[1] ?? "", a[2] ?? ""] as [string, string, string];

/**
 * Round Table (P5-15): the facilitator runs timed rounds, one person each; everyone writes on the three questions about
 * that person (and the person about themselves) before the buzzer. Then the facilitator moderates — hiding what should
 * not be passed on, with the reason — and releases. Each person reads what was said about them without names, and
 * commits to what they will do better.
 */
@Injectable()
export class RoundTableService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private me() {
    return this.tenant.userId ?? "";
  }

  private async find(id: string) {
    const s = await this.tenant.db.rtSession.findFirst({ where: { id }, include: { answers: true } });
    const me = this.me();
    if (!s || !(allows(this.tenant.permissions, "reports", "view") || s.participantIds.includes(me) || s.facilitatorId === me))
      throw new NotFoundException("No round table with that id.");
    return s;
  }

  /** The facilitator, or someone who may approve reviews. */
  private runs(s: Session) {
    return s.facilitatorId === this.me() || allows(this.tenant.permissions, "reports", "approve");
  }

  private assertRuns(s: Session) {
    if (!this.runs(s)) throw new ForbiddenException("The facilitator runs the round table.");
  }

  async list(): Promise<Pick<RtSessionRow, "id" | "name" | "status" | "createdAt" | "releasedAt">[]> {
    const me = this.me();
    const rows = await this.tenant.db.rtSession.findMany({
      where: allows(this.tenant.permissions, "reports", "view") ? {} : { OR: [{ participantIds: { has: me } }, { facilitatorId: me }] },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status as RtStatus,
      createdAt: r.createdAt.toISOString(),
      releasedAt: r.releasedAt?.toISOString() ?? null,
    }));
  }

  async create(input: RtSessionInput) {
    const r = rtSessionInput.parse(input);
    const ids = [...new Set(r.participantIds)];
    if ((await this.tenant.db.membership.count({ where: { agencyId: this.tenant.agencyId, userId: { in: ids } } })) !== ids.length)
      throw new BadRequestException({ message: "Choose people in your team.", issues: [{ path: "participantIds", message: "Choose people in your team" }] });
    if (r.meetingId && !(await this.tenant.db.meeting.findFirst({ where: { id: r.meetingId }, select: { id: true } })))
      throw new BadRequestException("Choose one of your reviews.");
    const row = await this.tenant.tx(async (tx) => {
      const created = await tx.rtSession.create({
        data: {
          agencyId: this.tenant.agencyId,
          name: r.name,
          meetingId: r.meetingId,
          facilitatorId: this.me() || null,
          participantIds: ids,
          questions: r.questions,
          secondsPerPerson: r.secondsPerPerson,
        },
      });
      await this.audit.record(tx, { action: "create", entity: "round_table", entityId: created.id, after: { name: r.name, people: ids.length } });
      return created;
    });
    return this.get(row.id);
  }

  async get(id: string): Promise<RtSessionRow> {
    const s = await this.find(id);
    const ids = [...new Set([...s.participantIds, s.facilitatorId, ...s.answers.map((a) => a.authorId)].filter((x): x is string => !!x))];
    const people = await this.tenant.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const name = new Map(people.map((p) => [p.id, p.name]));
    const meeting = s.meetingId ? await this.tenant.db.meeting.findFirst({ where: { id: s.meetingId }, select: { id: true, title: true } }) : null;
    const subjectId = s.participantIds[s.currentIndex];
    const live = s.status === "live" && subjectId;
    const mine = live ? s.answers.find((a) => a.subjectId === subjectId && a.authorId === this.me() && !a.missed) : undefined;
    const reveal = this.runs(s) && (s.status === "moderation" || s.status === "released");
    return {
      id: s.id,
      name: s.name,
      meeting,
      facilitator: s.facilitatorId ? { id: s.facilitatorId, name: name.get(s.facilitatorId) ?? "" } : null,
      participants: s.participantIds.map((p) => ({ id: p, name: name.get(p) ?? "" })),
      questions: three(s.questions),
      secondsPerPerson: s.secondsPerPerson,
      status: s.status as RtStatus,
      current:
        live && s.roundEndsAt
          ? { index: s.currentIndex, subject: { id: subjectId, name: name.get(subjectId) ?? "" }, endsAt: s.roundEndsAt.toISOString() }
          : null,
      myAnswer: mine ? three(mine.answers) : null,
      written: live ? s.answers.filter((a) => a.subjectId === subjectId && !a.missed).length : 0,
      ...(reveal && {
        answers: s.answers
          .filter((a) => !a.missed || a.authorId)
          .map((a) => ({
            id: a.id,
            subject: name.get(a.subjectId) ?? "",
            subjectId: a.subjectId,
            author: name.get(a.authorId) ?? "",
            self: a.subjectId === a.authorId,
            answers: three(a.answers),
            hidden: a.hidden,
            hiddenReason: a.hiddenReason,
            missed: a.missed,
          })),
      }),
      releasedAt: s.releasedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    };
  }

  async start(id: string) {
    const s = await this.find(id);
    this.assertRuns(s);
    if (s.status !== "draft") throw new ConflictException("It has started.");
    await this.tenant.tx(async (tx) => {
      await tx.rtSession.update({ where: { id }, data: { status: "live", currentIndex: 0, roundEndsAt: new Date(Date.now() + s.secondsPerPerson * 1000) } });
      await this.audit.record(tx, { action: "update", entity: "round_table", entityId: id, after: { started: true } });
    });
    return this.get(id);
  }

  /** A participant's answers on the person whose round it is, before the buzzer. */
  async answer(id: string, answers: [string, string, string]) {
    const s = await this.find(id);
    const me = this.me();
    if (!s.participantIds.includes(me)) throw new ForbiddenException("Only those taking part write.");
    if (s.status !== "live" || !s.roundEndsAt) throw new ConflictException("No round is running.");
    if (Date.now() > s.roundEndsAt.getTime() + GRACE) throw new ConflictException("The buzzer has gone for this round.");
    if (!answers.some((a) => a.trim())) throw new BadRequestException("Write at least one answer.");
    const subjectId = s.participantIds[s.currentIndex]!;
    await this.tenant.db.rtAnswer.upsert({
      where: { sessionId_subjectId_authorId: { sessionId: id, subjectId, authorId: me } },
      create: { agencyId: this.tenant.agencyId, sessionId: id, subjectId, authorId: me, answers },
      update: { answers, missed: false },
    });
    return this.get(id);
  }

  /** The next person's round; those who wrote nothing in this one are marked missed. After the last, moderation. */
  async next(id: string) {
    const s = await this.find(id);
    this.assertRuns(s);
    if (s.status !== "live") throw new ConflictException("No round is running.");
    const subjectId = s.participantIds[s.currentIndex]!;
    const wrote = new Set(s.answers.filter((a) => a.subjectId === subjectId).map((a) => a.authorId));
    const last = s.currentIndex >= s.participantIds.length - 1;
    await this.tenant.tx(async (tx) => {
      const missing = s.participantIds.filter((p) => !wrote.has(p));
      if (missing.length)
        await tx.rtAnswer.createMany({
          data: missing.map((authorId) => ({ agencyId: this.tenant.agencyId, sessionId: id, subjectId, authorId, answers: [], missed: true })),
          skipDuplicates: true,
        });
      await tx.rtSession.update({
        where: { id },
        data: last
          ? { status: "moderation", roundEndsAt: null }
          : { currentIndex: s.currentIndex + 1, roundEndsAt: new Date(Date.now() + s.secondsPerPerson * 1000) },
      });
    });
    return this.get(id);
  }

  /** In moderation: hidden answers are not passed on. */
  async hide(answerId: string, hidden: boolean, reason: string) {
    const a = await this.tenant.db.rtAnswer.findFirst({ where: { id: answerId } });
    if (!a) throw new NotFoundException("No answer with that id.");
    const s = await this.find(a.sessionId);
    this.assertRuns(s);
    if (s.status !== "moderation") throw new ConflictException("Answers are moderated before the round table is released.");
    await this.tenant.tx(async (tx) => {
      await tx.rtAnswer.update({ where: { id: answerId }, data: { hidden, hiddenReason: hidden ? reason : null } });
      await this.audit.record(tx, { action: "update", entity: "round_table_answer", entityId: answerId, after: { hidden, reason: hidden ? reason : null } });
    });
    return this.get(a.sessionId);
  }

  async release(id: string) {
    const s = await this.find(id);
    this.assertRuns(s);
    if (s.status !== "moderation") throw new ConflictException("Moderate it first.");
    await this.tenant.tx(async (tx) => {
      await tx.rtSession.update({ where: { id }, data: { status: "released", releasedAt: new Date() } });
      await this.audit.record(tx, { action: "approve", entity: "round_table", entityId: id, after: { released: true } });
      await this.notifications.notify(
        tx,
        { users: s.participantIds },
        { kind: "round_table_released", title: `${s.name}: what your team said is ready`, link: `/app/round-table?session=${id}` },
      );
    });
    return this.get(id);
  }

  /** What was said about the signed-in person, without names; their own answers apart. */
  async mine(id: string): Promise<RtFeedback> {
    const s = await this.find(id);
    const me = this.me();
    if (s.status !== "released" || !s.releasedAt) throw new ConflictException("It is not released yet.");
    if (!s.participantIds.includes(me)) throw new NotFoundException("You did not take part.");
    const about = s.answers.filter((a) => a.subjectId === me && !a.missed && !a.hidden);
    const self = s.answers.find((a) => a.subjectId === me && a.authorId === me);
    const commitment = self?.commitmentId ? await this.tenant.db.commitment.findFirst({ where: { id: self.commitmentId } }) : null;
    return {
      session: { id: s.id, name: s.name, releasedAt: s.releasedAt.toISOString() },
      questions: three(s.questions),
      self: self && !self.missed ? three(self.answers) : null,
      // In an order that does not give away who wrote what.
      peers: about
        .filter((a) => a.authorId !== me)
        .map((a) => three(a.answers))
        .sort((x, y) => x.join("").localeCompare(y.join(""))),
      commitment: commitment ? { id: commitment.id, text: commitment.text, due: commitment.due?.toISOString().slice(0, 10) ?? "" } : null,
    };
  }

  /** The person's commitment from it: carried in reviews like any other, due in 45 days unless they say. */
  async commit(id: string, text: string, due?: string) {
    const s = await this.find(id);
    const me = this.me();
    if (s.status !== "released") throw new ConflictException("It is not released yet.");
    if (!s.participantIds.includes(me)) throw new NotFoundException("You did not take part.");
    const self = s.answers.find((a) => a.subjectId === me && a.authorId === me);
    if (self?.commitmentId) throw new ConflictException("You have made your commitment.");
    await this.tenant.tx(async (tx) => {
      const c = await tx.commitment.create({
        data: {
          agencyId: this.tenant.agencyId,
          meetingId: s.meetingId,
          text,
          ownerId: me,
          due: due ? new Date(`${due}T00:00:00Z`) : new Date(new Date(Date.now() + 45 * DAY).toISOString().slice(0, 10) + "T00:00:00Z"),
          createdBy: me,
        },
      });
      await tx.rtAnswer.upsert({
        where: { sessionId_subjectId_authorId: { sessionId: id, subjectId: me, authorId: me } },
        create: { agencyId: this.tenant.agencyId, sessionId: id, subjectId: me, authorId: me, answers: [], missed: true, commitmentId: c.id },
        update: { commitmentId: c.id },
      });
      await this.audit.record(tx, { action: "create", entity: "commitment", entityId: c.id, after: { text, from: s.name } });
    });
    return this.mine(id);
  }
}
