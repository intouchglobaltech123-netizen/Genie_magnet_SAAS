import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TenantTx } from "@gm/db";
import {
  type AiSettingsInput,
  type AiUsageSummary,
  allows,
  DRAFT_APPROVAL_TARGET,
  DRAFT_KINDS,
  GENIE_RULE_KEYS,
  GENIE_RULES,
  type GenieRuleKey,
  type GenieRulesInput,
  type GenieSettings,
  genieRuleSettings,
  type InsightRow,
  type InsightSeverity,
  type InsightStatus,
  scopeOf,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ProductionSettingsService } from "../production/production-settings.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { GENIE_MODEL, type GenieModel } from "./model.js";
import { type Finding, RULES } from "./rules.js";

const SEVERITY_ORDER: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Genie Assistant's rules (P4-01 to P4-04, ADR 0008): plain code over the agency's data, run every morning (job
 * `genie.rules`) or when someone asks. Each finding is one insight — raised once, kept up to date while the rule still
 * finds it, resolved by itself when it no longer does — for whoever should act, and seen by the people who may view
 * its area (only their own when their role is limited to its own work).
 */
@Injectable()
export class GenieService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly production: ProductionSettingsService,
    @Inject(GENIE_MODEL) private readonly model: GenieModel,
  ) {}

  // ─── Settings ───────────────────────────────────────────────────────

  private monthStart(now = new Date()) {
    return new Date(`${now.toISOString().slice(0, 7)}-01T00:00:00Z`);
  }

  /** Rupees spent on AI so far this month. */
  async spentThisMonth() {
    const sum = await this.tenant.db.aiUsage.aggregate({ where: { createdAt: { gte: this.monthStart() } }, _sum: { costPaise: true } });
    return (sum._sum.costPaise ?? 0) / 100;
  }

  async settings(): Promise<GenieSettings> {
    const row = await this.tenant.db.genieSettings.findUnique({ where: { agencyId: this.tenant.agencyId } });
    return {
      rules: genieRuleSettings(row?.rules as never),
      lastRunAt: row?.lastRunAt?.toISOString() ?? null,
      ai: {
        enabled: row?.aiEnabled ?? false,
        monthlyBudget: row?.monthlyBudget ?? 2000,
        retentionDays: row?.retentionDays ?? 90,
        source: this.model.kind,
        spentThisMonth: await this.spentThisMonth(),
      },
    };
  }

  /** Drafting on or off, the monthly budget and how long prompts and conversations are kept (P4-05, P4-09, P4-10). */
  async updateAi(input: AiSettingsInput) {
    const before = (await this.settings()).ai;
    const data = {
      ...(input.aiEnabled !== undefined && { aiEnabled: input.aiEnabled }),
      ...(input.monthlyBudget !== undefined && { monthlyBudget: input.monthlyBudget }),
      ...(input.retentionDays !== undefined && { retentionDays: input.retentionDays }),
    };
    await this.tenant.tx(async (tx) => {
      await tx.genieSettings.upsert({ where: { agencyId: this.tenant.agencyId }, create: { agencyId: this.tenant.agencyId, ...data }, update: data });
      await this.audit.record(tx, {
        action: "update",
        entity: "genie_ai",
        before: { enabled: before.enabled, monthlyBudget: before.monthlyBudget, retentionDays: before.retentionDays },
        after: data,
      });
    });
    return this.settings();
  }

  /** This month's AI usage against the budget, by feature and by person, and how drafts were decided (P4-09, P4-11). */
  async usage(): Promise<AiUsageSummary> {
    const since = this.monthStart();
    const [settings, rows, drafts] = await Promise.all([
      this.settings(),
      this.tenant.db.aiUsage.findMany({ where: { createdAt: { gte: since } }, select: { feature: true, userId: true, costPaise: true } }),
      this.tenant.db.draft.findMany({ where: { decidedAt: { gte: since } }, select: { kind: true, status: true, editedPct: true } }),
    ]);
    const group = <K extends string | null>(key: (r: (typeof rows)[number]) => K) => {
      const m = new Map<K, { calls: number; paise: number }>();
      for (const r of rows) {
        const g = m.get(key(r)) ?? { calls: 0, paise: 0 };
        g.calls++;
        g.paise += r.costPaise;
        m.set(key(r), g);
      }
      return [...m.entries()].sort((a, b) => b[1].paise - a[1].paise);
    };
    const byPerson = group((r) => r.userId);
    const people = await this.tenant.db.user.findMany({
      where: { id: { in: byPerson.map(([id]) => id).filter((x): x is string => !!x) } },
      select: { id: true, name: true },
    });
    return {
      month: since.toISOString().slice(0, 7),
      spent: rows.reduce((n, r) => n + r.costPaise, 0) / 100,
      budget: settings.ai.monthlyBudget,
      calls: rows.length,
      byFeature: group((r) => r.feature).map(([feature, g]) => ({ feature, calls: g.calls, spent: g.paise / 100 })),
      byPerson: byPerson.map(([id, g]) => ({ name: people.find((p) => p.id === id)?.name ?? null, calls: g.calls, spent: g.paise / 100 })),
      drafts: {
        approved: drafts.filter((d) => d.status === "approved" && !d.editedPct).length,
        edited: drafts.filter((d) => d.status === "approved" && !!d.editedPct).length,
        rejected: drafts.filter((d) => d.status === "rejected").length,
      },
      byKind: DRAFT_KINDS.flatMap((kind) => {
        const decided = drafts.filter((d) => d.kind === kind);
        const approved = decided.filter((d) => d.status === "approved").length;
        return decided.length ? [{ kind, decided: decided.length, approved, rate: Math.round((approved / decided.length) * 100) }] : [];
      }),
      target: DRAFT_APPROVAL_TARGET,
    };
  }

  async updateRules(input: GenieRulesInput) {
    const issues = Object.entries(input.rules).flatMap(([k, v]) => {
      const t = GENIE_RULES[k as GenieRuleKey].threshold;
      return v && (v.threshold < t.min || v.threshold > t.max) ? [{ path: `rules.${k}.threshold`, message: `Between ${t.min} and ${t.max}` }] : [];
    });
    if (issues.length) throw new BadRequestException({ message: "Some thresholds are out of range.", issues });
    const before = (await this.settings()).rules;
    const after = genieRuleSettings({ ...before, ...input.rules });
    await this.tenant.tx(async (tx) => {
      await tx.genieSettings.upsert({
        where: { agencyId: this.tenant.agencyId },
        create: { agencyId: this.tenant.agencyId, rules: after as unknown as Prisma.InputJsonValue },
        update: { rules: after as unknown as Prisma.InputJsonValue },
      });
      const changed = GENIE_RULE_KEYS.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
      if (changed.length)
        await this.audit.record(tx, {
          action: "update",
          entity: "genie_rules",
          before: Object.fromEntries(changed.map((k) => [k, before[k]])),
          after: Object.fromEntries(changed.map((k) => [k, after[k]])),
        });
    });
    return this.settings();
  }

  // ─── Running the rules ──────────────────────────────────────────────

  /** Runs every rule for the agency: new findings are raised, known ones kept up to date, the rest resolved. */
  async run(tx: TenantTx, now = new Date()) {
    const agencyId = this.tenant.agencyId;
    const today = now.toISOString().slice(0, 10);
    const [row, agency, production] = await Promise.all([
      tx.genieSettings.findUnique({ where: { agencyId } }),
      tx.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { windowDays: true } }),
      this.production.get(),
    ]);
    const rules = genieRuleSettings(row?.rules as never);
    const counts = { raised: 0, kept: 0, resolved: 0 };

    for (const key of GENIE_RULE_KEYS) {
      const setting = rules[key];
      const findings = setting.enabled
        ? await RULES[key].find({ tx, threshold: setting.threshold, now, today, agency, kits: production.kits.map((k) => ({ key: k.key, items: k.items })) })
        : [];
      const keys = new Map(findings.map((f) => [`${key}:${f.key}`, f]));
      const known = await tx.insight.findMany({
        where: { rule: key, OR: [{ status: { not: "resolved" } }, { dedupeKey: { in: [...keys.keys()] } }] },
      });
      const byKey = new Map(known.map((i) => [i.dedupeKey, i]));

      for (const [dedupeKey, f] of keys) {
        const found = byKey.get(dedupeKey);
        const content = {
          severity: f.severity,
          title: f.title,
          body: f.body ?? null,
          link: f.link ?? null,
          ownerId: f.ownerId ?? null,
          evidence: f.evidence as Prisma.InputJsonValue,
          lastSeenAt: now,
        };
        if (!found) {
          await tx.insight.create({
            data: {
              agencyId,
              rule: key,
              dedupeKey,
              area: GENIE_RULES[key].area,
              entity: f.entity ?? null,
              entityId: f.entityId ?? null,
              clientId: f.clientId ?? null,
              firstSeenAt: now,
              ...content,
            },
          });
          await this.tell(tx, key, f);
          counts.raised++;
        } else if (found.status === "resolved") {
          // It came back after it had cleared: raised again.
          await tx.insight.update({
            where: { id: found.id },
            data: { ...content, status: "open", firstSeenAt: now, resolvedAt: null, decidedBy: null, decidedAt: null },
          });
          await this.tell(tx, key, f);
          counts.raised++;
        } else {
          // Kept up to date; a dismissed or done one stays as the person left it.
          await tx.insight.update({ where: { id: found.id }, data: content });
          counts.kept++;
        }
      }
      // What the rule no longer finds (or a rule switched off) has cleared.
      const cleared = known.filter((i) => i.status !== "resolved" && !keys.has(i.dedupeKey)).map((i) => i.id);
      if (cleared.length) {
        await tx.insight.updateMany({ where: { id: { in: cleared } }, data: { status: "resolved", resolvedAt: now } });
        counts.resolved += cleared.length;
      }
    }
    await tx.genieSettings.upsert({ where: { agencyId }, create: { agencyId, lastRunAt: now }, update: { lastRunAt: now } });
    // What was sent to the model is kept only for the agency's retention period (P4-10); the drafts themselves stay.
    const keepFrom = new Date(now.getTime() - (row?.retentionDays ?? 90) * 86_400_000);
    const cleared = await tx.draft.updateMany({ where: { createdAt: { lt: keepFrom }, context: { not: null } }, data: { context: null } });
    // Ask Genie conversations go once nobody has added to them for that long.
    const forgotten = await tx.askConversation.deleteMany({ where: { updatedAt: { lt: keepFrom } } });
    return { ...counts, cleared: cleared.count, forgotten: forgotten.count };
  }

  /** Runs the rules now, for whoever asked. */
  async runNow() {
    const counts = await this.tenant.tx((tx) => this.run(tx), { timeout: 60_000 });
    return { ...counts, insights: await this.list({ status: "open" }) };
  }

  private async tell(tx: TenantTx, key: GenieRuleKey, f: Finding) {
    const rule = RULES[key];
    if (!rule.notify && !f.ownerId) return;
    await this.notifications.notify(
      tx,
      { users: [f.ownerId ?? null], ...(rule.notify && { can: rule.notify }) },
      { kind: "genie_insight", title: f.title, body: f.body, link: f.link ?? "/app/genie" },
    );
  }

  // ─── The inbox ──────────────────────────────────────────────────────

  /** Whether this person may see an insight: they have the rule's access to its area, and it is theirs when their role sees only its own. */
  private visible(i: { rule: string; ownerId: string | null }) {
    const perms = this.tenant.permissions;
    const rule = GENIE_RULES[i.rule as GenieRuleKey];
    if (!rule) return false;
    return allows(perms, rule.area, rule.level) && (scopeOf(perms, rule.area) !== "own" || i.ownerId === this.tenant.userId);
  }

  async list(f: { status?: string; rule?: string; mine?: boolean } = {}): Promise<InsightRow[]> {
    const status = (["open", "done", "dismissed", "resolved"] as const).includes(f.status as InsightStatus) ? (f.status as InsightStatus) : "open";
    const rows = await this.tenant.db.insight.findMany({
      where: {
        status,
        ...(f.rule && (GENIE_RULE_KEYS as string[]).includes(f.rule) && { rule: f.rule }),
        ...(f.mine && { ownerId: this.tenant.userId }),
      },
      orderBy: { lastSeenAt: "desc" },
      take: 500,
    });
    const shown = rows.filter((r) => this.visible(r));
    const [clients, people] = await Promise.all([
      this.tenant.db.client.findMany({
        where: { id: { in: [...new Set(shown.map((r) => r.clientId).filter((id): id is string => !!id))] } },
        select: { id: true, name: true, code: true },
      }),
      this.tenant.db.user.findMany({
        where: { id: { in: [...new Set(shown.map((r) => r.ownerId).filter((id): id is string => !!id))] } },
        select: { id: true, name: true },
      }),
    ]);
    return shown
      .sort((a, b) => SEVERITY_ORDER[a.severity as InsightSeverity] - SEVERITY_ORDER[b.severity as InsightSeverity])
      .slice(0, 200)
      .map((r) => ({
        id: r.id,
        rule: r.rule as GenieRuleKey,
        severity: r.severity as InsightSeverity,
        title: r.title,
        body: r.body,
        link: r.link,
        client: clients.find((c) => c.id === r.clientId) ?? null,
        owner: r.ownerId ? { id: r.ownerId, name: people.find((p) => p.id === r.ownerId)?.name ?? null } : null,
        status: r.status as InsightStatus,
        firstSeenAt: r.firstSeenAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
      }));
  }

  /** One insight this person may see (to draft from it), or not found. */
  async find(id: string) {
    const i = await this.tenant.db.insight.findFirst({ where: { id } });
    if (!i || !this.visible(i)) throw new NotFoundException("No insight with that id.");
    return i;
  }

  /** Done (acted on), dismissed (not worth acting on), or open again. */
  async decide(id: string, status: "done" | "dismissed" | "open") {
    const i = await this.tenant.db.insight.findFirst({ where: { id } });
    if (!i || !this.visible(i)) throw new NotFoundException("No insight with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.insight.update({
        where: { id },
        data: { status, decidedBy: status === "open" ? null : this.tenant.userId, decidedAt: status === "open" ? null : new Date() },
      });
      await this.audit.record(tx, {
        action: status === "open" ? "reopen" : status,
        entity: "insight",
        entityId: id,
        before: { status: i.status },
        after: { title: i.title, status },
      });
    });
    return (await this.list({ status })).find((r) => r.id === id) ?? null;
  }
}
