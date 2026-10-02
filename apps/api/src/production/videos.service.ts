import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type TenantTx } from "@gm/db";
import {
  allows,
  type ChangeRequestInput,
  type ClientDecision,
  DONE_STAGES,
  formatVideoCode,
  moveBlock,
  type ProductionSettings,
  scopeOf,
  type VersionInput,
  VIDEO_STAGE_KEYS,
  VIDEO_STAGE_LABEL,
  type VideoInput,
  type VideoStageKey,
  type VideoUpdate,
} from "@gm/shared";
import { AuditService, changes } from "../audit/audit.service.js";
import { lockRow } from "../common/lock-row.js";
import { FilesService } from "../files/files.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { CyclesService } from "./cycles.service.js";
import { ProductionSettingsService } from "./production-settings.service.js";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const today = () => new Date().toISOString().slice(0, 10);
const RUNNING = ["active", "renewal_due", "paused"] as const;

const SUMMARY = {
  client: { select: { id: true, name: true, code: true } },
  agreement: { select: { id: true, title: true, revisionsPerDeliverable: true } },
  cycle: { select: { month: true } },
  versions: { orderBy: { number: "desc" }, take: 1, select: { label: true, status: true } },
} as const satisfies Prisma.VideoInclude;
type Summary = Prisma.VideoGetPayload<{ include: typeof SUMMARY }>;

type StepMap = Record<string, { by: string | null; at: string }>;
type QcMap = Record<string, { result: "pass" | "fail"; note: string | null; by: string | null; at: string }>;

export interface VideoFilter {
  clientId?: string;
  stage?: string;
  editorId?: string;
  shootId?: string;
  q?: string;
  /** overdue · week (due within seven days) */
  due?: string;
}

/**
 * Videos (P2-07 to P2-11). Each has a code from the agency's format, a stage that moves only when its checks pass, the
 * agency's edit steps and quality checks, versions sent to the client with their feedback, and revisions counted
 * against the agreement's allowance. People limited to their own videos see the ones they edit, shoot or direct.
 */
@Injectable()
export class VideosService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly settings: ProductionSettingsService,
    private readonly cycles: CyclesService,
    private readonly files: FilesService,
  ) {}

  /** Roles limited to their own videos: the ones they edit, shoot or direct. */
  private scope(): Prisma.VideoWhereInput {
    const me = this.tenant.userId;
    if (scopeOf(this.tenant.permissions, "production") !== "own") return {};
    if (!me) throw new ForbiddenException("Sign in to see your videos.");
    return { OR: [{ editorId: me }, { cameraId: me }, { directorId: me }] };
  }

  private async names(ids: (string | null | undefined)[]) {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (!wanted.length) return new Map<string, string>();
    const people = await this.tenant.db.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
    return new Map(people.map((p) => [p.id, p.name]));
  }

  private summary(v: Summary, names: Map<string, string>, s: ProductionSettings) {
    const who = (id: string | null) => (id ? { id, name: names.get(id) ?? null } : null);
    const steps = v.editSteps as StepMap;
    const qc = v.qc as QcMap;
    const due = day(v.dueDate);
    return {
      id: v.id,
      code: v.code,
      title: v.title,
      client: v.client,
      format: v.format,
      aspect: v.aspect,
      urgency: v.urgency as "rush" | "priority" | "standard",
      stage: v.stage as VideoStageKey,
      dueDate: due,
      publishDate: day(v.publishDate),
      editor: who(v.editorId),
      director: who(v.directorId),
      camera: who(v.cameraId),
      clipNo: v.clipNo,
      protected: !!v.protectedAt,
      editProgress: { done: s.editSteps.filter((x) => steps[x]).length, total: s.editSteps.length },
      qcProgress: {
        passed: s.qcChecks.filter((c) => qc[c.key]?.result === "pass").length,
        failed: s.qcChecks.filter((c) => qc[c.key]?.result === "fail").length,
        total: s.qcChecks.length,
      },
      revisionsUsed: v.revisionsUsed,
      allowance: v.agreement?.revisionsPerDeliverable ?? null,
      overdue: !!due && due < today() && !(DONE_STAGES as string[]).includes(v.stage),
      month: v.cycle ? v.cycle.month.toISOString().slice(0, 7) : (due?.slice(0, 7) ?? null),
      shootId: v.shootId,
      latestVersion: v.versions[0] ? { label: v.versions[0].label, status: v.versions[0].status } : null,
      platforms: v.platforms,
    };
  }

  async list(f: VideoFilter) {
    const week = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const rows = await this.tenant.db.video.findMany({
      where: {
        AND: [
          this.scope(),
          {
            ...(f.clientId && { clientId: f.clientId }),
            ...(f.stage && { stage: f.stage as VideoStageKey }),
            ...(f.editorId && { editorId: f.editorId }),
            ...(f.shootId && { shootId: f.shootId }),
            ...(f.q && {
              OR: [
                { code: { contains: f.q, mode: "insensitive" as const } },
                { title: { contains: f.q, mode: "insensitive" as const } },
                { clipNo: { contains: f.q } },
              ],
            }),
            ...(f.due === "overdue" && { dueDate: { lt: utc(today()) }, stage: { notIn: [...DONE_STAGES] } }),
            ...(f.due === "week" && { dueDate: { gte: utc(today()), lte: utc(week) }, stage: { notIn: [...DONE_STAGES] } }),
          },
        ],
      },
      include: SUMMARY,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { code: "asc" }],
      take: 2000,
    });
    const [names, s] = await Promise.all([this.names(rows.flatMap((r) => [r.editorId, r.directorId, r.cameraId])), this.settings.get()]);
    return rows.map((r) => this.summary(r, names, s));
  }

  private async find(id: string) {
    const v = await this.tenant.db.video.findFirst({ where: { AND: [{ id }, this.scope()] }, include: SUMMARY });
    if (!v) throw new NotFoundException("No video with that id that you can see.");
    return v;
  }

  /** The video page: everything about one video, and where it may move next. */
  async get(id: string) {
    const v = await this.find(id);
    const [s, versions, requests, history, logs, content, shoot, files] = await Promise.all([
      this.settings.get(),
      this.tenant.db.videoVersion.findMany({ where: { videoId: id }, include: { comments: { orderBy: { createdAt: "asc" } } }, orderBy: { number: "desc" } }),
      this.tenant.db.changeRequest.findMany({ where: { videoId: id }, orderBy: { createdAt: "desc" } }),
      this.tenant.db.videoStageChange.findMany({ where: { videoId: id }, orderBy: { at: "desc" }, take: 100 }),
      this.tenant.db.videoTimeLog.findMany({ where: { videoId: id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
      v.contentItemId
        ? this.tenant.db.contentItem.findUnique({
            where: { id: v.contentItemId },
            include: { versions: { where: { status: "approved" }, orderBy: { number: "desc" }, take: 1 } },
          })
        : Promise.resolve(null),
      v.shootId
        ? this.tenant.db.shoot.findUnique({ where: { id: v.shootId }, select: { id: true, title: true, date: true, status: true } })
        : Promise.resolve(null),
      this.files.listFor("video", id),
    ]);
    const steps = v.editSteps as StepMap;
    const qc = v.qc as QcMap;
    const names = await this.names([
      v.editorId,
      v.directorId,
      v.cameraId,
      v.protectedBy,
      ...Object.values(steps).map((x) => x.by),
      ...Object.values(qc).map((x) => x.by),
      ...versions.map((x) => x.createdBy),
      ...history.map((h) => h.by),
      ...logs.map((l) => l.userId),
      ...requests.map((r) => r.createdBy),
    ]);
    const who = (pid: string | null) => (pid ? { id: pid, name: names.get(pid) ?? null } : null);
    const fileById = new Map(files.map((f) => [f.id, f]));
    const latest = versions[0]?.status as "internal" | "sent" | "changes_requested" | "approved" | undefined;
    const facts = { stage: v.stage as VideoStageKey, protectedAt: v.protectedAt, editSteps: steps, qc, latestVersion: latest ?? null };
    const logged = logs.reduce((n, l) => n + l.minutes, 0);
    const script = content?.versions[0];
    return {
      ...this.summary(v, names, s),
      agreement: v.agreement,
      plannedMinutes: v.plannedMinutes,
      loggedMinutes: logged,
      delayReason: v.delayReason,
      notes: v.notes,
      protectedAt: v.protectedAt,
      protectedBy: who(v.protectedBy),
      editSteps: s.editSteps.map((step) => ({ step, done: !!steps[step], by: who(steps[step]?.by ?? null), at: steps[step]?.at ?? null })),
      qc: s.qcChecks.map((c) => ({
        ...c,
        result: qc[c.key]?.result ?? null,
        note: qc[c.key]?.note ?? null,
        by: who(qc[c.key]?.by ?? null),
        at: qc[c.key]?.at ?? null,
      })),
      versions: versions.map((x) => ({
        id: x.id,
        label: x.label,
        number: x.number,
        status: x.status as "internal" | "sent" | "changes_requested" | "approved",
        duration: x.duration,
        notes: x.notes,
        link: x.link,
        file: x.fileId ? (fileById.get(x.fileId) ?? null) : null,
        sentAt: x.sentAt,
        decidedAt: x.decidedAt,
        by: who(x.createdBy),
        createdAt: x.createdAt,
        comments: x.comments.map((c) => ({ id: c.id, author: c.author, at: c.timestampSec, text: c.text, resolved: c.resolved, createdAt: c.createdAt })),
      })),
      changeRequests: requests.map((r) => ({
        id: r.id,
        kind: r.kind,
        summary: r.summary,
        estimate: r.estimate,
        dateImpactDays: r.dateImpactDays,
        status: r.status,
        by: who(r.createdBy),
        createdAt: r.createdAt,
      })),
      history: history.map((h) => ({ from: h.from, to: h.to, note: h.note, by: who(h.by), at: h.at })),
      timeLogs: logs.map((l) => ({ id: l.id, date: day(l.date), minutes: l.minutes, note: l.note, by: who(l.userId) })),
      content: content
        ? { id: content.id, title: content.title, script: script ? { hook: script.hook, body: script.body, cta: script.cta, onScreen: script.onScreen } : null }
        : null,
      shoot: shoot ? { ...shoot, date: day(shoot.date) } : null,
      files,
      /** Where it may go from here, and why not. */
      moves: VIDEO_STAGE_KEYS.filter((to) => to !== v.stage).map((to) => ({ to, blocked: moveBlock(facts, to, s) })),
    };
  }

  // ─── Making a video ───────────────────────────────────────────────

  /** The next free code for the client and month in the agency's format. */
  private async nextCode(tx: TenantTx, format: string, clientCode: string, month: string) {
    const start = (await tx.video.count({ where: { client: { code: clientCode }, cycle: { month: utc(`${month}-01`) } } })) + 1;
    for (let seq = start; seq < start + 500; seq++) {
      const code = formatVideoCode(format, clientCode, month, seq);
      if (!(await tx.video.findFirst({ where: { code }, select: { id: true } }))) return code;
    }
    throw new ConflictException("Could not find a free video code — check the code format in Settings → Production.");
  }

  /** Inside a transaction: makes the video, in its agreement's cycle for the due month. */
  async insert(
    tx: TenantTx,
    input: VideoInput & { aspect: string; urgency: string; platforms: string[] },
    extra: {
      contentItemId?: string;
      stage?: VideoStageKey;
      /** Imported from a tracking sheet (P2-16): their own code, clip numbers and backup, and nobody is notified. */
      imported?: { fileName: string; code?: string; clipNo?: string; footageProtected?: boolean };
    } = {},
  ) {
    const client = await tx.client.findFirst({ where: { id: input.clientId }, select: { id: true, code: true, name: true, archivedAt: true } });
    if (!client) throw new BadRequestException({ message: "Choose one of your clients.", issues: [{ path: "clientId", message: "Choose the client" }] });
    if (client.archivedAt) throw new ConflictException("This client is archived.");
    const agreement = input.agreementId
      ? await tx.agreement.findFirst({ where: { id: input.agreementId, clientId: client.id } })
      : await tx.agreement.findFirst({ where: { clientId: client.id, status: { in: [...RUNNING] } }, orderBy: { startDate: "desc" } });
    const s = await this.settings.get();
    const month = input.dueDate.slice(0, 7);
    const cycleId = agreement ? await this.cycles.ensure(tx, agreement, month) : null;
    const planned = s.formats.find((f) => f.name === input.format)?.minutes ?? 0;
    const imported = extra.imported;
    for (let attempt = 0; ; attempt++) {
      const code = imported?.code || (await this.nextCode(tx, s.videoCodeFormat, client.code, month));
      try {
        const v = await tx.video.create({
          data: {
            agencyId: this.tenant.agencyId,
            clientId: client.id,
            agreementId: agreement?.id,
            cycleId,
            contentItemId: extra.contentItemId,
            code,
            title: input.title,
            format: input.format,
            aspect: input.aspect,
            urgency: input.urgency,
            stage: extra.stage ?? "planned",
            dueDate: utc(input.dueDate),
            publishDate: input.publishDate ? utc(input.publishDate) : undefined,
            editorId: input.editorId ?? undefined,
            directorId: input.directorId ?? undefined,
            cameraId: input.cameraId ?? undefined,
            platforms: input.platforms.length ? input.platforms : (agreement?.platforms ?? []),
            plannedMinutes: planned,
            notes: input.notes,
            clipNo: imported?.clipNo,
            ...(imported?.footageProtected ? { protectedAt: new Date(), protectedBy: this.tenant.userId } : {}),
            createdBy: this.tenant.userId,
          },
        });
        await tx.videoStageChange.create({ data: { agencyId: this.tenant.agencyId, videoId: v.id, to: v.stage, by: this.tenant.userId } });
        await this.audit.record(tx, {
          action: "create",
          entity: "video",
          entityId: v.id,
          after: { code, title: v.title, client: client.name, dueDate: input.dueDate, ...(imported && { stage: v.stage, via: imported.fileName }) },
        });
        if (!imported)
          await this.notifications.notify(
            tx,
            { users: [v.editorId, v.directorId, v.cameraId] },
            { kind: "video_assigned", title: `New video for you: ${code}`, body: v.title, link: `/app/production/${v.id}` },
          );
        return v.id;
      } catch (e) {
        // Two videos made at the same moment can pick the same code: try the next one (never for a code given to us).
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 3 && !imported?.code) continue;
        throw e;
      }
    }
  }

  async create(input: VideoInput & { aspect: string; urgency: string; platforms: string[] }) {
    await this.people([input.editorId, input.directorId, input.cameraId]);
    const id = await this.tenant.tx((tx) => this.insert(tx, input));
    return this.get(id);
  }

  /** People given a video must be on the team. */
  private async people(ids: (string | null | undefined)[]) {
    const wanted = [...new Set(ids.filter((x): x is string => !!x))];
    if (!wanted.length) return;
    const n = await this.tenant.db.membership.count({ where: { agencyId: this.tenant.agencyId, userId: { in: wanted } } });
    if (n !== wanted.length)
      throw new BadRequestException({ message: "Pick people from your team.", issues: [{ path: "editorId", message: "Pick someone in your team" }] });
  }

  async update(id: string, input: VideoUpdate) {
    const v = await this.find(id);
    await this.people([input.editorId, input.directorId, input.cameraId]);
    const s = await this.settings.get();
    const data: Prisma.VideoUncheckedUpdateInput = {
      ...input,
      dueDate: input.dueDate ? utc(input.dueDate) : undefined,
      publishDate: input.publishDate === undefined ? undefined : input.publishDate ? utc(input.publishDate) : null,
      plannedMinutes: input.format && input.format !== v.format ? (s.formats.find((f) => f.name === input.format)?.minutes ?? v.plannedMinutes) : undefined,
    };
    const before = {
      title: v.title,
      format: v.format,
      urgency: v.urgency,
      dueDate: day(v.dueDate),
      editorId: v.editorId,
      directorId: v.directorId,
      cameraId: v.cameraId,
      clipNo: v.clipNo,
    };
    const after = { ...before, ...Object.fromEntries(Object.entries(input).filter(([k, val]) => val !== undefined && k in before)) };
    await this.tenant.tx(async (tx) => {
      // A new due month moves the video into that month's cycle.
      if (input.dueDate && v.agreementId && input.dueDate.slice(0, 7) !== day(v.dueDate)?.slice(0, 7)) {
        const a = await tx.agreement.findUniqueOrThrow({ where: { id: v.agreementId } });
        data.cycleId = await this.cycles.ensure(tx, a, input.dueDate.slice(0, 7));
      }
      await tx.video.update({ where: { id }, data });
      const diff = changes(before, after);
      if (diff)
        await this.audit.record(tx, {
          action: "update",
          entity: "video",
          entityId: id,
          before: { code: v.code, ...diff.before },
          after: { code: v.code, ...diff.after },
        });
      const newly = [input.editorId, input.directorId, input.cameraId].filter((p) => p && p !== v.editorId && p !== v.directorId && p !== v.cameraId);
      if (newly.length)
        await this.notifications.notify(
          tx,
          { users: newly },
          { kind: "video_assigned", title: `Video assigned to you: ${v.code}`, body: v.title, link: `/app/production/${id}` },
        );
    });
    return this.get(id);
  }

  // ─── Stages ───────────────────────────────────────────────────────

  private async latestVersion(id: string) {
    const v = await this.tenant.db.videoVersion.findFirst({ where: { videoId: id }, orderBy: { number: "desc" } });
    return v;
  }

  private async moveIn(tx: TenantTx, v: { id: string; code: string; title: string; stage: string; editorId: string | null }, to: VideoStageKey, note?: string) {
    // A revision is a new cut, so its quality check starts again.
    const recheck = v.stage === "revision";
    await tx.video.update({ where: { id: v.id }, data: { stage: to, ...(recheck ? { qc: {} } : {}) } });
    await tx.videoStageChange.create({
      data: { agencyId: this.tenant.agencyId, videoId: v.id, from: v.stage as VideoStageKey, to, note, by: this.tenant.userId },
    });
    await this.audit.record(tx, {
      action: "move",
      entity: "video",
      entityId: v.id,
      before: { code: v.code, stage: v.stage },
      after: { code: v.code, stage: to, note: note ?? null, ...(recheck ? { qualityCheck: "starts again" } : {}) },
    });
    if (to === "internal_qc")
      await this.notifications.notify(
        tx,
        { can: { area: "production", level: "approve" } },
        { kind: "qc_ready", title: `Ready for the quality check: ${v.code}`, body: v.title, link: `/app/production/${v.id}` },
      );
  }

  /** Moves a video when its checks allow it (P2-08). */
  async move(id: string, to: VideoStageKey, note?: string) {
    const v = await this.find(id);
    const [s, latest, logged] = await Promise.all([
      this.settings.get(),
      this.latestVersion(id),
      this.tenant.db.videoTimeLog.aggregate({ where: { videoId: id }, _sum: { minutes: true } }),
    ]);
    const block = moveBlock(
      {
        stage: v.stage as VideoStageKey,
        protectedAt: v.protectedAt,
        editSteps: v.editSteps as StepMap,
        qc: v.qc as QcMap,
        latestVersion: (latest?.status as never) ?? null,
      },
      to,
      s,
    );
    if (block) throw new ConflictException(block);
    // Editing that took longer than planned needs its reason before it moves on.
    if (
      v.stage === "editing" &&
      VIDEO_STAGE_KEYS.indexOf(to) > VIDEO_STAGE_KEYS.indexOf("editing") &&
      v.plannedMinutes &&
      (logged._sum.minutes ?? 0) > v.plannedMinutes &&
      !v.delayReason
    )
      throw new ConflictException("Editing took longer than planned — give the reason on the video first.");
    await this.tenant.tx((tx) => this.moveIn(tx, v, to, note));
    return this.get(id);
  }

  async editStep(id: string, step: string, done: boolean) {
    const v = await this.find(id);
    const s = await this.settings.get();
    if (!s.editSteps.includes(step)) throw new BadRequestException("That is not one of your edit steps.");
    await this.tenant.tx(async (tx) => {
      await lockRow(tx, "videos", id);
      const cur = await tx.video.findUniqueOrThrow({ where: { id }, select: { editSteps: true } });
      const steps = { ...(cur.editSteps as StepMap) };
      if (done) steps[step] = { by: this.tenant.userId ?? null, at: new Date().toISOString() };
      else delete steps[step];
      await tx.video.update({ where: { id }, data: { editSteps: steps as Prisma.InputJsonValue } });
      await this.audit.record(tx, { action: done ? "edit_step" : "edit_step_undone", entity: "video", entityId: id, after: { code: v.code, step } });
    });
    return this.get(id);
  }

  /** Footage backed up and verified (VP): needed before the video leaves Shot. */
  async protect(id: string, done: boolean) {
    const v = await this.find(id);
    await this.tenant.tx(async (tx) => {
      await tx.video.update({
        where: { id },
        data: done ? { protectedAt: new Date(), protectedBy: this.tenant.userId } : { protectedAt: null, protectedBy: null },
      });
      await this.audit.record(tx, { action: done ? "protect" : "unprotect", entity: "video", entityId: id, after: { code: v.code, footageProtected: done } });
    });
    return this.get(id);
  }

  /** A quality check result (production: approve). A failed check goes back to the editor with the note. */
  async qc(id: string, check: string, result: "pass" | "fail" | null, note?: string) {
    if (!allows(this.tenant.permissions, "production", "approve"))
      throw new ForbiddenException("Quality checks are done by people who may approve production.");
    const v = await this.find(id);
    const s = await this.settings.get();
    const c = s.qcChecks.find((x) => x.key === check);
    if (!c) throw new BadRequestException("That is not one of your quality checks.");
    if (result === "fail" && !note)
      throw new BadRequestException({ message: "Say what must be fixed.", issues: [{ path: "note", message: "Say what must be fixed" }] });
    await this.tenant.tx(async (tx) => {
      await lockRow(tx, "videos", id);
      const cur = await tx.video.findUniqueOrThrow({ where: { id }, select: { qc: true } });
      const qc = { ...(cur.qc as QcMap) };
      if (result) qc[check] = { result, note: note ?? null, by: this.tenant.userId ?? null, at: new Date().toISOString() };
      else delete qc[check];
      await tx.video.update({ where: { id }, data: { qc: qc as Prisma.InputJsonValue } });
      await this.audit.record(tx, { action: "qc", entity: "video", entityId: id, after: { code: v.code, check: c.label, result, note: note ?? null } });
      if (result === "fail")
        await this.notifications.notify(
          tx,
          { users: [v.editorId] },
          { kind: "qc_failed", title: `Failed check on ${v.code}: ${c.label}`, body: note, link: `/app/production/${id}` },
        );
    });
    return this.get(id);
  }

  async logTime(id: string, input: { date: string; minutes: number; note?: string }) {
    await this.find(id);
    const userId = this.tenant.userId;
    if (!userId) throw new ForbiddenException("Sign in to log time.");
    await this.tenant.db.videoTimeLog.create({
      data: { agencyId: this.tenant.agencyId, videoId: id, userId, date: utc(input.date), minutes: input.minutes, note: input.note },
    });
    return this.get(id);
  }

  async removeTime(id: string, logId: string) {
    await this.find(id);
    const log = await this.tenant.db.videoTimeLog.findFirst({ where: { id: logId, videoId: id } });
    if (!log) throw new NotFoundException("No time entry with that id.");
    if (log.userId !== this.tenant.userId && !allows(this.tenant.permissions, "production", "approve"))
      throw new ForbiddenException("You can remove your own time entries.");
    await this.tenant.db.videoTimeLog.delete({ where: { id: logId } });
    return this.get(id);
  }

  // ─── Versions and the client's review ──────────────────────────────

  async addVersion(id: string, input: VersionInput) {
    const v = await this.find(id);
    if (input.fileId) {
      const f = await this.tenant.db.fileObject.findFirst({ where: { id: input.fileId, entity: "video", entityId: id, status: "ready" } });
      if (!f) throw new BadRequestException({ message: "Upload the video file again.", issues: [{ path: "fileId", message: "Upload the file again" }] });
    }
    const latest = await this.latestVersion(id);
    if (latest?.status === "sent") throw new ConflictException(`${latest.label} is with the client — record their answer first.`);
    const number = (latest?.number ?? 0) + 1;
    await this.tenant.tx(async (tx) => {
      const x = await tx.videoVersion.create({
        data: {
          agencyId: this.tenant.agencyId,
          videoId: id,
          number,
          label: `v${number}`,
          status: "internal",
          fileId: input.fileId,
          link: input.link,
          duration: input.duration,
          notes: input.notes,
          createdBy: this.tenant.userId,
        },
      });
      await this.audit.record(tx, { action: "create", entity: "video_version", entityId: x.id, after: { code: v.code, version: x.label } });
    });
    return this.get(id);
  }

  /** Sends the latest version to the client: the video moves to Client review (the quality check must be passed). */
  async sendVersion(id: string) {
    const v = await this.find(id);
    const latest = await this.latestVersion(id);
    if (!latest || latest.status !== "internal") throw new ConflictException("Add the new version first.");
    const s = await this.settings.get();
    const block = moveBlock(
      { stage: v.stage as VideoStageKey, protectedAt: v.protectedAt, editSteps: v.editSteps as StepMap, qc: v.qc as QcMap, latestVersion: "sent" },
      "client_review",
      s,
    );
    if (block) throw new ConflictException(block);
    await this.tenant.tx(async (tx) => {
      await tx.videoVersion.update({ where: { id: latest.id }, data: { status: "sent", sentAt: new Date() } });
      await this.moveIn(tx, v, "client_review", `${latest.label} sent to the client`);
    });
    return this.get(id);
  }

  /** The client's answer on the version they have: approved, or changes (the video goes to Revision). */
  async decide(id: string, d: ClientDecision) {
    const v = await this.find(id);
    const latest = await this.latestVersion(id);
    if (!latest || latest.status !== "sent") throw new ConflictException("No version is with the client.");
    const client = await this.tenant.db.client.findUniqueOrThrow({ where: { id: v.clientId }, select: { name: true } });
    await this.tenant.tx(async (tx) => {
      await tx.videoVersion.update({ where: { id: latest.id }, data: { status: d.approved ? "approved" : "changes_requested", decidedAt: new Date() } });
      if (d.note)
        await tx.reviewComment.create({
          data: { agencyId: this.tenant.agencyId, versionId: latest.id, author: client.name, text: d.note, createdBy: this.tenant.userId },
        });
      await this.moveIn(
        tx,
        v,
        d.approved ? "approved" : "revision",
        d.approved ? `${latest.label} approved by the client` : `Changes asked on ${latest.label}`,
      );
      if (!d.approved)
        await this.notifications.notify(
          tx,
          { users: [v.editorId] },
          { kind: "revision_requested", title: `Changes asked on ${v.code} ${latest.label}`, body: d.note, link: `/app/production/${id}` },
        );
    });
    return this.get(id);
  }

  async comment(id: string, versionId: string, input: { text: string; at?: number; author?: string }) {
    await this.find(id);
    const version = await this.tenant.db.videoVersion.findFirst({ where: { id: versionId, videoId: id } });
    if (!version) throw new NotFoundException("No version with that id on this video.");
    const me = this.tenant.userId ? await this.tenant.db.user.findUnique({ where: { id: this.tenant.userId }, select: { name: true } }) : null;
    await this.tenant.db.reviewComment.create({
      data: {
        agencyId: this.tenant.agencyId,
        versionId,
        author: input.author ?? me?.name ?? "Team",
        timestampSec: input.at,
        text: input.text,
        createdBy: this.tenant.userId,
      },
    });
    return this.get(id);
  }

  async resolveComment(id: string, commentId: string, resolved: boolean) {
    await this.find(id);
    const c = await this.tenant.db.reviewComment.findFirst({ where: { id: commentId, version: { videoId: id } } });
    if (!c) throw new NotFoundException("No comment with that id on this video.");
    await this.tenant.db.reviewComment.update({ where: { id: commentId }, data: { resolved } });
    return this.get(id);
  }

  // ─── Revisions and change requests (P2-11) ────────────────────────

  /**
   * Feedback, classified: our correction (no allowance used), an included revision (one of the agreement's revisions per
   * video), or a change request (new work: estimate, client approval, then done).
   */
  async request(input: ChangeRequestInput) {
    const v = await this.find(input.videoId);
    const allowance = v.agreement?.revisionsPerDeliverable ?? 0;
    const used = await this.tenant.db.changeRequest.count({ where: { videoId: v.id, kind: "included_revision", status: { not: "rejected" } } });
    if (input.kind === "included_revision" && used >= allowance)
      throw new ConflictException(`The ${allowance} included revision${allowance === 1 ? " is" : "s are"} used — make it a change request.`);
    const latest = await this.latestVersion(v.id);
    const id = await this.tenant.tx(async (tx) => {
      const r = await tx.changeRequest.create({
        data: {
          agencyId: this.tenant.agencyId,
          clientId: v.clientId,
          videoId: v.id,
          versionId: latest?.id,
          kind: input.kind,
          summary: input.summary,
          estimate: input.estimate,
          dateImpactDays: input.dateImpactDays,
          createdBy: this.tenant.userId,
        },
      });
      if (input.kind === "included_revision") await tx.video.update({ where: { id: v.id }, data: { revisionsUsed: used + 1 } });
      await this.audit.record(tx, {
        action: "create",
        entity: "change_request",
        entityId: r.id,
        after: { code: v.code, kind: input.kind, summary: input.summary, estimate: input.estimate ?? null },
      });
      return r.id;
    });
    return { id, video: await this.get(v.id) };
  }

  /** Change requests: open → estimate sent (awaiting the client) → approved or rejected → done. Others: open → done. */
  async requestStep(id: string, status: "awaiting_client" | "approved" | "rejected" | "done" | "open") {
    const r = await this.tenant.db.changeRequest.findFirst({ where: { id } });
    if (!r || !r.videoId) throw new NotFoundException("No change request with that id.");
    const v = await this.find(r.videoId);
    const allowed: Record<string, string[]> =
      r.kind === "change_request"
        ? { open: ["awaiting_client"], awaiting_client: ["approved", "rejected"], approved: ["done"], rejected: ["open"], done: ["open"] }
        : { open: ["done"], done: ["open"] };
    if (!allowed[r.status]?.includes(status)) throw new ConflictException(`It cannot go from ${r.status.replace("_", " ")} to ${status.replace("_", " ")}.`);
    await this.tenant.tx(async (tx) => {
      await tx.changeRequest.update({ where: { id }, data: { status, ...(["approved", "rejected"].includes(status) && { decidedAt: new Date() }) } });
      await this.audit.record(tx, {
        action: "update",
        entity: "change_request",
        entityId: id,
        before: { code: v.code, status: r.status },
        after: { code: v.code, status },
      });
    });
    return this.get(v.id);
  }

  /** Every open request across videos (the Revisions page). */
  async requests(status?: string) {
    const rows = await this.tenant.db.changeRequest.findMany({
      where: { ...(status ? { status } : { status: { notIn: ["done", "rejected"] } }), video: this.scope() },
      include: {
        video: { select: { id: true, code: true, title: true, revisionsUsed: true, agreement: { select: { revisionsPerDeliverable: true } } } },
        client: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      summary: r.summary,
      estimate: r.estimate,
      dateImpactDays: r.dateImpactDays,
      status: r.status,
      createdAt: r.createdAt,
      client: r.client?.name ?? null,
      video: r.video
        ? {
            id: r.video.id,
            code: r.video.code,
            title: r.video.title,
            revisionsUsed: r.video.revisionsUsed,
            allowance: r.video.agreement?.revisionsPerDeliverable ?? null,
          }
        : null,
    }));
  }

  /** Stage label for messages. */
  static label(s: string) {
    return VIDEO_STAGE_LABEL[s as VideoStageKey] ?? s;
  }
}
