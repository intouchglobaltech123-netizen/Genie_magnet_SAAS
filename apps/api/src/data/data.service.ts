import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Readable } from "node:stream";
import { asPlatform } from "@gm/db";
import { DELETION_GRACE_DAYS, type DataExportRow, type ExportStatus, OWNER_ROLE, type WorkspaceDeletion } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { FileStore } from "../files/file-store.js";
import { JobsService } from "../jobs/jobs.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { csv, zip } from "./archive.js";

const DAY = 86_400_000;
const istDay = (at: Date) => new Date(at.getTime() + 330 * 60_000).toISOString().slice(0, 10);
const longDay = (at: Date) => at.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
/** Not the agency's records: people's personal planners (theirs alone) and the background work queue. */
const LEFT_OUT_TABLES = new Set(["personal_planners", "jobs"]);
/** Never in an export: sign-in tokens, keys and secrets, a pending sign-in, and bank account and PAN numbers. */
const LEFT_OUT_COLUMNS = new Set([
  "access_token",
  "refresh_token",
  "id_token",
  "token_secret",
  "key_secret",
  "webhook_secret",
  "app_secret",
  "verify_token",
  "password",
  "pending",
  "bank_account",
  "pan",
  "storage_key",
]);

const README = `This is a full export of your agency's data.

Each file in csv/ is one table, with a row for each record; data.json has the same, all in one file.
Dates and times are in UTC. Amounts are in rupees unless a column says otherwise.

Left out on purpose:
- passwords, sign-in tokens, keys and secrets (connect your accounts again wherever you go);
- bank account and PAN numbers (they are kept encrypted; the last digits are in the *_hint columns);
- each person's own financial planner, which is theirs alone;
- the files you uploaded (videos, receipts, documents): files.csv lists them; download them from the app.
`;

const json = (v: unknown) => JSON.stringify(v, (_k, x: unknown) => (typeof x === "bigint" ? x.toString() : x), 2);

/**
 * The agency's own data (P6-10): a full export for the owner — CSV per table and a JSON archive in a ZIP, built in
 * the background — and deleting the workspace after a grace period in which the owner can stop it. A deletion that
 * is due is carried out by `app_purge_agency` (migration 20261130000000_data), and the agency's stored files go too.
 */
@Injectable()
export class DataService {
  private readonly log = new Logger("Data");

  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
    private readonly store: FileStore,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  private owner() {
    if (this.tenant.role !== OWNER_ROLE) throw new ForbiddenException("Only the agency's owner can do this.");
  }

  private async names(ids: string[]) {
    const users = ids.length ? await this.tenant.db.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true } }) : [];
    return (id: string) => ({ id, name: users.find((u) => u.id === id)?.name ?? null });
  }

  // ─── Exports ────────────────────────────────────────────────────────

  async exports(): Promise<DataExportRow[]> {
    this.owner();
    const rows = await this.tenant.db.dataExport.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    const name = await this.names(rows.map((r) => r.requestedBy));
    return rows.map((r) => ({
      id: r.id,
      status: r.status as ExportStatus,
      requestedBy: name(r.requestedBy),
      createdAt: r.createdAt.toISOString(),
      readyAt: r.readyAt?.toISOString() ?? null,
      size: r.size === null ? null : Number(r.size),
      tables: r.tables,
      rows: r.rows,
      error: r.error,
    }));
  }

  async requestExport() {
    this.owner();
    if (await this.tenant.db.dataExport.count({ where: { status: "queued" } })) throw new ConflictException("An export is already being made.");
    await this.tenant.tx(async (tx) => {
      const row = await tx.dataExport.create({ data: { agencyId: this.tenant.agencyId, requestedBy: this.tenant.userId ?? "" } });
      await this.jobs.enqueue(tx, "data.export", { exportId: row.id }, { key: `data.export:${row.id}` });
      await this.audit.record(tx, { action: "create", entity: "data_export", entityId: row.id });
    });
    return this.exports();
  }

  /** Builds the export (background job): every table the agency has, read through its own row-level security. */
  async build(exportId: string) {
    const agencyId = this.tenant.agencyId;
    const row = await this.tenant.db.dataExport.findFirst({ where: { id: exportId } });
    if (!row || row.status !== "queued") return { skipped: true };
    try {
      const tables = (
        await this.tenant.db.$queryRaw<{ name: string }[]>`
          SELECT c.table_name::text AS name
          FROM information_schema.columns c
          JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
          WHERE c.table_schema = 'public' AND c.column_name = 'agency_id' AND tb.table_type = 'BASE TABLE'
          ORDER BY c.table_name`
      )
        .map((t) => t.name)
        .filter((t) => !LEFT_OUT_TABLES.has(t));
      const all: Record<string, Record<string, unknown>[]> = {};
      const files: { name: string; data: string }[] = [{ name: "README.txt", data: README }];
      let rows = 0;
      for (const table of tables) {
        // The table names come from the database itself; each read is limited to this agency by row-level security.
        const found = await this.tenant.tx((tx) => tx.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM "${table.replace(/"/g, "")}"`));
        const kept = found.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !LEFT_OUT_COLUMNS.has(k))));
        all[table] = kept;
        rows += kept.length;
        // The byte-order mark makes Excel read the file as UTF-8 (₹, names in Tamil or Hindi), as other programs do anyway.
        files.push({ name: `csv/${table}.csv`, data: `\uFEFF${csv(kept)}` });
      }
      files.push({ name: "data.json", data: json(all) });
      const archive = zip(files);
      const key = `${agencyId}/exports/${exportId}.zip`;
      await this.store.put(key, Readable.from(archive), archive.length);
      await this.tenant.tx(async (tx) => {
        await tx.dataExport.update({
          where: { id: exportId },
          data: { status: "ready", storageKey: key, size: BigInt(archive.length), tables: tables.length, rows, readyAt: new Date() },
        });
        await this.notifications.notify(
          tx,
          { users: [row.requestedBy] },
          {
            kind: "data_export",
            title: "Your agency's export is ready",
            body: `${tables.length} tables, ${rows.toLocaleString("en-IN")} records`,
            link: "/app/settings/data",
          },
        );
      });
      return { tables: tables.length, rows };
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      this.log.error(`Export ${exportId} failed: ${message}`, { agencyId });
      await this.tenant.db.dataExport.update({ where: { id: exportId }, data: { status: "failed", error: message } });
      return { failed: message };
    }
  }

  async open(id: string) {
    this.owner();
    const row = await this.tenant.db.dataExport.findFirst({ where: { id } });
    if (!row?.storageKey || row.status !== "ready") throw new NotFoundException("No export ready with that id.");
    const agency = await this.tenant.db.agency.findUnique({ where: { id: this.tenant.agencyId }, select: { slug: true } });
    return { ...(await this.store.open(row.storageKey)), fileName: `${agency?.slug ?? "agency"}-export-${istDay(row.createdAt)}.zip` };
  }

  // ─── Deleting the workspace ─────────────────────────────────────────

  async deletion(): Promise<WorkspaceDeletion | null> {
    const d = await this.tenant.db.workspaceDeletion.findFirst({ where: { cancelledAt: null } });
    if (!d) return null;
    const name = await this.names([d.requestedBy]);
    return { requestedAt: d.requestedAt.toISOString(), deleteAfter: d.deleteAfter.toISOString(), requestedBy: name(d.requestedBy) };
  }

  /** The owner asks, typing the agency's name; the workspace is deleted after the grace period unless stopped. */
  async requestDeletion(confirm: string) {
    this.owner();
    const agencyId = this.tenant.agencyId;
    const agency = await this.tenant.db.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
    if (!agency || confirm.trim().toLowerCase() !== agency.name.trim().toLowerCase())
      throw new BadRequestException({
        message: "Type the agency's name exactly to confirm.",
        issues: [{ path: "confirm", message: "Type the agency's name" }],
      });
    const deleteAfter = new Date(Date.now() + DELETION_GRACE_DAYS * DAY);
    await this.tenant.tx(async (tx) => {
      const data = { requestedBy: this.tenant.userId ?? "", requestedAt: new Date(), deleteAfter, cancelledAt: null, cancelledBy: null };
      await tx.workspaceDeletion.upsert({ where: { agencyId }, create: { agencyId, ...data }, update: data });
      await this.audit.record(tx, { action: "create", entity: "workspace_deletion", entityId: agencyId, after: { deleteAfter: deleteAfter.toISOString() } });
      await this.notifications.notify(
        tx,
        { can: { area: "settings", level: "view" } },
        {
          kind: "workspace_deletion",
          title: `${agency.name} will be deleted on ${longDay(deleteAfter)}`,
          body: "The owner asked for the workspace to be deleted. Export anything you need before then.",
          link: "/app/settings/data",
        },
      );
    });
    return this.deletion();
  }

  async cancelDeletion() {
    this.owner();
    const agencyId = this.tenant.agencyId;
    const d = await this.tenant.db.workspaceDeletion.findFirst({ where: { cancelledAt: null } });
    if (!d) throw new ConflictException("The workspace is not due to be deleted.");
    const agency = await this.tenant.db.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
    await this.tenant.tx(async (tx) => {
      await tx.workspaceDeletion.update({ where: { agencyId }, data: { cancelledAt: new Date(), cancelledBy: this.tenant.userId ?? null } });
      await this.audit.record(tx, { action: "update", entity: "workspace_deletion", entityId: agencyId, after: { cancelled: true } });
      await this.notifications.notify(
        tx,
        { can: { area: "settings", level: "view" } },
        {
          kind: "workspace_deletion",
          title: `${agency?.name ?? "The workspace"} will not be deleted`,
          body: "The owner stopped the deletion.",
          link: "/app/settings/data",
        },
      );
    });
    return null;
  }

  /** Deletes the workspaces that are due (run by the job runner every hour): everything they own, and their files. */
  async purgeDue() {
    const due = await asPlatform(this.prisma.client, (tx) =>
      tx.workspaceDeletion.findMany({ where: { cancelledAt: null, deleteAfter: { lte: new Date() } }, select: { agencyId: true } }),
    );
    for (const { agencyId } of due) {
      try {
        await this.prisma.client.$queryRaw`SELECT app_purge_agency(${agencyId}::uuid)`;
        await this.store.removeFolder(agencyId);
        this.log.log(`Deleted the workspace of agency ${agencyId}`);
      } catch (e) {
        this.log.error(`Could not delete the workspace of agency ${agencyId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return due.length;
  }
}
