import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import {
  allows,
  type AttendanceMark,
  type CadenceInput,
  type CadenceRow,
  cadenceInput,
  type CommitmentInput,
  type CommitmentMark,
  type CommitmentRow,
  commitmentInput,
  commitmentMark,
  DEFAULT_CADENCES,
  type DecisionInput,
  type DecisionRow,
  decisionInput,
  type FigureBlock,
  type MeetingInput,
  type MeetingRow,
  type MeetingUpdate,
  meetingInput,
  meetingUpdate,
  REVIEW_CADENCES,
  type ReviewBlock,
  type ReviewCadence,
} from "@gm/shared";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { ReviewFigures } from "./review-figures.js";

const IST = 330 * 60_000;
const DAY = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);
const istDay = (d: Date) => new Date(d.getTime() + IST).toISOString().slice(0, 10);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const when = (d: Date) =>
  d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
type Mark = { mark: CommitmentMark; note: string; at: string; meetingId: string | null; meeting: string | null };
type CommitmentWith = Prisma.CommitmentGetPayload<{ include: { meeting: { select: { id: true; title: true } } } }>;
type MeetingFull = Prisma.MeetingGetPayload<object>;

/**
 * STOP reviews (P5-14) and decisions and commitments (P5-16). Those who may see reviews see them all; those who may
 * edit them schedule and run them; locking needs approval and keeps the figures as they were. Everyone sees the
 * commitments they own and marks them done.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly figures: ReviewFigures,
  ) {}

  private may(level: "view" | "edit" | "approve") {
    return allows(this.tenant.permissions, "reports", level);
  }

  private async names(ids: (string | null | undefined)[]) {
    const wanted = [...new Set(ids.filter((x): x is string => !!x))];
    const people = wanted.length ? await this.tenant.db.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } }) : [];
    return new Map(people.map((p) => [p.id, p.name]));
  }

  // ─── Rhythms ────────────────────────────────────────────────────────

  private async settings() {
    let rows = await this.tenant.db.reviewCadenceSetting.findMany();
    if (rows.length < REVIEW_CADENCES.length) {
      await this.tenant.db.reviewCadenceSetting.createMany({
        data: REVIEW_CADENCES.filter((c) => !rows.some((r) => r.cadence === c)).map((c) => ({
          agencyId: this.tenant.agencyId,
          cadence: c,
          ...DEFAULT_CADENCES[c],
          participantIds: [],
        })),
        skipDuplicates: true,
      });
      rows = await this.tenant.db.reviewCadenceSetting.findMany();
    }
    return REVIEW_CADENCES.map((c) => rows.find((r) => r.cadence === c)!);
  }

  async cadences(): Promise<CadenceRow[]> {
    const rows = await this.settings();
    const now = new Date();
    const [upcoming, past] = await Promise.all([
      this.tenant.db.meeting.findMany({ where: { startsAt: { gte: new Date(now.getTime() - DAY) }, status: "scheduled" }, orderBy: { startsAt: "asc" } }),
      this.tenant.db.meeting.findMany({ where: { status: "locked" }, orderBy: { startsAt: "desc" } }),
    ]);
    return rows.map((r) => {
      const next = upcoming.find((m) => m.cadence === r.cadence);
      const last = past.find((m) => m.cadence === r.cadence);
      return {
        id: r.id,
        cadence: r.cadence as ReviewCadence,
        name: r.name,
        everyDays: r.everyDays,
        purpose: r.purpose,
        minutes: r.minutes,
        schedule: r.schedule,
        mandatory: r.mandatory,
        facilitatorId: r.facilitatorId,
        participantIds: r.participantIds,
        agenda: r.agenda as CadenceRow["agenda"],
        blocks: r.blocks as ReviewBlock[],
        next: next ? { id: next.id, startsAt: next.startsAt.toISOString(), title: next.title } : null,
        last: last ? { id: last.id, startsAt: last.startsAt.toISOString() } : null,
      };
    });
  }

  async saveCadence(cadence: ReviewCadence, input: CadenceInput) {
    const c = cadenceInput.parse(input);
    await this.settings();
    await this.tenant.tx(async (tx) => {
      await tx.reviewCadenceSetting.update({ where: { agencyId_cadence: { agencyId: this.tenant.agencyId, cadence } }, data: { ...c, agenda: c.agenda } });
      await this.audit.record(tx, {
        action: "update",
        entity: "review_cadence",
        entityId: cadence,
        after: { name: c.name, everyDays: c.everyDays, agenda: c.agenda.length },
      });
    });
    return (await this.cadences()).find((x) => x.cadence === cadence)!;
  }

  // ─── Meetings ───────────────────────────────────────────────────────

  async meetings(): Promise<Pick<MeetingRow, "id" | "cadence" | "number" | "title" | "startsAt" | "status">[]> {
    const me = this.tenant.userId ?? "";
    const rows = await this.tenant.db.meeting.findMany({
      where: this.may("view") ? {} : { OR: [{ facilitatorId: me }, { participantIds: { has: me } }] },
      orderBy: { startsAt: "desc" },
      take: 200,
    });
    return rows.map((m) => ({
      id: m.id,
      cadence: m.cadence as ReviewCadence,
      number: m.number,
      title: m.title,
      startsAt: m.startsAt.toISOString(),
      status: m.status as MeetingRow["status"],
    }));
  }

  async schedule(input: MeetingInput) {
    const m = meetingInput.parse(input);
    const s = (await this.settings()).find((x) => x.cadence === m.cadence)!;
    const last = await this.tenant.db.meeting.findFirst({ where: { cadence: m.cadence }, orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;
    const startsAt = new Date(m.startsAt);
    const row = await this.tenant.tx(async (tx) => {
      const created = await tx.meeting.create({
        data: {
          agencyId: this.tenant.agencyId,
          cadence: m.cadence,
          number,
          title: `${s.name} #${number}`,
          startsAt,
          venue: m.venue || null,
          facilitatorId: s.facilitatorId,
          participantIds: s.participantIds,
          agenda: s.agenda as Prisma.InputJsonValue,
          createdBy: this.tenant.userId ?? null,
        },
      });
      await this.audit.record(tx, { action: "create", entity: "meeting", entityId: created.id, after: { title: created.title, startsAt: m.startsAt } });
      await this.notifications.notify(
        tx,
        { users: [...s.participantIds, s.facilitatorId] },
        { kind: "review_scheduled", title: `${created.title}: ${when(startsAt)}`, body: m.venue, link: `/app/reviews?meeting=${created.id}` },
      );
      return created;
    });
    return this.meeting(row.id);
  }

  private async find(id: string) {
    const m = await this.tenant.db.meeting.findFirst({ where: { id } });
    const me = this.tenant.userId ?? "";
    if (!m || !(this.may("view") || m.facilitatorId === me || m.participantIds.includes(me))) throw new NotFoundException("No review with that id.");
    return m;
  }

  /** Running it: the facilitator, or those who may edit reviews. */
  private assertRuns(m: MeetingFull) {
    if (!(this.may("edit") || m.facilitatorId === this.tenant.userId)) throw new ForbiddenException("The facilitator runs the review.");
    if (m.status === "locked") throw new ConflictException("It is locked.");
  }

  async meeting(id: string): Promise<MeetingRow> {
    const m = await this.find(id);
    const s = (await this.settings()).find((x) => x.cadence === m.cadence)!;
    const endOfDay = new Date(utc(istDay(m.startsAt)).getTime() + DAY);
    const [toReview, made, decisions, figures] = await Promise.all([
      m.status === "locked"
        ? this.tenant.db.commitment.findMany({
            where: { history: { array_contains: [{ meetingId: id }] } },
            include: { meeting: { select: { id: true, title: true } } },
          })
        : this.tenant.db.commitment.findMany({
            where: { status: "open", due: { lt: endOfDay }, OR: [{ meetingId: null }, { meetingId: { not: id } }] },
            include: { meeting: { select: { id: true, title: true } } },
            orderBy: { due: "asc" },
          }),
      this.tenant.db.commitment.findMany({
        where: { meetingId: id },
        include: { meeting: { select: { id: true, title: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.tenant.db.decision.findMany({
        where: { meetingId: id },
        include: { meeting: { select: { id: true, title: true } } },
        orderBy: { createdAt: "asc" },
      }),
      m.snapshot ? Promise.resolve(m.snapshot as unknown as FigureBlock[]) : this.figures.blocks(s.blocks as ReviewBlock[]),
    ]);
    const recognitions = m.recognitions as { personId: string; title: string; story: string; by: string }[];
    const names = await this.names([
      m.facilitatorId,
      m.lockedBy,
      ...m.participantIds,
      ...recognitions.flatMap((r) => [r.personId, r.by]),
      ...[...toReview, ...made].map((c) => c.ownerId),
      ...decisions.flatMap((d) => [d.ownerId, d.createdBy]),
    ]);
    return {
      id: m.id,
      cadence: m.cadence as ReviewCadence,
      number: m.number,
      title: m.title,
      startsAt: m.startsAt.toISOString(),
      venue: m.venue,
      status: m.status as MeetingRow["status"],
      facilitator: m.facilitatorId ? { id: m.facilitatorId, name: names.get(m.facilitatorId) ?? "" } : null,
      participants: m.participantIds.filter((p) => names.has(p)).map((p) => ({ id: p, name: names.get(p)! })),
      agenda: m.agenda as MeetingRow["agenda"],
      notes: m.notes as Record<string, string>,
      attendance: m.attendance as Record<string, AttendanceMark>,
      recognitions: recognitions.map((r) => ({ ...r, name: names.get(r.personId) ?? "", by: names.get(r.by) ?? "" })),
      figures,
      toReview: toReview.map((c) => this.presentCommitment(c, names)),
      made: made.map((c) => this.presentCommitment(c, names)),
      decisions: decisions.map((d) => this.presentDecision(d, names)),
      lockedAt: m.lockedAt?.toISOString() ?? null,
      lockedBy: m.lockedBy ? (names.get(m.lockedBy) ?? null) : null,
    };
  }

  async update(id: string, input: MeetingUpdate) {
    const u = meetingUpdate.parse(input);
    const m = await this.find(id);
    this.assertRuns(m);
    const notes = u.notes ? { ...(m.notes as Record<string, string>), ...u.notes } : undefined;
    const attendance = u.attendance
      ? Object.fromEntries(Object.entries({ ...(m.attendance as Record<string, string | null>), ...u.attendance }).filter(([, v]) => v !== null))
      : undefined;
    const recognitions = u.recognitions?.map((r) => ({ ...r, by: this.tenant.userId ?? "" }));
    await this.tenant.db.meeting.update({
      where: { id },
      data: { ...(notes && { notes }), ...(attendance && { attendance }), ...(recognitions && { recognitions }) },
    });
    return this.meeting(id);
  }

  /** Locked: the figures are kept as they are now; open commitments it should have reviewed are carried forward. */
  async lock(id: string) {
    const m = await this.find(id);
    if (m.status === "locked") throw new ConflictException("It is already locked.");
    const view = await this.meeting(id);
    const unmarked = view.toReview.filter((c) => !c.history.some((h) => h.meeting === m.title && h.at >= m.startsAt.toISOString().slice(0, 10)));
    await this.tenant.tx(async (tx) => {
      await tx.meeting.update({
        where: { id },
        data: { status: "locked", lockedAt: new Date(), lockedBy: this.tenant.userId ?? null, snapshot: view.figures as unknown as Prisma.InputJsonValue },
      });
      for (const c of unmarked) {
        const row = await tx.commitment.findUnique({ where: { id: c.id } });
        if (!row) continue;
        const history = [
          ...(row.history as Mark[]),
          { mark: "BD" as const, note: "Not reviewed — carried forward", at: new Date().toISOString(), meetingId: id, meeting: m.title },
        ];
        await tx.commitment.update({ where: { id: c.id }, data: { carried: { increment: 1 }, history } });
      }
      await this.audit.record(tx, { action: "approve", entity: "meeting", entityId: id, after: { title: m.title, carried: unmarked.length } });
    });
    return this.meeting(id);
  }

  // ─── Commitments ────────────────────────────────────────────────────

  async commitments(filter: { status?: "open" | "done"; mine?: boolean }): Promise<CommitmentRow[]> {
    const me = this.tenant.userId ?? "";
    const rows = await this.tenant.db.commitment.findMany({
      where: { ...(filter.status && { status: filter.status }), ...(filter.mine || !this.may("view") ? { ownerId: me } : {}) },
      include: { meeting: { select: { id: true, title: true } } },
      orderBy: [{ status: "desc" }, { due: "asc" }],
      take: 500,
    });
    const names = await this.names(rows.map((r) => r.ownerId));
    return rows.map((c) => this.presentCommitment(c, names));
  }

  async commit(input: CommitmentInput) {
    const c = commitmentInput.parse(input);
    if (c.meetingId) this.assertRuns(await this.find(c.meetingId));
    else if (!this.may("edit")) throw new ForbiddenException("Commitments are made in reviews, or by those who keep them.");
    if (!(await this.tenant.db.membership.findFirst({ where: { agencyId: this.tenant.agencyId, userId: c.ownerId }, select: { id: true } })))
      throw new BadRequestException({ message: "Choose someone in your team.", issues: [{ path: "ownerId", message: "Choose who owns it" }] });
    const row = await this.tenant.tx(async (tx) => {
      const created = await tx.commitment.create({
        data: {
          agencyId: this.tenant.agencyId,
          meetingId: c.meetingId ?? null,
          text: c.text,
          ownerId: c.ownerId,
          due: utc(c.due),
          createdBy: this.tenant.userId ?? null,
        },
      });
      await this.audit.record(tx, { action: "create", entity: "commitment", entityId: created.id, after: { text: c.text, due: c.due } });
      await this.notifications.notify(
        tx,
        { users: [c.ownerId] },
        { kind: "commitment_assigned", title: `Your commitment, by ${c.due}: ${c.text}`, link: "/app/reviews?tab=commitments" },
      );
      return created;
    });
    return (await this.commitments({})).find((x) => x.id === row.id) ?? (await this.one(row.id));
  }

  private async one(id: string) {
    const c = await this.tenant.db.commitment.findFirst({ where: { id }, include: { meeting: { select: { id: true, title: true } } } });
    if (!c) throw new NotFoundException("No commitment with that id.");
    return this.presentCommitment(c, await this.names([c.ownerId]));
  }

  /** In a review: breakthrough (done) or breakdown (carried forward, with what got in the way). */
  async mark(id: string, input: z.input<typeof commitmentMark>) {
    const k = commitmentMark.parse(input);
    const c = await this.tenant.db.commitment.findFirst({ where: { id } });
    if (!c) throw new NotFoundException("No commitment with that id.");
    const meeting = k.meetingId ? await this.find(k.meetingId) : null;
    if (meeting) this.assertRuns(meeting);
    else if (!this.may("edit")) throw new ForbiddenException("Commitments are marked in reviews.");
    if (c.status === "done") throw new ConflictException("It is done.");
    const history = [
      ...(c.history as Mark[]),
      { mark: k.mark, note: k.note, at: new Date().toISOString(), meetingId: meeting?.id ?? null, meeting: meeting?.title ?? null },
    ];
    await this.tenant.tx(async (tx) => {
      await tx.commitment.update({
        where: { id },
        data:
          k.mark === "BT"
            ? { status: "done", mark: "BT", markNote: k.note || null, doneAt: new Date(), history }
            : { mark: "BD", markNote: k.note, carried: { increment: 1 }, history, ...(k.due && { due: utc(k.due) }) },
      });
      await this.audit.record(tx, { action: "update", entity: "commitment", entityId: id, after: { mark: k.mark, note: k.note } });
    });
    return this.one(id);
  }

  /** The owner marks their own commitment done between reviews. */
  async done(id: string) {
    const c = await this.tenant.db.commitment.findFirst({ where: { id } });
    if (!c || !(c.ownerId === this.tenant.userId || this.may("edit"))) throw new NotFoundException("No commitment of yours with that id.");
    if (c.status === "done") throw new ConflictException("It is done.");
    const history = [...(c.history as Mark[]), { mark: "BT" as const, note: "Done", at: new Date().toISOString(), meetingId: null, meeting: null }];
    await this.tenant.tx(async (tx) => {
      await tx.commitment.update({ where: { id }, data: { status: "done", mark: "BT", doneAt: new Date(), history } });
      await this.audit.record(tx, { action: "update", entity: "commitment", entityId: id, after: { done: true } });
    });
    return this.one(id);
  }

  // ─── Decisions ──────────────────────────────────────────────────────

  async decisions(): Promise<DecisionRow[]> {
    if (!this.may("view")) return [];
    const rows = await this.tenant.db.decision.findMany({
      include: { meeting: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    const names = await this.names(rows.flatMap((d) => [d.ownerId, d.createdBy]));
    return rows.map((d) => this.presentDecision(d, names));
  }

  async decide(input: DecisionInput) {
    const d = decisionInput.parse(input);
    if (d.meetingId) this.assertRuns(await this.find(d.meetingId));
    else if (!this.may("edit")) throw new ForbiddenException("Decisions are recorded by those who keep reviews.");
    const row = await this.tenant.tx(async (tx) => {
      const created = await tx.decision.create({
        data: { agencyId: this.tenant.agencyId, meetingId: d.meetingId ?? null, text: d.text, ownerId: d.ownerId, createdBy: this.tenant.userId ?? null },
      });
      await this.audit.record(tx, { action: "create", entity: "decision", entityId: created.id, after: { text: d.text } });
      return created;
    });
    return (await this.decisions()).find((x) => x.id === row.id)!;
  }

  // ─── Reading ────────────────────────────────────────────────────────

  private presentCommitment(c: CommitmentWith, names: Map<string, string>): CommitmentRow {
    const history = (c.history as Mark[]).slice().reverse();
    return {
      id: c.id,
      text: c.text,
      owner: { id: c.ownerId ?? "", name: names.get(c.ownerId ?? "") ?? "" },
      due: c.due ? day(c.due) : "",
      status: c.status as CommitmentRow["status"],
      mark: (c.mark as CommitmentMark | null) ?? null,
      markNote: c.markNote,
      carried: c.carried,
      madeIn: c.meeting,
      doneAt: c.doneAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      history: history.map((h) => ({ mark: h.mark, note: h.note, at: h.at, meeting: h.meeting ?? null })),
    };
  }

  private presentDecision(
    d: Prisma.DecisionGetPayload<{ include: { meeting: { select: { id: true; title: true } } } }>,
    names: Map<string, string>,
  ): DecisionRow {
    return {
      id: d.id,
      text: d.text,
      owner: d.ownerId ? { id: d.ownerId, name: names.get(d.ownerId) ?? "" } : null,
      madeIn: d.meeting,
      decidedAt: d.createdAt.toISOString(),
      by: d.createdBy ? (names.get(d.createdBy) ?? null) : null,
    };
  }
}
