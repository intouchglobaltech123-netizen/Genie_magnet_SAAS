import type { TenantTx } from "@gm/db";
import {
  type AreaKey,
  DONE_STAGES,
  type GenieRuleKey,
  type InsightSeverity,
  type PermissionLevel,
  VIDEO_STAGE_LABEL,
  type VideoStageKey,
  windowOf,
} from "@gm/shared";

const DAY = 86_400_000;
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysSince = (d: Date, now: Date) => Math.floor((now.getTime() - d.getTime()) / DAY);
const fmt = (d: string) => utc(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const monthName = (m: string) => utc(`${m}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const RUNNING = ["active", "renewal_due", "paused"] as const;

/** One thing a rule found. `key` makes it unique within the rule, so it is raised once however often the rule runs. */
export interface Finding {
  key: string;
  severity: InsightSeverity;
  title: string;
  body?: string;
  entity?: string;
  entityId?: string;
  clientId?: string | null;
  link?: string;
  /** Who should act on it. */
  ownerId?: string | null;
  evidence: Record<string, unknown>;
}

export interface RuleContext {
  tx: TenantTx;
  threshold: number;
  now: Date;
  /** Today, YYYY-MM-DD (UTC). */
  today: string;
  agency: { windowDays: number };
  kits: { key: string; items: string[] }[];
}

export interface Rule {
  find(ctx: RuleContext): Promise<Finding[]>;
  /** Who hears of a new finding, besides whoever should act on it; false when another morning check already tells them. */
  notify: { area: AreaKey; level: Exclude<PermissionLevel, "none"> } | false;
}

/** The team's own steps: a video waiting here is waiting on the agency, not the client. */
const TEAM_STEPS: VideoStageKey[] = ["shot", "editing", "internal_qc", "revision"];

const videoStuck: Rule = {
  notify: { area: "production", level: "approve" },
  async find({ tx, threshold, now }) {
    const videos = await tx.video.findMany({
      where: { stage: { in: TEAM_STEPS } },
      select: {
        id: true,
        code: true,
        title: true,
        stage: true,
        editorId: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
        stageChanges: { orderBy: { at: "desc" }, take: 1, select: { at: true } },
      },
    });
    return videos.flatMap((v) => {
      const since = v.stageChanges[0]?.at ?? v.createdAt;
      const days = daysSince(since, now);
      if (days < threshold) return [];
      const step = VIDEO_STAGE_LABEL[v.stage as VideoStageKey];
      return [
        {
          key: `${v.id}:${v.stage}`,
          severity: days >= threshold * 2 ? "critical" : "warning",
          title: `${v.code} has been in ${step} for ${plural(days, "day")}`,
          body: `“${v.title}” for ${v.client.name}.`,
          entity: "video",
          entityId: v.id,
          clientId: v.client.id,
          link: `/app/production/${v.id}`,
          ownerId: v.editorId,
          evidence: { code: v.code, stage: v.stage, since: since.toISOString(), days },
        },
      ];
    });
  },
};

const revisionLoop: Rule = {
  notify: { area: "production", level: "approve" },
  async find({ tx, threshold }) {
    const videos = await tx.video.findMany({
      where: { stage: { notIn: ["approved", "published"] }, revisionsUsed: { gt: 0 }, agreementId: { not: null } },
      select: {
        id: true,
        code: true,
        title: true,
        revisionsUsed: true,
        editorId: true,
        client: { select: { id: true, name: true } },
        agreement: { select: { revisionsPerDeliverable: true } },
      },
    });
    return videos.flatMap((v) => {
      const allowed = v.agreement?.revisionsPerDeliverable ?? 0;
      if (v.revisionsUsed <= allowed + threshold) return [];
      return [
        {
          key: v.id,
          severity: "warning",
          title: `${v.code} is on revision ${v.revisionsUsed} — the agreement allows ${allowed}`,
          body: `“${v.title}” for ${v.client.name}. Agree the extra changes with the client, or treat them as a change request.`,
          entity: "video",
          entityId: v.id,
          clientId: v.client.id,
          link: `/app/production/${v.id}`,
          ownerId: v.editorId,
          evidence: { code: v.code, revisionsUsed: v.revisionsUsed, allowed },
        },
      ];
    });
  },
};

const clientWaiting: Rule = {
  notify: { area: "clients", level: "edit" },
  async find({ tx, threshold, now }) {
    const before = new Date(now.getTime() - threshold * DAY);
    const client = { select: { id: true, name: true, accountOwnerId: true } } as const;
    const [versions, scripts, lists] = await Promise.all([
      tx.videoVersion.findMany({
        where: { status: "sent", sentAt: { lte: before }, video: { stage: "client_review" } },
        select: { id: true, label: true, sentAt: true, video: { select: { id: true, code: true, title: true, client } } },
      }),
      tx.scriptVersion.findMany({
        where: { status: "sent", sentAt: { lte: before }, contentItem: { stage: "approval" } },
        select: { id: true, number: true, sentAt: true, contentItem: { select: { id: true, title: true, client } } },
      }),
      tx.topicList.findMany({ where: { status: "sent", sentAt: { lte: before } }, select: { id: true, month: true, sentAt: true, clientId: true } }),
    ]);
    const listClients = lists.length
      ? await tx.client.findMany({ where: { id: { in: lists.map((l) => l.clientId) } }, select: { id: true, name: true, accountOwnerId: true } })
      : [];
    const severity = (days: number): InsightSeverity => (days >= threshold * 2 ? "critical" : "warning");
    return [
      ...versions.map((v) => {
        const days = daysSince(v.sentAt!, now);
        return {
          key: `version:${v.id}`,
          severity: severity(days),
          title: `${v.video.client.name} has had ${v.video.code} (${v.label}) for ${plural(days, "day")}`,
          body: `“${v.video.title}” waits for their approval.`,
          entity: "video",
          entityId: v.video.id,
          clientId: v.video.client.id,
          link: `/app/production/${v.video.id}`,
          ownerId: v.video.client.accountOwnerId,
          evidence: { what: "video", code: v.video.code, version: v.label, sentAt: v.sentAt!.toISOString(), days },
        };
      }),
      ...scripts.map((s) => {
        const days = daysSince(s.sentAt!, now);
        return {
          key: `script:${s.id}`,
          severity: severity(days),
          title: `${s.contentItem.client.name} has had the script for “${s.contentItem.title}” for ${plural(days, "day")}`,
          body: `Version ${s.number} waits for their approval.`,
          entity: "content",
          entityId: s.contentItem.id,
          clientId: s.contentItem.client.id,
          link: `/app/content/${s.contentItem.id}`,
          ownerId: s.contentItem.client.accountOwnerId,
          evidence: { what: "script", title: s.contentItem.title, version: s.number, sentAt: s.sentAt!.toISOString(), days },
        };
      }),
      ...lists.flatMap((l) => {
        const c = listClients.find((x) => x.id === l.clientId);
        if (!c) return [];
        const days = daysSince(l.sentAt!, now);
        const month = iso(l.month).slice(0, 7);
        return [
          {
            key: `topics:${l.id}`,
            severity: severity(days),
            title: `${c.name} has not picked ${monthName(month)} topics for ${plural(days, "day")}`,
            entity: "topic_list",
            entityId: l.id,
            clientId: c.id,
            link: `/app/content?month=${month}`,
            ownerId: c.accountOwnerId,
            evidence: { what: "topics", month, sentAt: l.sentAt!.toISOString(), days },
          },
        ];
      }),
    ];
  },
};

const behindQuota: Rule = {
  notify: { area: "production", level: "approve" },
  async find({ tx, threshold, today }) {
    if (Number(today.slice(8, 10)) < threshold) return [];
    const month = today.slice(0, 7);
    const cycles = await tx.cycle.findMany({
      where: { month: utc(`${month}-01`), status: { not: "closed" }, promised: { gt: 0 } },
      select: { id: true, promised: true, carriedIn: true, agreement: { select: { client: { select: { id: true, name: true, accountOwnerId: true } } } } },
    });
    if (!cycles.length) return [];
    const delivered = await tx.video.groupBy({
      by: ["cycleId"],
      where: { cycleId: { in: cycles.map((c) => c.id) }, stage: { in: [...DONE_STAGES] } },
      _count: { _all: true },
    });
    const done = new Map(delivered.map((d) => [d.cycleId, d._count._all]));
    return cycles.flatMap((c) => {
      const promised = c.promised + c.carriedIn;
      const got = done.get(c.id) ?? 0;
      if ((promised - got) / promised <= 0.5) return [];
      const client = c.agreement.client;
      return [
        {
          key: `${c.id}`,
          severity: "warning",
          title: `${client.name}: ${got} of ${promised} videos delivered for ${monthName(month)}`,
          body: "More than half of the month's videos are still to come.",
          entity: "cycle",
          entityId: c.id,
          clientId: client.id,
          link: `/app/cycles?month=${month}`,
          ownerId: client.accountOwnerId,
          evidence: { month, promised, delivered: got },
        },
      ];
    });
  },
};

const reportDue: Rule = {
  notify: { area: "clients", level: "edit" },
  async find({ tx, threshold, today }) {
    if (Number(today.slice(8, 10)) < threshold) return [];
    const thisMonth = utc(`${today.slice(0, 7)}-01`);
    const start = new Date(thisMonth);
    start.setUTCMonth(start.getUTCMonth() - 1);
    const month = iso(start).slice(0, 7);
    const end = new Date(thisMonth.getTime() - DAY);
    const agreements = await tx.agreement.findMany({
      where: { status: { in: [...RUNNING] }, startDate: { lte: end }, endDate: { gte: start } },
      select: { client: { select: { id: true, name: true, accountOwnerId: true, archivedAt: true } } },
    });
    const released = await tx.monthlyReport.findMany({ where: { month: start, status: "released" }, select: { clientId: true } });
    const done = new Set(released.map((r) => r.clientId));
    const seen = new Set<string>();
    return agreements.flatMap(({ client }) => {
      if (client.archivedAt || done.has(client.id) || seen.has(client.id)) return [];
      seen.add(client.id);
      return [
        {
          key: `${client.id}:${month}`,
          severity: "warning",
          title: `${client.name}'s ${monthName(month)} report is not released yet`,
          entity: "client",
          entityId: client.id,
          clientId: client.id,
          link: `/app/reports?month=${month}`,
          ownerId: client.accountOwnerId,
          evidence: { month },
        },
      ];
    });
  },
};

const invoiceOverdue: Rule = {
  // The morning checks already tell finance the day an invoice becomes overdue.
  notify: false,
  async find({ tx, threshold, today, now }) {
    const before = new Date(utc(today).getTime() - threshold * DAY);
    const invoices = await tx.invoice.findMany({
      where: { status: "sent", dueDate: { lte: before } },
      select: { id: true, number: true, total: true, dueDate: true, client: { select: { id: true, name: true } } },
    });
    if (!invoices.length) return [];
    const paid = await tx.payment.groupBy({ by: ["invoiceId"], where: { invoiceId: { in: invoices.map((i) => i.id) } }, _sum: { amount: true } });
    const paidBy = new Map(paid.map((p) => [p.invoiceId, p._sum.amount ?? 0]));
    return invoices.flatMap((i) => {
      const owed = i.total - (paidBy.get(i.id) ?? 0);
      if (owed <= 0) return [];
      const days = daysSince(i.dueDate!, now);
      return [
        {
          key: i.id,
          severity: days > 30 ? "critical" : "warning",
          title: `${i.number ?? "An invoice"} · ${i.client.name}: ${money(owed)} is ${plural(days, "day")} overdue`,
          body: `It was due on ${fmt(iso(i.dueDate!))}.`,
          entity: "invoice",
          entityId: i.id,
          clientId: i.client.id,
          link: `/app/invoices/${i.id}`,
          evidence: { number: i.number, owed, dueDate: iso(i.dueDate!), days },
        },
      ];
    });
  },
};

const editorLoad: Rule = {
  notify: { area: "production", level: "approve" },
  async find({ tx, threshold }) {
    const counts = await tx.video.groupBy({ by: ["editorId"], where: { editorId: { not: null }, stage: { in: TEAM_STEPS } }, _count: { _all: true } });
    const over = counts.filter((c) => c._count._all > threshold);
    if (!over.length) return [];
    const people = await tx.user.findMany({ where: { id: { in: over.map((c) => c.editorId!) } }, select: { id: true, name: true } });
    return over.map((c) => {
      const name = people.find((p) => p.id === c.editorId)?.name ?? "An editor";
      return {
        key: c.editorId!,
        severity: c._count._all > threshold * 1.5 ? "critical" : "warning",
        title: `${name} has ${c._count._all} videos in hand`,
        body: `More than ${threshold}: share some out, or move due dates.`,
        entity: "user",
        entityId: c.editorId!,
        link: `/app/production?editorId=${c.editorId}`,
        evidence: { videos: c._count._all, limit: threshold },
      } satisfies Finding;
    });
  },
};

const shootReadiness: Rule = {
  notify: { area: "production", level: "approve" },
  async find({ tx, threshold, today, kits }) {
    const until = new Date(utc(today).getTime() + threshold * DAY);
    const shoots = await tx.shoot.findMany({
      where: { date: { gte: utc(today), lte: until }, status: "planned" },
      select: {
        id: true,
        title: true,
        date: true,
        kit: true,
        kitTicks: true,
        cameraId: true,
        directorId: true,
        createdBy: true,
        client: { select: { id: true, name: true } },
      },
    });
    return shoots.flatMap((s) => {
      const items = kits.find((k) => k.key === s.kit)?.items ?? [];
      const ticks = s.kitTicks as Record<string, { packed?: boolean }>;
      const unpacked = items.filter((i) => !ticks[i]?.packed).length;
      const day = iso(s.date);
      const soon = (utc(day).getTime() - utc(today).getTime()) / DAY <= 1;
      const missing = [...(s.cameraId ? [] : ["no camera person"]), ...(unpacked && soon ? [`${plural(unpacked, "kit item")} not packed`] : [])];
      if (!missing.length) return [];
      return [
        {
          key: s.id,
          severity: soon ? "critical" : "warning",
          title: `${s.title} on ${fmt(day)}: ${missing.join(", ")}`,
          body: `For ${s.client.name}.`,
          entity: "shoot",
          entityId: s.id,
          clientId: s.client.id,
          link: `/app/shoots/${s.id}`,
          ownerId: s.directorId ?? s.createdBy,
          evidence: { date: day, camera: !!s.cameraId, unpacked },
        } satisfies Finding,
      ];
    });
  },
};

const clientHealth: Rule = {
  notify: { area: "clients", level: "edit" },
  async find({ tx, threshold }) {
    const clients = await tx.client.findMany({
      where: { archivedAt: null, health: { lt: threshold } },
      select: { id: true, name: true, health: true, accountOwnerId: true },
    });
    return clients.map((c) => ({
      key: c.id,
      severity: c.health! < threshold - 20 ? "critical" : "warning",
      title: `${c.name}'s health is ${c.health}`,
      body: `Below ${threshold}: look at what is late for them, and talk to them.`,
      entity: "client",
      entityId: c.id,
      clientId: c.id,
      link: `/app/clients/${c.id}`,
      ownerId: c.accountOwnerId,
      evidence: { health: c.health, below: threshold },
    }));
  },
};

const onboardingIncomplete: Rule = {
  // The morning checks already tell whoever looks after the client the day it goes past its window.
  notify: false,
  async find({ tx, threshold, today, agency }) {
    const rows = await tx.questionnaireResponse.findMany({
      where: { clientId: { not: null }, sentAt: { not: null }, completedAt: null },
      select: { id: true, sentAt: true, requiredDoneAt: true, exceptionAt: true, client: { select: { id: true, name: true, accountOwnerId: true } } },
    });
    return rows.flatMap((r) => {
      const { day } = windowOf(r.sentAt!.toISOString(), agency.windowDays, false, today);
      if (day === null || day <= agency.windowDays + threshold || !r.client) return [];
      const late = day - agency.windowDays;
      const required = !r.requiredDoneAt && !r.exceptionAt;
      return [
        {
          key: r.id,
          severity: required ? "critical" : "warning",
          title: `${r.client.name}'s onboarding is ${plural(late, "day")} past its window`,
          body: required ? "The required part is not finished, so work waits on it." : "The required part is done; the rest is still open.",
          entity: "onboarding",
          entityId: r.id,
          clientId: r.client.id,
          link: `/app/onboarding/${r.id}`,
          ownerId: r.client.accountOwnerId,
          evidence: { day, windowDays: agency.windowDays, requiredDone: !required },
        } satisfies Finding,
      ];
    });
  },
};

export const RULES: Record<GenieRuleKey, Rule> = {
  video_stuck: videoStuck,
  revision_loop: revisionLoop,
  client_waiting: clientWaiting,
  behind_quota: behindQuota,
  report_due: reportDue,
  invoice_overdue: invoiceOverdue,
  editor_load: editorLoad,
  shoot_readiness: shootReadiness,
  client_health: clientHealth,
  onboarding_incomplete: onboardingIncomplete,
};
