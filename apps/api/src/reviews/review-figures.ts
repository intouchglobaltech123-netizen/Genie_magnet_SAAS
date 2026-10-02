import { Injectable } from "@nestjs/common";
import { type FigureBlock, GOAL_STATUS_LABEL, type GoalStatus, REVIEW_BLOCK_LABEL, type ReviewBlock } from "@gm/shared";
import { GoalMetrics } from "../goals/goal-metrics.js";
import { money as inr } from "../imports/check-report.js";
import { GoalsService } from "../goals/goals.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const DAY = 86_400_000;
const IST = 330 * 60_000;
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

/** The figures a review looks at (P5-14), as they are now. */
@Injectable()
export class ReviewFigures {
  constructor(
    private readonly tenant: TenantDb,
    private readonly metrics: GoalMetrics,
    private readonly goals: GoalsService,
  ) {}

  async blocks(keys: ReviewBlock[]): Promise<FigureBlock[]> {
    const today = new Date(Date.now() + IST).toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;
    const t = utc(today);
    const db = this.tenant.db;
    const out: FigureBlock[] = [];
    for (const key of keys) {
      const lines: FigureBlock["lines"] = [];
      switch (key) {
        case "videos_due": {
          const open = { stage: { notIn: ["approved", "published"] as ("approved" | "published")[] } };
          const [soon, late] = await Promise.all([
            db.video.count({ where: { ...open, dueDate: { gte: t, lte: new Date(t.getTime() + 2 * DAY) } } }),
            db.video.count({ where: { ...open, dueDate: { lt: t } } }),
          ]);
          lines.push(
            { label: "Due in the next two days", value: String(soon) },
            { label: "Past their due day", value: String(late), ...(late ? { tone: "bad" as const } : {}) },
          );
          break;
        }
        case "shoots_soon": {
          const shoots = await db.shoot.findMany({
            where: { date: { gte: t, lte: new Date(t.getTime() + DAY) }, status: { not: "closed" } },
            select: { title: true, date: true, client: { select: { name: true } } },
            orderBy: { date: "asc" },
          });
          if (!shoots.length) lines.push({ label: "Shoots", value: "None" });
          for (const s of shoots)
            lines.push({ label: s.date.toISOString().slice(0, 10) === today ? "Today" : "Tomorrow", value: `${s.title} · ${s.client.name}` });
          break;
        }
        case "on_leave": {
          const leave = await db.leaveRequest.findMany({ where: { status: "approved", from: { lte: t }, to: { gte: t } }, select: { userId: true } });
          const people = leave.length ? await db.user.findMany({ where: { id: { in: leave.map((l) => l.userId) } }, select: { name: true } }) : [];
          lines.push({ label: "On leave today", value: people.length ? people.map((p) => p.name).join(", ") : "No one" });
          break;
        }
        case "waiting_on_clients": {
          const waiting = await db.video.findMany({ where: { stage: "client_review" }, select: { id: true } });
          const since = waiting.length
            ? await db.videoStageChange.groupBy({
                by: ["videoId"],
                where: { videoId: { in: waiting.map((w) => w.id) }, to: "client_review" },
                _max: { at: true },
              })
            : [];
          const oldest = since.reduce((m, s) => (s._max.at && (!m || s._max.at < m) ? s._max.at : m), null as Date | null);
          const days = oldest ? Math.floor((Date.now() - oldest.getTime()) / DAY) : 0;
          lines.push({ label: "Waiting for the client", value: String(waiting.length) });
          if (oldest) lines.push({ label: "Longest wait", value: `${days} ${days === 1 ? "day" : "days"}`, ...(days > 3 ? { tone: "bad" as const } : {}) });
          break;
        }
        case "money": {
          const [invoiced, collected, overdue] = await Promise.all([
            this.metrics.figure("invoiced", monthStart, today),
            this.metrics.figure("collected", monthStart, today),
            db.invoice.aggregate({ where: { status: "sent", dueDate: { lt: t } }, _sum: { total: true }, _count: { _all: true } }),
          ]);
          lines.push(
            { label: "Invoiced this month, before GST", value: inr(invoiced) },
            { label: "Collected this month", value: inr(collected) },
            { label: "Overdue", value: `${inr(overdue._sum.total ?? 0)} (${overdue._count._all})`, ...(overdue._count._all ? { tone: "bad" as const } : {}) },
          );
          break;
        }
        case "sales": {
          const [leads, sent, won] = await Promise.all([
            this.metrics.figure("leads", monthStart, today),
            this.metrics.figure("proposals_sent", monthStart, today),
            this.metrics.figure("clients_won", monthStart, today),
          ]);
          lines.push(
            { label: "New leads this month", value: String(leads) },
            { label: "Proposals sent", value: String(sent) },
            { label: "Clients won", value: String(won) },
          );
          break;
        }
        case "delivery": {
          const changes = await db.videoStageChange.findMany({
            where: { at: { lt: new Date(t.getTime() + DAY) }, OR: [{ to: "approved" }, { from: "internal_qc" }] },
            select: { videoId: true, from: true, to: true, at: true, video: { select: { dueDate: true } } },
            orderBy: { at: "asc" },
          });
          const start = new Date(utc(monthStart).getTime() - IST);
          const firstApproval = new Map<string, (typeof changes)[number]>();
          for (const c of changes) if (c.to === "approved" && !firstApproval.has(c.videoId)) firstApproval.set(c.videoId, c);
          const approved = [...firstApproval.values()].filter((c) => c.at >= start);
          const dated = approved.filter((c) => c.video.dueDate);
          const onTime = dated.filter((c) => new Date(c.at.getTime() + IST).toISOString().slice(0, 10) <= c.video.dueDate!.toISOString().slice(0, 10)).length;
          const byVideo = new Map<string, typeof changes>();
          for (const c of changes) byVideo.set(c.videoId, [...(byVideo.get(c.videoId) ?? []), c]);
          let passed = 0;
          let first = 0;
          for (const cs of byVideo.values()) {
            const pass = cs.find((c) => c.from === "internal_qc" && c.to !== "editing");
            if (!pass || pass.at < start) continue;
            passed += 1;
            if (!cs.some((c) => c.from === "internal_qc" && c.to === "editing" && c.at < pass.at)) first += 1;
          }
          lines.push(
            { label: "Approved by clients this month", value: String(approved.length) },
            { label: "On or before the due day", value: pct(onTime, dated.length) },
            { label: "Quality check passed first time", value: pct(first, passed) },
          );
          break;
        }
        case "goals": {
          const goals = await this.goals.list();
          const count = (s: GoalStatus) => goals.filter((g) => g.status === s).length;
          for (const s of ["on_track", "at_risk", "off_track", "done"] as const)
            lines.push({ label: GOAL_STATUS_LABEL[s], value: String(count(s)), ...(s === "off_track" && count(s) ? { tone: "bad" as const } : {}) });
          break;
        }
        case "sop_failures": {
          const since = new Date(utc(monthStart).getTime() - IST);
          const [failed, waiting] = await Promise.all([
            db.sopRun.findMany({ where: { status: "failed", createdAt: { gte: since } }, select: { sop: { select: { title: true } } } }),
            db.sopRun.count({ where: { status: "submitted" } }),
          ]);
          lines.push({ label: "Failed this month", value: String(failed.length), ...(failed.length ? { tone: "bad" as const } : {}) });
          const bySop = new Map<string, number>();
          for (const f of failed) bySop.set(f.sop.title, (bySop.get(f.sop.title) ?? 0) + 1);
          for (const [title, n] of [...bySop.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) lines.push({ label: title, value: String(n) });
          lines.push({ label: "Waiting to be checked", value: String(waiting) });
          break;
        }
        case "commitments": {
          const [open, late, done] = await Promise.all([
            db.commitment.count({ where: { status: "open" } }),
            db.commitment.count({ where: { status: "open", due: { lt: t } } }),
            db.commitment.count({ where: { status: "done", doneAt: { gte: new Date(utc(monthStart).getTime() - IST) } } }),
          ]);
          lines.push(
            { label: "Open", value: String(open) },
            { label: "Past their due day", value: String(late), ...(late ? { tone: "bad" as const } : {}) },
            { label: "Done this month", value: String(done), tone: "good" },
          );
          break;
        }
      }
      out.push({ key, label: REVIEW_BLOCK_LABEL[key], lines });
    }
    return out;
  }
}
