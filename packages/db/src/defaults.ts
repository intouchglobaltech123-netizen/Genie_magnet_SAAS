import { DEFAULT_PIPELINE_STAGES, DEFAULT_QUESTIONNAIRES, DEFAULT_ROLE_DEFINITIONS, QUESTIONNAIRE_KINDS } from "@gm/shared";
import type { Prisma } from "./generated/prisma/client.js";
import type { TenantTx } from "./tenancy.js";

/**
 * Gives an agency the default roles it does not have yet (P1-11). Run when an agency is created and by the
 * seed; existing roles — and any changes the agency made to them — are left as they are.
 */
export async function ensureDefaultRoles(tx: TenantTx, agencyId: string) {
  await tx.role.createMany({
    data: DEFAULT_ROLE_DEFINITIONS.map((r) => ({
      agencyId,
      key: r.key,
      name: r.name,
      description: r.description,
      permissions: r.permissions as Prisma.InputJsonObject,
      isClient: r.isClient,
    })),
    skipDuplicates: true,
  });
}

/** Gives an agency the Growth OS pipeline stages when it has none (P1-14); an agency's own stages are never touched. */
export async function ensureDefaultStages(tx: TenantTx, agencyId: string) {
  if (await tx.pipelineStage.count({ where: { agencyId } })) return;
  await tx.pipelineStage.createMany({ data: DEFAULT_PIPELINE_STAGES.map((s, position) => ({ agencyId, ...s, position })) });
}

/** Gives an agency the Growth OS onboarding questions (version 1) for each kind it has none of (P1-21). */
export async function ensureDefaultQuestionnaires(tx: TenantTx, agencyId: string) {
  for (const kind of QUESTIONNAIRE_KINDS) {
    if (await tx.questionnaireTemplate.count({ where: { agencyId, kind } })) continue;
    await tx.questionnaireTemplate.create({
      data: {
        agencyId,
        kind,
        version: "1",
        definition: DEFAULT_QUESTIONNAIRES[kind] as unknown as Prisma.InputJsonObject,
        isDefault: true,
        publishedAt: new Date(),
      },
    });
  }
}

/** Everything a new agency starts with: roles and permissions, the sales pipeline, and the onboarding questions. */
export async function setUpAgencyDefaults(tx: TenantTx, agencyId: string) {
  await ensureDefaultRoles(tx, agencyId);
  await ensureDefaultStages(tx, agencyId);
  await ensureDefaultQuestionnaires(tx, agencyId);
}
