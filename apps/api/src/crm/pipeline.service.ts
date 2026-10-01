import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { ensureDefaultStages } from "@gm/db";
import type { PipelineInput, StageKind } from "@gm/shared";
import { AuditService, changes } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

export interface Stage {
  key: string;
  name: string;
  kind: StageKind;
  probability: number;
  position: number;
}

const keyFor = (name: string, taken: Set<string>) => {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "stage";
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
  return key;
};

/**
 * The agency's pipeline stages (P1-14). Open stages are the agency's to rename, add, reorder and remove (a stage
 * with leads in it cannot be removed); Won and Lost always come last and cannot change.
 */
@Injectable()
export class PipelineService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async stages(): Promise<Stage[]> {
    let rows = await this.tenant.db.pipelineStage.findMany({ orderBy: { position: "asc" } });
    if (!rows.length) {
      await this.tenant.tx((tx) => ensureDefaultStages(tx, this.tenant.agencyId));
      rows = await this.tenant.db.pipelineStage.findMany({ orderBy: { position: "asc" } });
    }
    return rows.map((r) => ({ key: r.key, name: r.name, kind: r.kind as StageKind, probability: r.probability, position: r.position }));
  }

  /** The stage, or a plain-language refusal. */
  async stage(key: string) {
    const found = (await this.stages()).find((s) => s.key === key);
    if (!found)
      throw new BadRequestException({ message: `There is no stage "${key}" in your pipeline.`, issues: [{ path: "stage", message: "Pick a stage" }] });
    return found;
  }

  async update({ stages }: PipelineInput) {
    const agencyId = this.tenant.agencyId;
    const current = await this.stages();
    const open = current.filter((s) => s.kind === "open");
    const fixed = current.filter((s) => s.kind !== "open");

    const kept = new Set(stages.map((s) => s.key).filter(Boolean));
    for (const key of kept) {
      if (!open.some((s) => s.key === key)) throw new BadRequestException(`"${key}" is not one of your open stages.`);
    }
    const removed = open.filter((s) => !kept.has(s.key));
    if (removed.length) {
      const counts = await this.tenant.db.lead.groupBy({
        by: ["stage"],
        where: { agencyId, stage: { in: removed.map((s) => s.key) } },
        _count: { _all: true },
      });
      const busy = counts.filter((c) => c._count._all > 0);
      if (busy.length) {
        const names = busy.map((c) => `${removed.find((s) => s.key === c.stage)?.name} (${c._count._all} leads)`).join(", ");
        throw new ConflictException(`Move the leads out of ${names} before removing ${busy.length === 1 ? "it" : "them"}.`);
      }
    }

    const taken = new Set(current.map((s) => s.key));
    const next = stages.map((s, position) => {
      const key = s.key ?? keyFor(s.name, taken);
      taken.add(key);
      return { key, name: s.name, probability: s.probability, position };
    });
    const diff = changes({ stages: open.map((s) => `${s.name} (${s.probability}%)`) }, { stages: next.map((s) => `${s.name} (${s.probability}%)`) });
    if (!diff) return current;

    await this.tenant.tx(async (tx) => {
      if (removed.length) await tx.pipelineStage.deleteMany({ where: { agencyId, key: { in: removed.map((s) => s.key) } } });
      for (const s of next) {
        await tx.pipelineStage.upsert({
          where: { agencyId_key: { agencyId, key: s.key } },
          create: { agencyId, ...s, kind: "open" },
          update: { name: s.name, probability: s.probability, position: s.position },
        });
      }
      // Won and Lost stay last.
      for (const [i, s] of fixed.entries()) {
        await tx.pipelineStage.update({ where: { agencyId_key: { agencyId, key: s.key } }, data: { position: next.length + i } });
      }
      await this.audit.record(tx, { action: "update", entity: "pipeline", entityId: agencyId, ...diff });
    });
    return this.stages();
  }
}
