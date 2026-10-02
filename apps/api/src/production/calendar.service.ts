import { BadRequestException, Injectable } from "@nestjs/common";
import { allows, type CalendarEvent, DONE_STAGES, PLATFORM_LABELS, scopeOf, type TimeEntryRow } from "@gm/shared";
import { TenantDb } from "../tenancy/tenant-context.js";

const DAY = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
/** India time for a moment: its day and HH:MM. */
const ist = (d: Date) => {
  const t = new Date(d.getTime() + 330 * 60_000).toISOString();
  return { date: t.slice(0, 10), time: t.slice(11, 16) };
};
const PLATFORM_LABEL: Record<string, string> = PLATFORM_LABELS;

/**
 * The production calendar and time (P2-13): shoots, videos due and to publish, scheduled posts, sales follow-ups
 * (P3-13) and agreements ending, by day; and the time logged on videos and shoots. Roles limited to their own work see only what they edit, shoot
 * or direct, and only their own time.
 */
@Injectable()
export class CalendarService {
  constructor(private readonly tenant: TenantDb) {}

  private range(from: string, to: string, maxDays: number) {
    const a = utc(from);
    const b = utc(to);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) throw new BadRequestException("Give a from and a to date, from first.");
    if ((b.getTime() - a.getTime()) / DAY > maxDays) throw new BadRequestException(`Ask for at most ${maxDays} days at a time.`);
    return { a, b };
  }

  private own() {
    return scopeOf(this.tenant.permissions, "production") === "own" ? this.tenant.userId : null;
  }

  async events(from: string, to: string): Promise<CalendarEvent[]> {
    const { a, b } = this.range(from, to, 62);
    const me = this.own();
    const perms = this.tenant.permissions;
    const client = { select: { id: true, name: true, code: true } };
    const events: CalendarEvent[] = [];

    if (allows(perms, "production", "view")) {
      const mine = me ? { OR: [{ editorId: me }, { cameraId: me }, { directorId: me }] } : {};
      const shoots = await this.tenant.db.shoot.findMany({
        where: { date: { gte: a, lte: b }, ...(me && { OR: [{ cameraId: me }, { directorId: me }, { videos: { some: { editorId: me } } }] }) },
        include: { client, _count: { select: { videos: true } } },
      });
      for (const s of shoots)
        events.push({
          kind: "shoot",
          date: day(s.date),
          time: s.callTime,
          title: s.title,
          detail: [s.location, s._count.videos === 1 ? "1 video" : `${s._count.videos} videos`].filter(Boolean).join(" · "),
          client: s.client,
          link: `/app/shoots/${s.id}`,
          state: s.status === "closed" || s.status === "returned" ? "done" : "open",
        });
      const today = day(new Date());
      const due = await this.tenant.db.video.findMany({ where: { dueDate: { gte: a, lte: b }, ...mine }, include: { client } });
      for (const v of due)
        events.push({
          kind: "due",
          date: day(v.dueDate!),
          time: null,
          title: `${v.code} due`,
          detail: v.title,
          client: v.client,
          link: `/app/production/${v.id}`,
          state: DONE_STAGES.includes(v.stage as never) ? "done" : day(v.dueDate!) < today ? "late" : "open",
        });
      const publish = await this.tenant.db.video.findMany({ where: { publishDate: { gte: a, lte: b }, ...mine }, include: { client } });
      for (const v of publish)
        events.push({
          kind: "publish",
          date: day(v.publishDate!),
          time: null,
          title: `${v.code} to publish`,
          detail: v.title,
          client: v.client,
          link: `/app/production/${v.id}`,
          state: v.stage === "published" ? "done" : "open",
        });
    }

    if (allows(perms, "publishing", "view")) {
      // Posts are kept in UTC; the calendar shows India's day, so look a day either side.
      const posts = await this.tenant.db.scheduledPost.findMany({
        where: { scheduledAt: { gte: new Date(a.getTime() - DAY), lt: new Date(b.getTime() + 2 * DAY) } },
        include: { video: { select: { id: true, code: true, title: true, client } }, connection: { select: { platform: true, handle: true } } },
      });
      for (const p of posts) {
        const when = ist(p.publishedAt ?? p.scheduledAt);
        if (when.date < from || when.date > to) continue;
        events.push({
          kind: "post",
          date: when.date,
          time: when.time,
          title: `${p.video.code} on ${PLATFORM_LABEL[p.connection.platform] ?? p.connection.platform}`,
          detail: p.connection.handle,
          client: p.video.client,
          link: "/app/publishing",
          state: p.status === "published" ? "done" : "open",
        });
      }
    }

    if (allows(perms, "crm", "view")) {
      // Sales follow-ups on open leads; roles that keep their own leads see only theirs.
      const stages = await this.tenant.db.pipelineStage.findMany({ where: { kind: "open" }, select: { key: true } });
      const own = scopeOf(perms, "crm") === "own" ? this.tenant.userId : null;
      const leads = await this.tenant.db.lead.findMany({
        where: { nextFollowUp: { gte: a, lte: b }, stage: { in: stages.map((s) => s.key) }, ...(own && { ownerId: own }) },
        select: { id: true, name: true, company: true, nextFollowUp: true },
      });
      const today = day(new Date());
      for (const l of leads)
        events.push({
          kind: "followup",
          date: day(l.nextFollowUp!),
          time: null,
          title: `Follow up ${l.company ?? l.name}`,
          detail: l.company ? l.name : null,
          client: null,
          link: `/app/sales?lead=${l.id}`,
          state: day(l.nextFollowUp!) < today ? "late" : "open",
        });
    }

    if (allows(perms, "agreements", "view")) {
      const ending = await this.tenant.db.agreement.findMany({
        where: { endDate: { gte: a, lte: b }, status: { in: ["active", "renewal_due", "paused"] } },
        include: { client },
      });
      for (const g of ending)
        events.push({
          kind: "renewal",
          date: day(g.endDate),
          time: null,
          title: `${g.title} ends`,
          detail: null,
          client: g.client,
          link: `/app/clients/${g.clientId}`,
          state: "open",
        });
    }

    const order = { shoot: 0, post: 1, followup: 2, due: 3, publish: 4, renewal: 5 };
    return events.sort((x, y) => x.date.localeCompare(y.date) || (x.time ?? "99").localeCompare(y.time ?? "99") || order[x.kind] - order[y.kind]);
  }

  /** Time logged on videos and shoots between two days, newest first. */
  async time(from: string, to: string): Promise<TimeEntryRow[]> {
    const { a, b } = this.range(from, to, 93);
    const me = this.own();
    const where = { date: { gte: a, lte: b }, ...(me && { userId: me }) };
    const client = { select: { name: true } };
    const [videoLogs, shootLogs] = await Promise.all([
      this.tenant.db.videoTimeLog.findMany({ where, include: { video: { select: { id: true, code: true, title: true, client } } } }),
      this.tenant.db.shootTimeLog.findMany({ where, include: { shoot: { select: { id: true, title: true, client } } } }),
    ]);
    const ids = [...new Set([...videoLogs, ...shootLogs].map((l) => l.userId))];
    const people = ids.length ? await this.tenant.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const names = new Map(people.map((p) => [p.id, p.name]));
    const who = (id: string) => ({ id, name: names.get(id) ?? null });
    return [
      ...videoLogs.map((l) => ({
        id: l.id,
        date: day(l.date),
        minutes: l.minutes,
        note: l.note,
        by: who(l.userId),
        on: { kind: "video" as const, id: l.video.id, label: `${l.video.code} · ${l.video.title}`, client: l.video.client.name },
        at: l.createdAt,
      })),
      ...shootLogs.map((l) => ({
        id: l.id,
        date: day(l.date),
        minutes: l.minutes,
        note: l.note,
        by: who(l.userId),
        on: { kind: "shoot" as const, id: l.shoot.id, label: l.shoot.title, client: l.shoot.client.name },
        at: l.createdAt,
      })),
    ]
      .sort((x, y) => y.date.localeCompare(x.date) || y.at.getTime() - x.at.getTime())
      .map(({ at: _at, ...row }) => row);
  }
}
