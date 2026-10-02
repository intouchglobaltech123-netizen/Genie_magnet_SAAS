import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { findQuestionnaireLink, type Prisma, type TenantTx } from "@gm/db";
import {
  allows,
  type AnswerValue,
  type Answers,
  CANVAS_BLOCKS,
  FILE_REF,
  fileAllowed,
  checkAnswer,
  checklistOf,
  dueReminders,
  gateOf,
  gstinValid,
  isAnswered,
  LANGUAGES,
  languagesOf,
  MAPPABLE_FIELDS,
  packageTotals,
  progressOf,
  type Question,
  type QuestionnaireDefinition,
  translated,
  windowOf,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { lockRow } from "../common/lock-row.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ENV, type Env } from "../env.js";
import { FilesService } from "../files/files.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { Secrets } from "../common/secrets.js";
import { asLinkHolder, TenantDb } from "../tenancy/tenant-context.js";
import { QuestionnairesService } from "./questionnaires.service.js";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
/** A token nobody holds: the response has no link until one is made. */
const noLink = () => hash(randomBytes(32).toString("base64url"));

const WITH = {
  template: { select: { version: true, definition: true } },
  client: { select: { id: true, name: true, code: true, accountOwnerId: true } },
  answers: true,
  reminders: { orderBy: { day: "asc" } },
} as const satisfies Prisma.QuestionnaireResponseInclude;
type Row = Prisma.QuestionnaireResponseGetPayload<{ include: typeof WITH }>;

const today = () => new Date().toISOString().slice(0, 10);
const short = (v: AnswerValue | null) => (typeof v === "string" && v.length > 300 ? `${v.slice(0, 300)}…` : v);
const questionsOf = (d: QuestionnaireDefinition) => d.sections.flatMap((s) => s.questions);

/** The packages table of the agency questionnaire (Growth OS a4): its rows can become the agency's packages. */
const PACKAGE_TABLE = "a4";

/**
 * Client and agency onboarding (P1-22 to P1-25). A client answers by private link at their own pace, or the account
 * manager fills it in with them on a call (assisted); both are always possible. Answers save as they are given, fill in
 * mapped fields, tick checklist items, and open the gate that lets production start.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly questionnaires: QuestionnairesService,
    private readonly files: FilesService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
    private readonly secrets: Secrets,
  ) {}

  private agency() {
    return this.tenant.db.agency.findUniqueOrThrow({
      where: { id: this.tenant.agencyId },
      select: { name: true, logo: true, brandColor: true, windowDays: true, reminderDays: true, languages: true, onboardingMode: true },
    });
  }

  private async names(ids: (string | null)[]) {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (!wanted.length) return new Map<string, string>();
    const people = await this.tenant.db.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
    return new Map(people.map((p) => [p.id, p.name]));
  }

  /** What the checklist knows from the client's records. */
  private async facts(clientId: string | null) {
    if (!clientId) return { agreement: false, approver: false };
    const [agreements, approvers] = await Promise.all([
      this.tenant.db.agreement.count({ where: { clientId, status: { in: ["active", "renewal_due", "paused"] } } }),
      this.tenant.db.contact.count({ where: { clientId, approver: true } }),
    ]);
    return { agreement: agreements > 0, approver: approvers > 0 };
  }

  private state(row: Row, agency: { windowDays: number; reminderDays: number[] }, facts: { agreement: boolean; approver: boolean }) {
    const definition = row.template.definition as unknown as QuestionnaireDefinition;
    const answers: Answers = Object.fromEntries(row.answers.map((a) => [a.questionKey, a.value as AnswerValue]));
    const progress = progressOf(definition, answers);
    const checklist = checklistOf(definition, answers, row.checklist as Record<string, { at: string; by: string | null }>, facts);
    const gate = gateOf(progress, checklist, !!row.exceptionAt);
    const window = windowOf(row.sentAt?.toISOString() ?? null, agency.windowDays, progress.complete, today());
    const sent = row.reminders.map((r) => r.day);
    return { definition, answers, progress, checklist, gate, window, due: dueReminders(agency.reminderDays, window.day, sent, progress.complete) };
  }

  private summary(row: Row, s: ReturnType<OnboardingService["state"]>) {
    return {
      id: row.id,
      kind: row.clientId ? ("client" as const) : ("agency" as const),
      client: row.client ? { id: row.client.id, name: row.client.name, code: row.client.code } : null,
      version: Number(row.template.version),
      mode: row.mode as "link" | "assisted",
      language: row.language,
      sentAt: row.sentAt,
      requiredDoneAt: row.requiredDoneAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      progress: { required: s.progress.required, window: s.progress.window, complete: s.progress.complete },
      gate: s.gate,
      window: s.window,
      remindersDue: s.due,
    };
  }

  private async find(id: string) {
    const row = await this.tenant.db.questionnaireResponse.findFirst({ where: { id }, include: WITH });
    if (!row) throw new NotFoundException("No onboarding with that id.");
    return row;
  }

  /** Every client onboarding, newest first. */
  async list() {
    const [rows, agency] = await Promise.all([
      this.tenant.db.questionnaireResponse.findMany({ where: { clientId: { not: null } }, include: WITH, orderBy: { createdAt: "desc" }, take: 500 }),
      this.agency(),
    ]);
    const facts = await Promise.all(rows.map((r) => this.facts(r.clientId)));
    return rows.map((r, i) => this.summary(r, this.state(r, agency, facts[i]!)));
  }

  /** The full picture for the onboarding page: questions, answers with who gave them, checklist, gate and outputs. */
  async get(id: string) {
    const row = await this.find(id);
    const [agency, facts] = await Promise.all([this.agency(), this.facts(row.clientId)]);
    const s = this.state(row, agency, facts);
    const manual = row.checklist as Record<string, { at: string; by: string | null }>;
    const names = await this.names([
      ...row.answers.map((a) => a.answeredBy),
      ...row.reminders.map((r) => r.sentBy),
      ...Object.values(manual).map((m) => m.by),
      row.exceptionBy,
    ]);
    const who = (id: string | null) => (id ? { id, name: names.get(id) ?? null } : null);
    const files = await this.files.listFor("onboarding", row.id);
    const questions = questionsOf(s.definition);
    const label = (key: string) => questions.find((q) => q.key === key)?.label ?? key;
    return {
      ...this.summary(row, s),
      windowDays: agency.windowDays,
      reminderDays: agency.reminderDays,
      languages: languagesOf(s.definition).filter((l) => l === "en" || agency.languages.includes(l)),
      definition: s.definition,
      answers: Object.fromEntries(row.answers.map((a) => [a.questionKey, { value: a.value as AnswerValue, by: who(a.answeredBy), at: a.answeredAt }])),
      progress: s.progress,
      checklist: s.checklist.map((c) => ({ ...c, by: c.auto ? null : who(c.by ?? null) })),
      reminders: row.reminders.map((r) => ({ day: r.day, channel: r.channel, sentAt: r.sentAt, by: who(r.sentBy) })),
      exception: row.exceptionAt ? { reason: row.exceptionReason, at: row.exceptionAt, by: who(row.exceptionBy) } : null,
      /** Files uploaded for this questionnaire, by id, with download links. */
      files: Object.fromEntries(files.map((f) => [f.id, { name: f.name, size: f.size, url: f.url }])),
      /** The draft Business Canvas: answers tagged with each block. */
      canvas: CANVAS_BLOCKS.map((b) => ({
        block: b.key,
        label: b.label,
        items: questions.filter((q) => q.canvas === b.key && isAnswered(s.answers[q.key])).map((q) => ({ question: label(q.key), answer: s.answers[q.key]! })),
      })),
      /** Fields filled in from answers. */
      filled: questions
        .filter((q) => q.mapsTo)
        .map((q) => ({ question: q.label, field: MAPPABLE_FIELDS.find((f) => f.key === q.mapsTo)!.label, value: s.answers[q.key] ?? null })),
    };
  }

  // ─── Starting, the link and settings ───────────────────────────────

  /** The version and mode a new onboarding starts with (read before the transaction that creates it). */
  async startingPoint(kind: "client" | "agency") {
    const [template, agency] = await Promise.all([this.questionnaires.latest(kind), this.agency()]);
    return { template, mode: kind === "agency" ? "assisted" : agency.onboardingMode };
  }

  private async create(tx: TenantTx, clientId: string | null, start: Awaited<ReturnType<OnboardingService["startingPoint"]>>, mode?: string) {
    const { template } = start;
    mode ??= start.mode;
    const r = await tx.questionnaireResponse.create({
      data: {
        agencyId: this.tenant.agencyId,
        templateId: template.id,
        clientId,
        token: noLink(),
        mode,
        createdBy: this.tenant.userId,
        // The agency's own questionnaire is filled in by its people; its window starts now.
        ...(clientId ? {} : { sentAt: new Date() }),
      },
    });
    await this.audit.record(tx, { action: "start", entity: "onboarding", entityId: r.id, after: { clientId, version: Number(template.version), mode } });
    return r.id;
  }

  /** Inside "Mark as won": the client's onboarding is started (not shared yet) in the same transaction. */
  startInWin(tx: TenantTx, clientId: string, start: Awaited<ReturnType<OnboardingService["startingPoint"]>>) {
    return this.create(tx, clientId, start);
  }

  async start(clientId: string, mode?: "link" | "assisted") {
    const client = await this.tenant.db.client.findFirst({ where: { id: clientId }, select: { archivedAt: true } });
    if (!client) throw new NotFoundException("No client with that id.");
    if (client.archivedAt) throw new ConflictException("This client is archived — restore it first.");
    const open = await this.tenant.db.questionnaireResponse.findFirst({ where: { clientId, completedAt: null }, select: { id: true } });
    if (open) throw new ConflictException("Onboarding is already under way for this client.");
    const start = await this.startingPoint("client");
    const id = await this.tenant.tx((tx) => this.create(tx, clientId, start, mode));
    return this.get(id);
  }

  /**
   * A new private link (the old one stops working). Only its hash is kept, so the link is shown now and never again;
   * sharing it starts the window.
   */
  async makeLink(id: string) {
    const row = await this.find(id);
    if (!row.clientId) throw new BadRequestException("The agency's own questionnaire is filled in here, not by link.");
    const token = randomBytes(24).toString("base64url");
    await this.tenant.tx(async (tx) => {
      await tx.questionnaireResponse.update({
        where: { id },
        data: { token: hash(token), tokenSecret: this.secrets.encrypt(token), ...(row.sentAt ? {} : { sentAt: new Date() }) },
      });
      await this.audit.record(tx, {
        action: "share",
        entity: "onboarding",
        entityId: id,
        after: { client: row.client?.name, link: row.sentAt ? "replaced" : "new" },
      });
    });
    return { link: `${this.env.WEB_ORIGIN}/app/q/${token}`, onboarding: await this.get(id) };
  }

  async update(id: string, input: { mode?: "link" | "assisted"; language?: string }) {
    const row = await this.find(id);
    const agency = await this.agency();
    if (input.language && input.language !== "en" && !agency.languages.includes(input.language))
      throw new BadRequestException({
        message: "Add that language to your agency profile first.",
        issues: [{ path: "language", message: "Not one of your languages" }],
      });
    await this.tenant.tx(async (tx) => {
      await tx.questionnaireResponse.update({ where: { id }, data: input });
      await this.audit.record(tx, { action: "update", entity: "onboarding", entityId: id, before: { mode: row.mode, language: row.language }, after: input });
    });
    return this.get(id);
  }

  // ─── Answers ──────────────────────────────────────────────────────

  /** Fills in a mapped field from an answer, when the answer fits it. */
  private async fill(tx: TenantTx, row: Row, q: Question, value: AnswerValue | null) {
    if (!q.mapsTo || typeof value !== "string") return;
    const [target, field] = q.mapsTo.split(".") as ["client" | "agency", string];
    let v: string | null = value;
    if (field === "stage" || field === "businessStage") v = value.toLowerCase();
    if (field === "gstin" && !gstinValid(value.toUpperCase())) return;
    if (field === "gstin") v = value.toUpperCase();
    if (field === "website" && !/^https?:\/\//.test(value)) return;
    if (target === "client" && row.clientId) {
      const before = await tx.client.findUniqueOrThrow({ where: { id: row.clientId } });
      if ((before as unknown as Record<string, unknown>)[field] === v) return;
      await tx.client.update({ where: { id: row.clientId }, data: { [field]: v } as Prisma.ClientUpdateInput });
      await this.audit.record(tx, {
        action: "update",
        entity: "client",
        entityId: row.clientId,
        before: { name: before.name, [field]: (before as unknown as Record<string, unknown>)[field] ?? null },
        after: { name: before.name, [field]: v, via: "onboarding" },
      });
    } else if (target === "agency" && !row.clientId) {
      await tx.agency.update({ where: { id: this.tenant.agencyId }, data: { [field]: v } as Prisma.AgencyUpdateInput });
      await this.audit.record(tx, { action: "update", entity: "agency", entityId: this.tenant.agencyId, after: { [field]: v, via: "onboarding" } });
    }
  }

  /** Saves (or clears) one answer, fills mapped fields, and keeps the progress dates up to date. `by` is null for the client. */
  private async save(row: Row, key: string, value: AnswerValue, by: string | null) {
    const definition = row.template.definition as unknown as QuestionnaireDefinition;
    const q = questionsOf(definition).find((x) => x.key === key);
    if (!q) throw new NotFoundException("No question with that key in this questionnaire.");
    const checked = checkAnswer(q, value);
    if (checked.error !== undefined) throw new BadRequestException({ message: checked.error, issues: [{ path: "value", message: checked.error }] });
    // A files answer may only point at files uploaded for this questionnaire.
    const refs = Array.isArray(checked.value)
      ? (checked.value as string[]).filter((v) => typeof v === "string" && FILE_REF.test(v)).map((v) => v.slice(5))
      : [];
    if (refs.length) {
      const mine = await this.tenant.db.fileObject.count({ where: { id: { in: refs }, entity: "onboarding", entityId: row.id, status: "ready" } });
      if (mine !== refs.length)
        throw new BadRequestException({ message: "Upload the file again.", issues: [{ path: "value", message: "Upload the file again" }] });
    }
    const old = row.answers.find((a) => a.questionKey === key);
    const answers: Answers = Object.fromEntries(row.answers.map((a) => [a.questionKey, a.value as AnswerValue]));
    if (checked.value === null) delete answers[key];
    else answers[key] = checked.value;
    if (JSON.stringify(old?.value ?? null) === JSON.stringify(checked.value)) return progressOf(definition, answers);
    const progress = progressOf(definition, answers);
    await this.tenant.tx(async (tx) => {
      if (checked.value === null) await tx.answer.deleteMany({ where: { responseId: row.id, questionKey: key } });
      else
        await tx.answer.upsert({
          where: { responseId_questionKey: { responseId: row.id, questionKey: key } },
          create: { agencyId: this.tenant.agencyId, responseId: row.id, questionKey: key, value: checked.value as Prisma.InputJsonValue, answeredBy: by },
          update: { value: checked.value as Prisma.InputJsonValue, answeredBy: by, answeredAt: new Date() },
        });
      await this.fill(tx, row, q, checked.value);
      const now = new Date();
      await tx.questionnaireResponse.update({
        where: { id: row.id },
        data: {
          requiredDoneAt: progress.required.complete ? (row.requiredDoneAt ?? now) : null,
          completedAt: progress.complete ? (row.completedAt ?? now) : null,
          // Answering with the client on a call starts the window too.
          ...(row.sentAt ? {} : { sentAt: now }),
        },
      });
      await this.audit.record(tx, {
        action: "answer",
        entity: "onboarding",
        entityId: row.id,
        before: { question: key, value: short((old?.value as AnswerValue) ?? null) },
        after: { question: key, value: short(checked.value), via: by ? "assisted" : "link" },
      });
      // The account manager hears when the client finishes the required part, and when everything is answered.
      const milestone = progress.complete && !row.completedAt ? "all of" : progress.required.complete && !row.requiredDoneAt ? "the required part of" : null;
      if (milestone && row.client) {
        await this.notifications.notify(
          tx,
          row.client.accountOwnerId ? { users: [row.client.accountOwnerId] } : { can: { area: "onboarding", level: "approve" } },
          { kind: "onboarding_progress", title: `${row.client.name} answered ${milestone} onboarding`, link: `/app/onboarding/${row.id}` },
        );
      }
    });
    return progress;
  }

  /** Someone in the agency answers (assisted mode, or the agency's own questionnaire). */
  async answer(id: string, key: string, value: AnswerValue) {
    const row = await this.find(id);
    if (!row.clientId && !allows(this.tenant.permissions, "settings", "edit"))
      throw new ForbiddenException("The agency questionnaire is answered by people who may change agency settings.");
    await this.save(row, key, value, this.tenant.userId ?? null);
    return this.get(id);
  }

  // ─── Checklist, exception and reminders ────────────────────────────

  async tick(id: string, key: string, done: boolean) {
    const row = await this.find(id);
    const item = (row.template.definition as unknown as QuestionnaireDefinition).checklist.find((c) => c.key === key);
    if (!item) throw new NotFoundException("No checklist item with that key.");
    if (item.tick.kind !== "manual") throw new ConflictException("This item ticks itself — it cannot be ticked by hand.");
    await this.tenant.tx(async (tx) => {
      await lockRow(tx, "questionnaire_responses", id);
      const cur = await tx.questionnaireResponse.findUniqueOrThrow({ where: { id }, select: { checklist: true } });
      const manual = { ...(cur.checklist as Record<string, { at: string; by: string | null }>) };
      if (done) manual[key] = { at: new Date().toISOString(), by: this.tenant.userId ?? null };
      else delete manual[key];
      await tx.questionnaireResponse.update({ where: { id }, data: { checklist: manual as Prisma.InputJsonValue } });
      await this.audit.record(tx, { action: done ? "tick" : "untick", entity: "onboarding", entityId: id, after: { item: item.label } });
    });
    return this.get(id);
  }

  /** Lets production start before onboarding is complete, with the reason (onboarding: approve). */
  async exception(id: string, reason: string) {
    const row = await this.find(id);
    if (row.exceptionAt) throw new ConflictException("An exception is already approved.");
    await this.tenant.tx(async (tx) => {
      await tx.questionnaireResponse.update({ where: { id }, data: { exceptionReason: reason, exceptionBy: this.tenant.userId, exceptionAt: new Date() } });
      await this.audit.record(tx, { action: "approve", entity: "onboarding", entityId: id, after: { exception: reason, client: row.client?.name } });
    });
    return this.get(id);
  }

  /**
   * Records a reminder as sent. Until WhatsApp and email sending arrive, the account manager sends it (the page gives
   * the message and a WhatsApp link) and records it here; each reminder day is recorded once.
   */
  async reminderSent(id: string, day: number, channel: string) {
    const row = await this.find(id);
    const agency = await this.agency();
    if (!agency.reminderDays.includes(day))
      throw new BadRequestException({ message: "That is not one of your reminder days.", issues: [{ path: "day", message: "Not a reminder day" }] });
    if (row.reminders.some((r) => r.day === day)) return this.get(id);
    await this.tenant.tx(async (tx) => {
      await tx.questionnaireReminder.create({ data: { agencyId: this.tenant.agencyId, responseId: id, day, channel, sentBy: this.tenant.userId } });
      await this.audit.record(tx, { action: "remind", entity: "onboarding", entityId: id, after: { day, channel, client: row.client?.name } });
    });
    return this.get(id);
  }

  // ─── The agency's own questionnaire ────────────────────────────────

  /** The agency's latest run of its own questionnaire, or null before it is started. */
  async agencyQuestionnaire() {
    const existing = await this.tenant.db.questionnaireResponse.findFirst({ where: { clientId: null }, orderBy: { createdAt: "desc" }, select: { id: true } });
    return existing ? this.get(existing.id) : null;
  }

  /** Starts the agency questionnaire — the first time, and again at a strategic review (earlier runs are kept). */
  async startAgencyQuestionnaire() {
    const start = await this.startingPoint("agency");
    const id = await this.tenant.tx((tx) => this.create(tx, null, start));
    return this.get(id);
  }

  /** Adds the packages from the agency questionnaire's packages table that the agency does not have yet. */
  async packagesFromAnswers(id: string) {
    const row = await this.find(id);
    if (row.clientId) throw new BadRequestException("Packages come from the agency questionnaire.");
    const rows = (row.answers.find((a) => a.questionKey === PACKAGE_TABLE)?.value as Record<string, string>[] | undefined) ?? [];
    const existing = new Set((await this.tenant.db.package.findMany({ select: { name: true } })).map((p) => p.name.toLowerCase()));
    const added: string[] = [];
    await this.tenant.tx(async (tx) => {
      for (const r of rows) {
        const name = r.name?.trim();
        if (!name || existing.has(name.toLowerCase())) continue;
        const deliverables = [
          ...(Number(r.videos) > 0 ? [{ name: "Videos", perMonth: Number(r.videos), kind: "video" as const }] : []),
          ...(Number(r.posts) > 0 ? [{ name: "Posts", perMonth: Number(r.posts), kind: "post" as const }] : []),
        ];
        if (!deliverables.length) deliverables.push({ name: "Deliverables", perMonth: 1, kind: "video" });
        const p = await tx.package.create({
          data: {
            agencyId: this.tenant.agencyId,
            name,
            monthlyFee: Number(r.price) || 0,
            deliverables,
            ...packageTotals(deliverables),
            shootDays: Math.min(31, Number(r.shootDays) || 0),
            revisionsPerDeliverable: Math.min(10, Number(r.revisions) || 0),
            platforms: [],
          },
        });
        await this.audit.record(tx, {
          action: "create",
          entity: "package",
          entityId: p.id,
          after: { name, monthlyFee: p.monthlyFee, via: "agency questionnaire" },
        });
        existing.add(name.toLowerCase());
        added.push(name);
      }
    });
    return { added };
  }

  // ─── The private link ──────────────────────────────────────────────

  /** Opens a link: the response and its agency, or not found (also for a replaced link). */
  private async byToken(token: string) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new NotFoundException("This link is not valid. Ask your agency for a new one.");
    const found = await findQuestionnaireLink(this.prisma.client, hash(token));
    if (!found) throw new NotFoundException("This link is not valid. Ask your agency for a new one.");
    return found;
  }

  /** What the client sees: the questions in their language and their answers so far — nothing internal. */
  private async publicView(id: string) {
    const row = await this.find(id);
    const agency = await this.agency();
    const s = this.state(row, agency, { agreement: false, approver: false });
    const languages = languagesOf(s.definition).filter((l) => l === "en" || agency.languages.includes(l));
    const language = languages.includes(row.language) ? row.language : "en";
    return {
      agency: { name: agency.name, logo: agency.logo, brandColor: agency.brandColor },
      client: { name: row.client?.name ?? agency.name },
      language,
      languages: languages.map((code) => ({ code, label: LANGUAGES.find((l) => l.code === code)?.label ?? code })),
      sections: translated(s.definition, language).map((sec) => ({
        key: sec.key,
        title: sec.title,
        intro: sec.intro ?? null,
        when: sec.when,
        questions: sec.questions.map(({ feeds: _f, mapsTo: _m, canvas: _c, translations, ...q }) => ({
          ...q,
          optionLabels: q.options?.map((o, i) => translations?.[language as "ta"]?.options?.[i] || o),
        })),
      })),
      answers: s.answers,
      files: Object.fromEntries((await this.files.listFor("onboarding", row.id)).map((f) => [f.id, { name: f.name, size: f.size, url: f.url }])),
      progress: s.progress,
      window: { state: s.window.state, dueOn: s.window.dueOn, days: agency.windowDays },
    };
  }

  async publicGet(token: string) {
    const link = await this.byToken(token);
    return asLinkHolder(link.agencyId, () => this.publicView(link.id));
  }

  async publicAnswer(token: string, key: string, value: AnswerValue) {
    const link = await this.byToken(token);
    return asLinkHolder(link.agencyId, async () => {
      const progress = await this.save(await this.find(link.id), key, value, null);
      return { progress };
    });
  }

  /** The client uploads a file (for a files question) through the link. */
  async publicFileStart(token: string, input: { name: string; mime: string; size: number }) {
    const link = await this.byToken(token);
    if (!fileAllowed(input.name, input.mime))
      throw new BadRequestException({ message: "This kind of file cannot be uploaded.", issues: [{ path: "name", message: "Not an accepted kind of file" }] });
    return asLinkHolder(link.agencyId, () => this.files.startForLink(link.id, input));
  }

  async publicLanguage(token: string, language: string) {
    const link = await this.byToken(token);
    return asLinkHolder(link.agencyId, async () => {
      const agency = await this.agency();
      if (language !== "en" && !agency.languages.includes(language)) throw new BadRequestException("That language is not available.");
      await this.tenant.db.questionnaireResponse.update({ where: { id: link.id }, data: { language } });
      return this.publicView(link.id);
    });
  }
}
