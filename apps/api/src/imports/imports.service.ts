import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import {
  allows,
  type ClientImport,
  exceeds,
  FITMENT_QUADRANTS,
  type ImportKind,
  type LeadImport,
  OWNER_ROLE,
  permissionArea,
  scopeOf,
  type TeamImport,
  VIDEO_STAGE_KEYS,
  type VideoImport,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { Outbox } from "../auth/outbox.js";
import { PipelineService } from "../crm/pipeline.service.js";
import { ProductionSettingsService } from "../production/production-settings.service.js";
import { VideosService } from "../production/videos.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { matrixOf } from "../team/roles.service.js";
import { TeamService } from "../team/team.service.js";

const UNDO_HOURS = 24;
const INVITATION_DAYS = 7;
type Issue = { path: string; message: string };

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
 * checked again here and saved in one transaction, or none are. Each import is in the history and can be undone
 * within 24 hours if nothing it created has changed since.
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
  ) {}

  private canEdit(kind: ImportKind) {
    const area = ({ clients: "clients", leads: "crm", team: "team", videos: "production" } as const)[kind];
    return allows(this.tenant.permissions, area, "edit") && (kind !== "videos" || scopeOf(this.tenant.permissions, "production") === "all");
  }

  async list() {
    const kinds = (["clients", "team", "leads", "videos"] as const).filter((k) => this.canEdit(k));
    const rows = await this.tenant.db.import.findMany({ where: { kind: { in: kinds } }, orderBy: { createdAt: "desc" }, take: 50 });
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
    }));
  }

  // ─── Clients ────────────────────────────────────────────────────────

  async importClients({ fileName, rows }: ClientImport) {
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
      const record = await tx.import.create({ data: { agencyId, kind: "clients", fileName, rowCount: rows.length, createdIds: ids, createdBy: userId } });
      await this.audit.record(tx, { action: "import", entity: "import", entityId: record.id, after: { kind: "clients", fileName, rows: rows.length } });
      return { id: record.id, created: ids.length };
    });
  }

  // ─── Team ───────────────────────────────────────────────────────────

  async importTeam({ fileName, rows }: TeamImport) {
    const agencyId = this.tenant.agencyId;
    const userId = this.tenant.userId;
    if (!userId) throw new UnauthorizedException("Sign in to import.");
    const isOwner = this.tenant.role === OWNER_ROLE;

    const [roles, members] = await Promise.all([
      this.tenant.db.role.findMany({ select: { key: true, permissions: true } }),
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
      const record = await tx.import.create({ data: { agencyId, kind: "team", fileName, rowCount: rows.length, createdIds: ids, createdBy: userId } });
      await this.audit.record(tx, { action: "import", entity: "import", entityId: record.id, after: { kind: "team", fileName, rows: rows.length } });
      return { id: record.id, created: ids.length, ids };
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
    return { id: result.id, created: result.created };
  }

  // ─── Leads ──────────────────────────────────────────────────────────

  async importLeads({ fileName, rows }: LeadImport) {
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
      const record = await tx.import.create({ data: { agencyId, kind: "leads", fileName, rowCount: rows.length, createdIds: ids, createdBy: userId } });
      await this.audit.record(tx, { action: "import", entity: "import", entityId: record.id, after: { kind: "leads", fileName, rows: rows.length } });
      return { id: record.id, created: ids.length };
    });
  }

  // ─── Videos in progress ─────────────────────────────────────────────

  /**
   * Videos already in progress, from the agency's tracking sheet (P2-16): each at the stage it has reached, with its
   * own code when it has one. Work done before the app is taken as done — a video past editing has its edit steps
   * ticked, one past the quality check has it passed — so it is not held back by checks that happened elsewhere.
   * Nobody is notified about imported videos.
   */
  async importVideos({ fileName, rows }: VideoImport) {
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
        const record = await tx.import.create({ data: { agencyId, kind: "videos", fileName, rowCount: rows.length, createdIds: ids, createdBy: userId } });
        await this.audit.record(tx, { action: "import", entity: "import", entityId: record.id, after: { kind: "videos", fileName, rows: rows.length } });
        return { id: record.id, created: ids.length };
      },
      { timeout: 300_000 },
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
