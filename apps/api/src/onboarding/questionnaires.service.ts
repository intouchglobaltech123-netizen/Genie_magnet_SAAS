import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ensureDefaultQuestionnaires, type Prisma } from "@gm/db";
import type { QuestionnaireDefinition, QuestionnaireKind } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

type Row = Prisma.QuestionnaireTemplateGetPayload<object>;

const present = (t: Row, responses?: number) => ({
  id: t.id,
  version: Number(t.version),
  definition: t.definition as unknown as QuestionnaireDefinition,
  publishedAt: t.publishedAt,
  updatedAt: t.updatedAt,
  ...(responses !== undefined && { responses }),
});

/**
 * The question builder (P1-21). Each agency has a client and an agency questionnaire, starting from the Growth OS sets.
 * Changes go into one draft per kind; publishing makes the draft the next version. Responses keep the version they
 * were started on, so answers already given never move to different questions.
 */
@Injectable()
export class QuestionnairesService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  /** Agencies made before the builder existed get the Growth OS sets the first time they are needed. */
  private async ensure() {
    const agencyId = this.tenant.agencyId;
    if ((await this.tenant.db.questionnaireTemplate.count()) >= 2) return;
    await this.tenant.tx((tx) => ensureDefaultQuestionnaires(tx, agencyId));
  }

  /** The version new responses start on. */
  async latest(kind: QuestionnaireKind) {
    await this.ensure();
    const t = await this.tenant.db.questionnaireTemplate.findFirst({ where: { kind, publishedAt: { not: null } }, orderBy: { publishedAt: "desc" } });
    if (!t) throw new NotFoundException("No published questionnaire.");
    return t;
  }

  async get(kind: QuestionnaireKind) {
    await this.ensure();
    const rows = await this.tenant.db.questionnaireTemplate.findMany({
      where: { kind },
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: "desc" },
    });
    const published = rows.filter((r) => r.publishedAt).sort((a, b) => Number(b.version) - Number(a.version));
    const draft = rows.find((r) => !r.publishedAt);
    return {
      kind,
      published: published[0] ? present(published[0]) : null,
      draft: draft ? present(draft) : null,
      versions: published.map((r) => ({ version: Number(r.version), publishedAt: r.publishedAt, responses: r._count.responses })),
    };
  }

  /** Saves the draft, starting one from the published version when there is none. */
  async saveDraft(kind: QuestionnaireKind, definition: QuestionnaireDefinition) {
    const current = await this.latest(kind);
    const draft = await this.tenant.db.questionnaireTemplate.findFirst({ where: { kind, publishedAt: null } });
    const data = { definition: definition as unknown as Prisma.InputJsonObject };
    await this.tenant.tx(async (tx) => {
      if (draft) await tx.questionnaireTemplate.update({ where: { id: draft.id }, data });
      else {
        const created = await tx.questionnaireTemplate.create({
          data: { ...data, agencyId: this.tenant.agencyId, kind, version: String(Number(current.version) + 1), createdBy: this.tenant.userId },
        });
        await this.audit.record(tx, { action: "create", entity: "questionnaire", entityId: created.id, after: { kind, draft: created.version } });
      }
    });
    return this.get(kind);
  }

  /** The draft becomes the version new responses start on. */
  async publish(kind: QuestionnaireKind) {
    const draft = await this.tenant.db.questionnaireTemplate.findFirst({ where: { kind, publishedAt: null } });
    if (!draft) throw new ConflictException("There is no draft to publish — change a question first.");
    const before = await this.latest(kind);
    const count = (d: unknown) => (d as QuestionnaireDefinition).sections.reduce((n, s) => n + s.questions.length, 0);
    await this.tenant.tx(async (tx) => {
      await tx.questionnaireTemplate.update({ where: { id: draft.id }, data: { publishedAt: new Date() } });
      await this.audit.record(tx, {
        action: "publish",
        entity: "questionnaire",
        entityId: draft.id,
        before: { kind, version: Number(before.version), questions: count(before.definition) },
        after: { kind, version: Number(draft.version), questions: count(draft.definition) },
      });
    });
    return this.get(kind);
  }

  async discardDraft(kind: QuestionnaireKind) {
    const draft = await this.tenant.db.questionnaireTemplate.findFirst({ where: { kind, publishedAt: null } });
    if (!draft) return this.get(kind);
    await this.tenant.tx(async (tx) => {
      await tx.questionnaireTemplate.delete({ where: { id: draft.id } });
      await this.audit.record(tx, { action: "delete", entity: "questionnaire", entityId: draft.id, before: { kind, draft: Number(draft.version) } });
    });
    return this.get(kind);
  }
}
