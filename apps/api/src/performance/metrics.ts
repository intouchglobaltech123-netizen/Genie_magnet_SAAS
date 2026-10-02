import { Injectable } from "@nestjs/common";
import type { KraMetric } from "@gm/shared";
import { AttendanceService } from "../people/attendance.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

/** India's offset from UTC: a month runs from midnight to midnight in India. */
const IST = 330 * 60_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The figures the app knows for a person's month (P5-11), so KRAs on them fill in by themselves: videos the client
 * approved with them as editor (and how many on time, and the revision rounds), the quality check passed first time,
 * shoots done, hours logged and attendance.
 */
@Injectable()
export class PerformanceMetrics {
  constructor(
    private readonly tenant: TenantDb,
    private readonly attendance: AttendanceService,
  ) {}

  async forMonth(userId: string, month: string, wanted: KraMetric[]): Promise<Partial<Record<KraMetric, number | null>>> {
    if (!wanted.length) return {};
    const [y, m] = month.split("-").map(Number) as [number, number];
    const start = new Date(Date.UTC(y, m - 1, 1) - IST);
    const end = new Date(Date.UTC(y, m, 1) - IST);
    const out: Partial<Record<KraMetric, number | null>> = {};
    const has = (k: KraMetric) => wanted.includes(k);

    if (has("videos_approved") || has("on_time") || has("revisions") || has("qc_first_pass")) {
      const changes = await this.tenant.db.videoStageChange.findMany({
        where: { at: { lt: end }, video: { editorId: userId } },
        select: { videoId: true, from: true, to: true, at: true, video: { select: { dueDate: true, revisionsUsed: true } } },
        orderBy: { at: "asc" },
      });
      const byVideo = new Map<string, typeof changes>();
      for (const c of changes) byVideo.set(c.videoId, [...(byVideo.get(c.videoId) ?? []), c]);

      // Approved by the client: the first approval of each video, when it falls in the month.
      const approved = [...byVideo.values()].map((cs) => cs.find((c) => c.to === "approved")).filter((c) => !!c && c.at >= start);
      out.videos_approved = approved.length;
      const dated = approved.filter((c) => c!.video.dueDate);
      out.on_time = dated.length
        ? round1(
            (dated.filter((c) => new Date(c!.at.getTime() + IST).toISOString().slice(0, 10) <= c!.video.dueDate!.toISOString().slice(0, 10)).length /
              dated.length) *
              100,
          )
        : null;
      out.revisions = approved.length ? round1(approved.reduce((s, c) => s + c!.video.revisionsUsed, 0) / approved.length) : null;

      // The quality check: each video's first pass out of it in the month, and whether it ever failed before.
      let passed = 0;
      let first = 0;
      for (const cs of byVideo.values()) {
        const pass = cs.find((c) => c.from === "internal_qc" && c.to !== "editing");
        if (!pass || pass.at < start) continue;
        passed += 1;
        if (!cs.some((c) => c.from === "internal_qc" && c.to === "editing" && c.at < pass.at)) first += 1;
      }
      out.qc_first_pass = passed ? round1((first / passed) * 100) : null;
    }

    if (has("shoots_closed")) {
      const from = new Date(Date.UTC(y, m - 1, 1));
      const to = new Date(Date.UTC(y, m, 1));
      out.shoots_closed = await this.tenant.db.shoot.count({
        where: { date: { gte: from, lt: to }, status: "closed", OR: [{ cameraId: userId }, { directorId: userId }] },
      });
    }

    if (has("hours_logged")) {
      const where = { userId, date: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) } };
      const [v, s] = await Promise.all([
        this.tenant.db.videoTimeLog.aggregate({ where, _sum: { minutes: true } }),
        this.tenant.db.shootTimeLog.aggregate({ where, _sum: { minutes: true } }),
      ]);
      out.hours_logged = round1(((v._sum.minutes ?? 0) + (s._sum.minutes ?? 0)) / 60);
    }

    if (has("attendance")) {
      const a = await this.attendance.month(month, true);
      const days = Object.values(a.people.find((p) => p.user.id === userId)?.days ?? {});
      const counted = days.filter((d) => ["present", "late", "half_day", "absent"].includes(d.status));
      const credit = counted.reduce((s, d) => s + (d.status === "half_day" ? 0.5 : d.status === "absent" ? 0 : 1), 0);
      out.attendance = counted.length ? round1((credit / counted.length) * 100) : null;
    }
    return out;
  }
}
