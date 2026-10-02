import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import {
  AGREEMENT_IMPORT_STATUS_LABEL,
  ATTENDANCE_STATUS_LABEL,
  type AttendanceImport,
  dayStatus,
  AGREEMENT_IMPORT_STATUSES,
  type AgreementImport,
  allows,
  type ClientImport,
  daysUntil,
  DONE_STAGES,
  exceeds,
  FITMENT_QUADRANTS,
  type ImportKind,
  type ImportReport,
  type LeadImport,
  OWNER_ROLE,
  packageTotals,
  permissionArea,
  scopeOf,
  type TeamImport,
  VIDEO_STAGE_KEYS,
  VIDEO_STAGE_LABEL,
  type VideoImport,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { Outbox } from "../auth/outbox.js";
import { AgreementsService } from "../clients/agreements.service.js";
import { PipelineService } from "../crm/pipeline.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ProductionSettingsService } from "../production/production-settings.service.js";
import { VideosService } from "../production/videos.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { matrixOf } from "../team/roles.service.js";
import { AttendanceService, offDay } from "../people/attendance.service.js";
import { TeamService } from "../team/team.service.js";
import { CheckReport, dateText, money } from "./check-report.js";

const UNDO_HOURS = 24;
const INVITATION_DAYS = 7;
type Issue = { path: string; message: string };
const day = (d: Date) => d.toISOString().slice(0, 10);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const today = () => day(new Date());
const json = (r: ImportReport) => r as unknown as Prisma.InputJsonValue;

const FITMENT: Record<(typeof FITMENT_QUADRANTS)[number], "amazing" | "bread_winning" | "convenience" | "dangerous"> = {
  Amazing: "amazing",
  "Bread-winning": "bread_winning",
  Convenience: "convenience",
  Dangerous: "dangerous",
};

/** Problems found in the rows: nothing is saved, and the importer shows each one against its row and column. */
function refuse(issues: Issue[]) {
  if (issues.length) throw new BadRequestException({ message: `${issues.length} problems in the rows — nothing was imported.`, issues });
}

/**
 * Self-service imports (P1-31): an agency brings in its own clients and team from a spreadsheet. All rows are
 * checked again here and saved in one transaction, or none are. Each import is in the history with its check report
 * (P3-12) and can be undone within 24 hours if nothing it created has changed since.
 */
@Injectable()
export class ImportsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly team: TeamService,
    private readonly outbox: Outbox,
    private readonly pipeline: PipelineService,
    private readonly videos: VideosService,
    private readonly productionSettings: ProductionSettingsService,
    private readonly agreements: AgreementsService,
    private readonly notifications: NotificationsService,
    private readonly attendance: AttendanceService,
  ) {}

  private canEdit(kind: ImportKind) {
    const area = ({ clients: "clients", leads: "crm", team: "team", videos: "production", agreements: "agreements", attendance: "hr" } as const)[kind];
    return allows(this.tenant.permissions, area, "edit") && (kind !== "videos" || scopeOf(this.tenant.permissions, "production") === "all");
  }

  private async present(rows: Prisma.ImportGetPayload<object>[]) {
    const ids = [...new Set(rows.map((r) => r.createdBy).filter((id): id is string => !!id))];
    const people = ids.length ? await this.tenant.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const names = new Map(people.map((p) => [p.id, p.name]));
    const now = Date.now();
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as ImportKind,
      fileName: r.fileName,
      rowCount: r.rowCount,
      createdAt: r.createdAt,
      createdBy: r.createdBy ? (names.get(r.createdBy) ?? null) : null,
      undoneAt: r.undoneAt,
      canUndo: !r.undoneAt && now - r.createdAt.getTime() < UNDO_HOURS * 3_600_000,
      hasReport: r.report !== null,
    }));
  }

  async list() {
    const kinds = (["clients", "team", "leads", "videos", "agreements", "attendance"] as const).filter((k) => this.canEdit(k));
    return this.present(await this.tenant.db.import.findMany({ where: { kind: { in: kinds } }, orderBy: { createdAt: "desc" }, take: 50 }));
  }

  /** One import with its check report (P3-12). */
  async get(id: string) {
    const r = await this.tenant.db.import.findFirst({ where: { id } });
    if (!r || !this.canEdit(r.kind as ImportKind)) throw new NotFoundException("No import with that id.");
    const [row] = await this.present([r]);
    return { ...row!, report: (r.report as unknown as ImportReport | null) ?? null };
  }

  // ─── Clients ────────────────────────────────────────────────────────

  async importClients(input: ClientImport) {
    const { fileName, rows } = input;
    const agencyId = this.tenant.agencyId;
    const userId = this.tenant.userId;
    if (!userId) throw new UnauthorizedException("Sign in to import.");
    const ownOnly = scopeOf(this.tenant.permissions, "clients") === "own";

    const [existing, members] = await Promise.all([
      this.tenant.db.client.findMany({ select: { code: true, name: true } }),
      this.tenant.db.user.findMany({ where: { memberships: { some: { agencyId } } }, select: { id: true, email: true } }),
    ]);
    const codes = new Map(existing.map((c) => [c.code, c.name]));
    const names = new Set(existing.map((c) => c.name.toLowerCase()));
    const byEmail = new Map(members.map((m) => [m.email.toLowerCase(), m.id]));
    const issues: Issue[] = [];
    const seenCodes = new Map<string, number>();
    const owners: (string | undefined)[] = [];

    rows.forEach((r, i) => {
      const used = codes.get(r.code);
      if (used) issues.push({ path: `rows.${i}.code`, message: `Code ${r.code} is already used by ${used}` });
      const first = seenCodes.get(r.code);
      if (first !== undefined) issues.push({ path: `rows.${i}.code`, message: `Same code as row ${first + 1}` });
      else seenCodes.set(r.code, i);
      if (names.has(r.name.toLowerCase())) issues.push({ path: `rows.${i}.name`, message: "Already in your clients" });

      let owner: string | undefined;
      if (r.accountOwnerEmail) {
        owner = byEmail.get(r.accountOwnerEmail);
        if (!owner) issues.push({ path: `rows.${i}.accountOwnerEmail`, message: "No one in your team has this email" });
        else if (ownOnly && owner !== userId) issues.push({ path: `rows.${i}.accountOwnerEmail`, message: "Your role adds clients for yourself only" });
      }
      // Someone who may only handle their own clients becomes the account owner of what they import.
      owners.push(ownOnly ? userId : owner);
    });
    refuse(issues);

    const report = new CheckReport(input)
      .total("Clients", rows.length)
      .total(
        "Contacts",
        rows.reduce((n, r) => n + r.contacts.length, 0),
      )
      .total("With an account owner", owners.filter(Boolean).length);
    rows.forEach((r, i) => {
      if (!r.contacts.some((c) => c.approver)) report.note(i, `${r.name}: nobody approves work yet — mark a contact as an approver`);
    });

    return this.tenant.tx(async (tx) => {
      const ids: string[] = [];
      for (const [i, r] of rows.entries()) {
        const client = await tx.client.create({
          data: {
            agencyId,
            code: r.code,
            name: r.name,
            industry: r.industry,
            city: r.city,
            stage: r.stage ? (r.stage.toLowerCase() as Lowercase<NonNullable<typeof r.stage>>) : undefined,
            fitment: r.fitment ? FITMENT[r.fitment] : undefined,
            whatsappGroupUrl: r.whatsappGroupUrl,
            accountOwnerId: owners[i],
            contacts: { create: r.contacts.map((c) => ({ ...c, agencyId })) },
          },
          select: { id: true, code: true, name: true },
        });
        ids.push(client.id);
        await this.audit.record(tx, {
          action: "create",
          entity: "client",
          entityId: client.id,
          after: { code: client.code, name: client.name, via: fileName },
        });
      }
      const done = report.done(ids.length);
      const record = await tx.import.create({
        data: { agencyId, kind: "clients", fileName, rowCount: rows.length, createdIds: ids, createdBy: userId, report: json(done) },
      });
      await this.audit.record(tx, { action: "import", entity: "import", entityId: record.id, after: { kind: "clients", fileName, rows: rows.length } });
      return { id: record.id, created: ids.length, report: done };
    });
  }

  // ─── Team ───────────────────────────────────────────────────────────

  async importTeam(input: TeamImport) {
    const { fileName, rows } = input;
    const agencyId = this.tenant.agencyId;
    const userId = this.tenant.userId;
    if (!userId) throw new UnauthorizedException("Sign in to import.");
    const isOwner = this.tenant.role === OWNER_ROLE;

    const [roles, members] = await Promise.all([
      this.tenant.db.role.findMany({ select: { key: true, name: true, permissions: true } }),
      this.tenant.db.user.findMany({ where: { memberships: { some: { agencyId } } }, select: { email: true } }),
    ]);
    const roleByKey = new Map(roles.map((r) => [r.key, r]));
    const memberEmails = new Set(members.map((m) => m.email.toLowerCase()));
    const issues: Issue[] = [];
    const seen = new Map<string, number>();

    rows.forEach((r, i) => {
      const role = roleByKey.get(r.role);
      if (!role) issues.push({ path: `rows.${i}.role`, message: `There is no role "${r.role}"` });
      else if (!isOwner && role.key === OWNER_ROLE) issues.push({ path: `rows.${i}.role`, message: "Only an owner can make someone an owner" });
      else if (!isOwner) {
        const over = exceeds(matrixOf(role), this.tenant.permissions);
        if (over.length)
          issues.push({ path: `rows.${i}.role`, message: `Goes beyond your own access (${over.map((a) => permissionArea(a).label).join(", ")})` });
      }
      if (memberEmails.has(r.email)) issues.push({ path: `rows.${i}.email`, message: "Already in this agency" });
      const first = seen.get(r.email);
      if (first !== undefined) issues.push({ path: `rows.${i}.email`, message: `Same email as row ${first + 1}` });
      else seen.set(r.email, i);
    });
    refuse(issues);
    const report = new CheckReport(input).total("Invitations", rows.length).groups(
      rows,
      (r) => r.role,
      (k) => `As ${roleByKey.get(k)?.name ?? k}`,
      roles.map((r) => r.key),
    );

    const result = await this.tenant.tx(async (tx) => {
      const ids: string[] = [];
      // A new invitation replaces an earlier one to the same address.
      await tx.invitation.updateMany({ where: { agencyId, email: { in: rows.map((r) => r.email) }, status: "pending" }, data: { status: "canceled" } });
      for (const r of rows) {
        const invitation = await tx.invitation.create({
          data: {
            agencyId,
            email: r.email,
            role: r.role,
            status: "pending",
            inviterId: userId,
            expiresAt: new Date(Date.now() + INVITATION_DAYS * 86_400_000),
          },
          select: { id: true },
        });
        ids.push(invitation.id);
        await this.audit.record(tx, {
          action: "create",
          entity: "invitation",
          entityId: invitation.id,
          after: { email: r.email, role: r.role, via: fileName },
        });
      }
      const done = report.done(ids.length);
      const record = await tx.import.create({
        data: { agencyId, kind: "team", fileName, rowCount: rows.length, createdIds: ids, createdBy: userId, report: json(done) },
      });
      await this.audit.record(tx, { action: "import", entity: "import", entityId: record.id, after: { kind: "team", fileName, rows: rows.length } });
      return { id: record.id, created: ids.length, ids, report: done };
    });

    const [agency, inviter] = await Promise.all([
      this.tenant.db.agency.findUnique({ where: { id: agencyId }, select: { name: true } }),
      this.tenant.db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    for (const [i, r] of rows.entries()) {
      const link = this.team.inviteLink(result.ids[i]!);
      await this.outbox.send({
        to: r.email,
        subject: `${inviter?.name ?? "Someone"} invited you to ${agency?.name ?? "an agency"} on Genie Magnet OS`,
        text: link,
        link,
      });
    }
    return { id: result.id, created: result.created, report: result.report };
  }

  // ─── Leads ──────────────────────────────────────────────────────────

  async importLeads(input: LeadImport) {
    const { fileName, rows } = input;
    const agencyId = this.tenant.agencyId;
    const userId = this.tenant.userId;
    if (!userId) throw new UnauthorizedException("Sign in to import.");
    const ownOnly = scopeOf(this.tenant.permissions, "crm") === "own";
    const [stages, members] = await Promise.all([
      this.pipeline.stages(),
      this.tenant.db.user.findMany({ where: { memberships: { some: { agencyId } } }, select: { id: true, email: true } }),
    ]);
    const stageKeys = new Set(stages.map((s) => s.key));
    const firstOpen = stages.find((s) => s.kind === "open")!.key;
    const byEmail = new Map(members.map((m) => [m.email.toLowerCase(), m.id]));
    const issues: Issue[] = [];
    const owners: (string | null)[] = [];

    rows.forEach((r, i) => {
      if (r.stage && !stageKeys.has(r.stage)) issues.push({ path: `rows.${i}.stage`, message: `There is no stage "${r.stage}" in your pipeline` });
      let owner: string | null = userId;
      if (r.ownerEmail) {
        const found = byEmail.get(r.ownerEmail);
        if (!found) issues.push({ path: `rows.${i}.ownerEmail`, message: "No one in your team has this email" });
        else if (ownOnly && found !== userId) issues.push({ path: `rows.${i}.ownerEmail`, message: "Your role adds leads for yourself only" });
        else owner = found;
      }
      owners.push(owner);
    });
    refuse(issues);
    const stageName = new Map(stages.map((s) => [s.key, s.name]));
    const report = new CheckReport(input)
      .total("Leads", rows.length)
      .money(
        "Value a month",
        rows.reduce((n, r) => n + (r.value ?? 0), 0),
      )
      .groups(
        rows,
        (r) => r.stage ?? firstOpen,
        (k) => `In ${stageName.get(k) ?? k}`,
        stages.map((s) => s.key),
      )
      .total("With a follow-up date", rows.filter((r) => r.nextFollowUp).length);
    const on = today();
    rows.forEach((r, i) => {
      if (r.nextFollowUp && r.nextFollowUp < on) report.note(i, `${r.name}: the follow-up date ${dateText(r.nextFollowUp)} has passed, so it shows as due`);
    });

    return this.tenant.tx(async (tx) => {
      const ids: string[] = [];
      for (const [i, r] of rows.entries()) {
        const { ownerEmail: _ownerEmail, nextFollowUp, ...lead } = r;
        const created = await tx.lead.create({
          data: {
            ...lead,
            agencyId,
            stage: r.stage ?? firstOpen,
            ownerId: owners[i],
            nextFollowUp: nextFollowUp ? new Date(`${nextFollowUp}T00:00:00Z`) : undefined,
          },
          select: { id: true, name: true, stage: true },
        });
        ids.push(created.id);
        await this.audit.record(tx, {
          action: "create",
          entity: "lead",
          entityId: created.id,
          after: { name: created.name, stage: created.stage, via: fileName },
        });
      }
      const done = report.done(ids.length);
      const record = await tx.import.create({
        data: { agencyId, kind: "leads", fileName, rowCount: rows.length, createdIds: ids, createdBy: userId, report: json(done) },
      });
      await this.audit.record(tx, { action: "import", entity: "import", entityId: record.id, after: { kind: "leads", fileName, rows: rows.length } });
      return { id: record.id, created: ids.length, report: done };
    });
  }

  // ─── Videos in progress ─────────────────────────────────────────────

  /**
   * Videos already in progress, from the agency's tracking sheet (P2-16): each at the stage it has reached, with its
   * own code when it has one. Work done before the app is taken as done — a video past editing has its edit steps
   * ticked, one past the quality check has it passed — so it is not held back by checks that happened elsewhere.
   * Nobody is notified about imported videos.
   */
  async importVideos(input: VideoImport) {
    const { fileName, rows } = input;
    const agencyId = this.tenant.agencyId;
    const userId = this.tenant.userId;
    if (!userId) throw new UnauthorizedException("Sign in to import.");
    if (!this.canEdit("videos")) throw new ForbiddenException("Importing videos needs a role that sees and changes every video.");

    const given = rows.map((r) => r.code).filter((c): c is string => !!c);
    const [clients, members, settings, taken] = await Promise.all([
      this.tenant.db.client.findMany({ select: { id: true, code: true, name: true, archivedAt: true } }),
      this.tenant.db.user.findMany({ where: { memberships: { some: { agencyId } } }, select: { id: true, email: true } }),
      this.productionSettings.get(),
      given.length ? this.tenant.db.video.findMany({ where: { code: { in: given } }, select: { code: true } }) : [],
    ]);
    const clientByCode = new Map(clients.map((c) => [c.code, c]));
    const byEmail = new Map(members.map((m) => [m.email.toLowerCase(), m.id]));
    const formats = new Map(settings.formats.map((f) => [f.name.toLowerCase(), f.name]));
    const usedCodes = new Set(taken.map((t) => t.code));
    const seenCodes = new Map<string, number>();
    const issues: Issue[] = [];

    rows.forEach((r, i) => {
      const client = clientByCode.get(r.clientCode);
      if (!client) issues.push({ path: `rows.${i}.clientCode`, message: `No client with the code ${r.clientCode}` });
      else if (client.archivedAt) issues.push({ path: `rows.${i}.clientCode`, message: `${client.name} is archived` });
      if (!formats.has(r.format.toLowerCase()))
        issues.push({ path: `rows.${i}.format`, message: `Not one of your formats (${settings.formats.map((f) => f.name).join(", ")})` });
      if (r.editorEmail && !byEmail.has(r.editorEmail)) issues.push({ path: `rows.${i}.editorEmail`, message: "No one in your team has this email" });
      if (r.code) {
        if (usedCodes.has(r.code)) issues.push({ path: `rows.${i}.code`, message: `${r.code} is already one of your videos` });
        const first = seenCodes.get(r.code);
        if (first !== undefined) issues.push({ path: `rows.${i}.code`, message: `Same code as row ${first + 1}` });
        else seenCodes.set(r.code, i);
      }
    });
    refuse(issues);
    const report = new CheckReport(input)
      .total("Videos", rows.length)
      .groups(
        rows,
        (r) => r.stage,
        (k) => VIDEO_STAGE_LABEL[k as keyof typeof VIDEO_STAGE_LABEL],
        [...VIDEO_STAGE_KEYS],
      )
      .total("Clients", new Set(rows.map((r) => r.clientCode)).size)
      .total("With an editor", rows.filter((r) => r.editorEmail).length);
    const on = today();
    rows.forEach((r, i) => {
      if (r.dueDate < on && !DONE_STAGES.includes(r.stage as never)) report.note(i, `${r.title}: due on ${dateText(r.dueDate)}, which has passed`);
    });

    const past = (stage: string, gate: string) => VIDEO_STAGE_KEYS.indexOf(stage as never) > VIDEO_STAGE_KEYS.indexOf(gate as never);
    return this.tenant.tx(
      async (tx) => {
        const ids: string[] = [];
        const at = new Date().toISOString();
        for (const r of rows) {
          const format = formats.get(r.format.toLowerCase())!;
          const id = await this.videos.insert(
            tx,
            {
              clientId: clientByCode.get(r.clientCode)!.id,
              title: r.title,
              format,
              aspect: /long|youtube|podcast|interview|webinar/i.test(format) ? "16:9" : "9:16",
              urgency: r.urgency,
              dueDate: r.dueDate,
              publishDate: r.publishDate,
              editorId: r.editorEmail ? byEmail.get(r.editorEmail) : undefined,
              platforms: [],
              notes: r.notes,
            },
            { stage: r.stage, imported: { fileName, code: r.code, clipNo: r.clipNo, footageProtected: r.footageProtected } },
          );
          const done: Record<string, unknown> = {};
          if (past(r.stage, "editing")) done.editSteps = Object.fromEntries(settings.editSteps.map((s) => [s, { by: userId, at }]));
          if (past(r.stage, "internal_qc"))
            done.qc = Object.fromEntries(settings.qcChecks.map((c) => [c.key, { result: "pass", note: "Done before the import", by: userId, at }]));
          if (Object.keys(done).length) await tx.video.update({ where: { id }, data: done });
          ids.push(id);
        }
        const done = report.done(ids.length);
        const record = await tx.import.create({
          data: { agencyId, kind: "videos", fileName, rowCount: rows.length, createdIds: ids, createdBy: userId, report: json(done) },
        });
        await this.audit.record(tx, { action: "import", entity: "import", entityId: record.id, after: { kind: "videos", fileName, rows: rows.length } });
        return { id: record.id, created: ids.length, report: done };
      },
      { timeout: 300_000 },
    );
  }

  // ─── Agreements ─────────────────────────────────────────────────────

  /**
   * Agreements the agency already has (P3-12), from its own sheet: running, paused or ended ones count as signed off
   * by the person importing (so it needs a role that signs off agreements); drafts wait for sign-off as usual. The
   * check report gives the totals to compare with the sheet and points out agreements past their end, due for renewal,
   * starting later, overlapping another for the same client, or priced unlike their package.
   */
  async importAgreements(input: AgreementImport) {
    const { fileName, rows } = input;
    const agencyId = this.tenant.agencyId;
    const userId = this.tenant.userId;
    if (!userId) throw new UnauthorizedException("Sign in to import.");
    const canSign = allows(this.tenant.permissions, "agreements", "approve");

    const [clients, packages, existing, notice] = await Promise.all([
      this.tenant.db.client.findMany({ select: { id: true, code: true, name: true, archivedAt: true } }),
      this.tenant.db.package.findMany({ select: { id: true, name: true, monthlyFee: true } }),
      this.tenant.db.agreement.findMany({ select: { clientId: true, title: true, startDate: true, endDate: true, status: true } }),
      this.agreements.notice(),
    ]);
    const clientByCode = new Map(clients.map((c) => [c.code, c]));
    const packageById = new Map(packages.map((p) => [p.id, p]));
    const taken = new Set(existing.map((a) => `${a.clientId}:${day(a.startDate)}`));
    const seen = new Map<string, number>();
    const report = new CheckReport(input);
    const issues: Issue[] = [];

    rows.forEach((r, i) => {
      const client = clientByCode.get(r.clientCode);
      if (!client) issues.push({ path: `rows.${i}.clientCode`, message: `No client with the code ${r.clientCode}` });
      else if (client.archivedAt) issues.push({ path: `rows.${i}.clientCode`, message: `${client.name} is archived` });
      if (r.packageId && !packageById.has(r.packageId)) issues.push({ path: `rows.${i}.packageId`, message: "Not one of your packages" });
      if (r.status !== "draft" && !canSign) issues.push({ path: `rows.${i}.status`, message: "Your role cannot sign off agreements — import it as a draft" });
      if (client) {
        const key = `${client.id}:${r.startDate}`;
        if (taken.has(key)) issues.push({ path: `rows.${i}.startDate`, message: `${client.name} already has an agreement starting on this day` });
        const first = seen.get(key);
        if (first !== undefined) issues.push({ path: `rows.${i}.startDate`, message: `Same client and start date as row ${report.line(first)}` });
        else seen.set(key, i);
      }
    });
    refuse(issues);

    const on = today();
    const live = (status: string) => ["active", "renewal_due", "paused"].includes(status);
    const running = rows.filter((r) => r.status === "active");
    const quota = running.reduce(
      (t, r) => {
        const p = packageTotals(r.deliverables);
        return { videos: t.videos + p.videosPerMonth, posts: t.posts + p.postsPerMonth };
      },
      { videos: 0, posts: 0 },
    );
    report
      .total("Agreements", rows.length)
      .groups(
        rows,
        (r) => r.status,
        (k) => AGREEMENT_IMPORT_STATUS_LABEL[k as keyof typeof AGREEMENT_IMPORT_STATUS_LABEL],
        [...AGREEMENT_IMPORT_STATUSES],
      )
      .total("Clients", new Set(rows.map((r) => r.clientCode)).size)
      .money(
        "Monthly fees, all rows",
        rows.reduce((n, r) => n + r.monthlyFee, 0),
      )
      .money(
        "Monthly fees, running",
        running.reduce((n, r) => n + r.monthlyFee, 0),
      )
      .total("Videos a month, running", quota.videos)
      .total("Posts and stories a month, running", quota.posts);

    // Ended early: an agreement marked ended stops today rather than on a later end date.
    const endOf = (r: (typeof rows)[number]) => (r.status === "ended" && r.endDate > on ? (r.startDate > on ? r.startDate : on) : r.endDate);
    rows.forEach((r, i) => {
      const client = clientByCode.get(r.clientCode)!;
      const pkg = r.packageId ? packageById.get(r.packageId) : undefined;
      if (live(r.status)) {
        const label = AGREEMENT_IMPORT_STATUS_LABEL[r.status].toLowerCase();
        if (r.endDate < on) report.note(i, `${r.title}: its end date (${dateText(r.endDate)}) has passed but it is marked ${label} — end it or renew it`);
        else if (daysUntil(r.endDate, on) <= notice) report.note(i, `${r.title}: ends on ${dateText(r.endDate)}, so it is due for renewal`);
        if (r.startDate > on) report.note(i, `${r.title}: starts on ${dateText(r.startDate)}, so it shows as upcoming`);
        const others = [
          ...existing.filter((a) => a.clientId === client.id && live(a.status)).map((a) => ({ title: a.title, start: day(a.startDate), end: day(a.endDate) })),
          ...rows
            .slice(0, i)
            .filter((o) => o.clientCode === r.clientCode && live(o.status))
            .map((o) => ({ title: o.title, start: o.startDate, end: o.endDate })),
        ];
        for (const o of others.filter((o) => o.start <= r.endDate && r.startDate <= o.end))
          report.note(i, `${r.title}: runs at the same time as ${o.title} for ${client.name}`);
      }
      if (endOf(r) !== r.endDate) report.note(i, `${r.title}: marked ended, so it ends on ${dateText(endOf(r))} instead of ${dateText(r.endDate)}`);
      if (pkg && pkg.monthlyFee !== r.monthlyFee)
        report.note(i, `${r.title}: the fee ${money(r.monthlyFee)} is not the ${pkg.name} package's ${money(pkg.monthlyFee)}`);
    });

    return this.tenant.tx(
      async (tx) => {
        const ids: string[] = [];
        const signedAt = new Date();
        for (const r of rows) {
          const a = await tx.agreement.create({
            data: {
              agencyId,
              clientId: clientByCode.get(r.clientCode)!.id,
              packageId: r.packageId ?? null,
              title: r.title,
              status: r.status,
              startDate: utc(r.startDate),
              endDate: utc(endOf(r)),
              monthlyFee: r.monthlyFee,
              billing: r.billing,
              revisionsPerDeliverable: r.revisionsPerDeliverable,
              shootDays: r.shootDays,
              platforms: r.platforms,
              deliverables: r.deliverables as Prisma.InputJsonValue,
              notes: r.notes ?? null,
              createdBy: userId,
              ...(r.status !== "draft" && { signedBy: userId, signedAt }),
            },
            select: { id: true },
          });
          ids.push(a.id);
          await this.audit.record(tx, {
            action: "create",
            entity: "agreement",
            entityId: a.id,
            after: { title: r.title, status: r.status, startDate: r.startDate, endDate: endOf(r), monthlyFee: r.monthlyFee, via: fileName },
          });
        }
        const drafts = rows.filter((r) => r.status === "draft").length;
        if (drafts)
          await this.notifications.notify(
            tx,
            { can: { area: "agreements", level: "approve" } },
            {
              kind: "agreement_signoff",
              title: drafts === 1 ? "1 imported agreement to sign off" : `${drafts} imported agreements to sign off`,
              link: "/app/agreements?view=drafts",
            },
          );
        const done = report.done(ids.length);
        const record = await tx.import.create({
          data: { agencyId, kind: "agreements", fileName, rowCount: rows.length, createdIds: ids, createdBy: userId, report: json(done) },
        });
        await this.audit.record(tx, { action: "import", entity: "import", entityId: record.id, after: { kind: "agreements", fileName, rows: rows.length } });
        return { id: record.id, created: ids.length, report: done };
      },
      { timeout: 120_000 },
    );
  }

  // ─── Attendance ─────────────────────────────────────────────────────

  /**
   * People's days from the agency's attendance export (P5-07): each row is matched to someone in the team by employee
   * code, email or name, and its status worked out by the agency's rules. A day already corrected by HR or taken as
   * leave keeps that; anything else is replaced by the export.
   */
  async importAttendance(input: AttendanceImport) {
    const { fileName, rows } = input;
    const agencyId = this.tenant.agencyId;
    const userId = this.tenant.userId;
    if (!userId) throw new UnauthorizedException("Sign in to import.");
    const [members, profiles, settings] = await Promise.all([
      this.tenant.db.membership.findMany({ where: { agencyId }, select: { user: { select: { id: true, name: true, email: true } } } }),
      this.tenant.db.employeeProfile.findMany({ where: { employeeCode: { not: null } }, select: { userId: true, employeeCode: true } }),
      this.attendance.settings(),
    ]);
    const byCode = new Map(profiles.map((p) => [p.employeeCode!.toLowerCase(), p.userId]));
    const byEmail = new Map(members.map((m) => [m.user.email.toLowerCase(), m.user.id]));
    const byName = new Map<string, string | null>();
    for (const m of members) {
      const k = m.user.name.trim().toLowerCase();
      byName.set(k, byName.has(k) ? null : m.user.id); // two people with one name cannot be told apart
    }
    const issues: Issue[] = [];
    const who: string[] = [];
    const seen = new Map<string, number>();
    rows.forEach((r, i) => {
      const k = r.employee.trim().toLowerCase();
      const id = byCode.get(k) ?? byEmail.get(k) ?? byName.get(k) ?? null;
      if (!id)
        issues.push({
          path: `rows.${i}.employee`,
          message: byName.get(k) === null ? "Two people have this name — use their employee code" : "No one in your team has this code, email or name",
        });
      who.push(id ?? "");
      const key = `${id}:${r.date}`;
      const first = seen.get(key);
      if (id && first !== undefined) issues.push({ path: `rows.${i}.date`, message: `Same person and day as row ${first + 2}` });
      else seen.set(key, i);
    });
    refuse(issues);

    const report = new CheckReport(input).groupedInto("days");
    const kept = await this.tenant.db.attendanceRecord.findMany({
      where: {
        userId: { in: [...new Set(who)] },
        date: { in: [...new Set(rows.map((r) => new Date(`${r.date}T00:00:00Z`)))] },
        source: { in: ["correction", "leave"] },
      },
      select: { userId: true, date: true, source: true },
    });
    const keep = new Set(kept.map((k) => `${k.userId}:${k.date.toISOString().slice(0, 10)}`));
    const statuses: string[] = [];
    return this.tenant.tx(
      async (tx) => {
        const ids: string[] = [];
        const record = await tx.import.create({ data: { agencyId, kind: "attendance", fileName, rowCount: rows.length, createdIds: [], createdBy: userId } });
        for (const [i, r] of rows.entries()) {
          if (keep.has(`${who[i]}:${r.date}`)) {
            report.note(i, `${r.employee} on ${dateText(r.date)}: kept as HR corrected it or as leave`);
            continue;
          }
          const { status, minutes } = dayStatus(settings, r.firstIn ?? null, r.lastOut ?? null);
          statuses.push(status);
          const off = offDay(settings, r.date);
          if (off && r.firstIn)
            report.note(i, `${r.employee} came in on ${dateText(r.date)}, a ${off.status === "holiday" ? `holiday (${off.name})` : "weekly off"}`);
          const data = { firstIn: r.firstIn ?? null, lastOut: r.lastOut ?? null, minutes, status, source: "import", importId: record.id, note: null };
          const saved = await tx.attendanceRecord.upsert({
            where: { agencyId_userId_date: { agencyId, userId: who[i]!, date: new Date(`${r.date}T00:00:00Z`) } },
            create: { agencyId, userId: who[i]!, date: new Date(`${r.date}T00:00:00Z`), ...data },
            update: data,
          });
          ids.push(saved.id);
        }
        const dates = rows.map((r) => r.date).sort();
        report
          .total("Days", rows.length)
          .total("People", new Set(who).size)
          .total("From", dateText(dates[0]!))
          .total("To", dateText(dates.at(-1)!))
          .groups(
            statuses,
            (s) => s,
            (s) => ATTENDANCE_STATUS_LABEL[s as keyof typeof ATTENDANCE_STATUS_LABEL] ?? s,
            ["present", "late", "half_day", "absent"],
          );
        const done = report.done(ids.length);
        await tx.import.update({ where: { id: record.id }, data: { createdIds: ids, report: json(done) } });
        await this.audit.record(tx, { action: "import", entity: "import", entityId: record.id, after: { kind: "attendance", fileName, rows: rows.length } });
        return { id: record.id, created: ids.length, report: done };
      },
      { timeout: 120_000 },
    );
  }

  // ─── Undo ───────────────────────────────────────────────────────────

  async undo(id: string) {
    const record = await this.tenant.db.import.findFirst({ where: { id } });
    if (!record) throw new NotFoundException("No import with that id.");
    const kind = record.kind as ImportKind;
    if (!this.canEdit(kind)) throw new ForbiddenException(`Your role cannot change ${kind === "team" ? "the team" : kind}.`);
    if (record.undoneAt) throw new ConflictException("This import has already been undone.");
    if (Date.now() - record.createdAt.getTime() >= UNDO_HOURS * 3_600_000) throw new ConflictException("Imports can be undone for 24 hours only.");
    const ids = record.createdIds;

    if (kind === "leads") {
      const [changed, activities] = await Promise.all([
        this.tenant.db.auditLog.count({ where: { entity: "lead", entityId: { in: ids }, NOT: { action: "create" } } }),
        this.tenant.db.activity.count({ where: { leadId: { in: ids } } }),
      ]);
      if (changed || activities) throw new ConflictException("Some of these leads have been worked on since the import, so undoing it would lose that work.");
    }
    if (kind === "videos") {
      const [changed, versions, logs, posts, requests, inShoots] = await Promise.all([
        this.tenant.db.auditLog.count({ where: { entity: "video", entityId: { in: ids }, NOT: { action: "create" } } }),
        this.tenant.db.videoVersion.count({ where: { videoId: { in: ids } } }),
        this.tenant.db.videoTimeLog.count({ where: { videoId: { in: ids } } }),
        this.tenant.db.scheduledPost.count({ where: { videoId: { in: ids } } }),
        this.tenant.db.changeRequest.count({ where: { videoId: { in: ids } } }),
        this.tenant.db.video.count({ where: { id: { in: ids }, shootId: { not: null } } }),
      ]);
      if (changed || versions || logs || posts || requests || inShoots)
        throw new ConflictException("Some of these videos have been worked on since the import, so undoing it would lose that work.");
    }
    if (kind === "attendance") {
      // Days HR corrected since stay; the rest of what the import brought in goes.
    }
    if (kind === "agreements") {
      const [changed, invoices, videos, renewals] = await Promise.all([
        this.tenant.db.auditLog.count({ where: { entity: "agreement", entityId: { in: ids }, NOT: { action: "create" } } }),
        this.tenant.db.invoice.count({ where: { agreementId: { in: ids } } }),
        this.tenant.db.video.count({ where: { agreementId: { in: ids } } }),
        this.tenant.db.agreement.count({ where: { renewsId: { in: ids } } }),
      ]);
      if (changed || invoices || videos || renewals)
        throw new ConflictException(
          "Some of these agreements have been worked on since the import (signed off, invoiced, renewed or used for videos), so undoing it would lose that work.",
        );
    }
    if (kind === "clients") {
      // Undo only what nobody has touched since: no later change to these clients, nothing made from them.
      const [changed, agreements] = await Promise.all([
        this.tenant.db.auditLog.count({ where: { entity: "client", entityId: { in: ids }, NOT: { action: "create" } } }),
        this.tenant.db.agreement.count({ where: { clientId: { in: ids } } }),
      ]);
      if (changed || agreements) {
        throw new ConflictException("Some of these clients have been changed or used since the import, so undoing it would lose that work.");
      }
    }

    return this.tenant.tx(async (tx) => {
      let removed = 0;
      if (kind === "clients") {
        const clients = await tx.client.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true } });
        for (const c of clients) {
          await tx.client.delete({ where: { id: c.id } });
          await this.audit.record(tx, { action: "delete", entity: "client", entityId: c.id, before: { code: c.code, name: c.name, via: "undo import" } });
        }
        removed = clients.length;
      } else if (kind === "videos") {
        const videos = await tx.video.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, title: true } });
        for (const v of videos) {
          await tx.video.delete({ where: { id: v.id } });
          await this.audit.record(tx, { action: "delete", entity: "video", entityId: v.id, before: { code: v.code, title: v.title, via: "undo import" } });
        }
        removed = videos.length;
      } else if (kind === "attendance") {
        removed = (await tx.attendanceRecord.deleteMany({ where: { importId: id, source: "import" } })).count;
      } else if (kind === "agreements") {
        const agreements = await tx.agreement.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, status: true } });
        for (const a of agreements) {
          await tx.agreement.delete({ where: { id: a.id } });
          await this.audit.record(tx, {
            action: "delete",
            entity: "agreement",
            entityId: a.id,
            before: { title: a.title, status: a.status, via: "undo import" },
          });
        }
        removed = agreements.length;
      } else if (kind === "leads") {
        const leads = await tx.lead.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
        for (const l of leads) {
          await tx.lead.delete({ where: { id: l.id } });
          await this.audit.record(tx, { action: "delete", entity: "lead", entityId: l.id, before: { name: l.name, via: "undo import" } });
        }
        removed = leads.length;
      } else {
        // People who already joined stay; invitations still waiting are cancelled.
        removed = (await tx.invitation.updateMany({ where: { id: { in: ids }, status: "pending" }, data: { status: "canceled" } })).count;
      }
      await tx.import.update({ where: { id }, data: { undoneAt: new Date(), undoneBy: this.tenant.userId } });
      await this.audit.record(tx, { action: "undo", entity: "import", entityId: id, after: { kind, fileName: record.fileName, removed } });
      return { id, removed, kept: ids.length - removed };
    });
  }
}
