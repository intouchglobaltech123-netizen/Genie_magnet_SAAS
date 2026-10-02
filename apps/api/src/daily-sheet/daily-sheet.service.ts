import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TenantTx } from "@gm/db";
import {
  allows,
  DEFAULT_SHEET_SETTINGS,
  DEFAULT_SHEET_TEMPLATES,
  type DailySheetRow,
  OWNER_ROLE,
  type SheetInput,
  type SheetRow,
  type SheetSettings,
  type SheetTeamRow,
  type SheetTemplate,
  type SheetTemplateInput,
  type Signer,
  sheetInput,
  sheetProblems,
  sheetSettingsInput,
  sheetTemplateInput,
  sheetTotals,
} from "@gm/shared";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { AttendanceService, offDay } from "../people/attendance.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

/** India's offset from UTC: the day and the cut-off are India's. */
const IST = 330 * 60_000;
const todayIST = () => new Date(Date.now() + IST).toISOString().slice(0, 10);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
type Signature = { signer: Signer; by: string; at: string };
type Template = Prisma.SheetTemplateGetPayload<object>;
type Sheet = Prisma.DailySheetGetPayload<object>;

/**
 * The daily data sheet (P5-12): each person fills in their day on their role's sheet and submits it by the agency's
 * cut-off; their manager and HR sign it in the sheet's order, or send it back with a note. Managers and HR see who
 * submitted, who is late, who missed it, and who is on leave or off.
 */
@Injectable()
export class DailySheetService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly attendance: AttendanceService,
  ) {}

  private hr(level: "view" | "edit" | "approve" = "view") {
    return allows(this.tenant.permissions, "hr", level);
  }

  // ─── Rules and sheets ───────────────────────────────────────────────

  async settings(): Promise<SheetSettings> {
    const s = await this.tenant.db.sheetSettings.findUnique({ where: { agencyId: this.tenant.agencyId } });
    return s ? sheetSettingsInput.parse(s.rule) : DEFAULT_SHEET_SETTINGS;
  }

  async updateSettings(input: z.input<typeof sheetSettingsInput>) {
    const rule = sheetSettingsInput.parse(input);
    await this.tenant.tx(async (tx) => {
      await tx.sheetSettings.upsert({ where: { agencyId: this.tenant.agencyId }, create: { agencyId: this.tenant.agencyId, rule }, update: { rule } });
      await this.audit.record(tx, { action: "update", entity: "sheet_settings", after: rule });
    });
    return this.settings();
  }

  /** The agency's sheets; every agency starts with the usual ones, and changes them. */
  async templates() {
    let rows = await this.tenant.db.sheetTemplate.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
    if (!rows.length) {
      await this.tenant.db.sheetTemplate.createMany({
        data: DEFAULT_SHEET_TEMPLATES.map((t, i) => ({ agencyId: this.tenant.agencyId, ...t, position: i })),
        skipDuplicates: true,
      });
      rows = await this.tenant.db.sheetTemplate.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
    }
    const profiles = await this.tenant.db.employeeProfile.findMany({ where: { sheetTemplateId: { not: null } }, select: { sheetTemplateId: true } });
    return rows.map((t) => ({ ...this.templateOf(t), people: profiles.filter((p) => p.sheetTemplateId === t.id).length }));
  }

  private templateOf(t: Template) {
    return { id: t.id, name: t.name, counters: t.counters as SheetTemplate["counters"], taskHint: t.taskHint, signers: t.signers as Signer[] };
  }

  async saveTemplate(id: string | null, input: SheetTemplateInput) {
    const t = sheetTemplateInput.parse(input);
    const clash = await this.tenant.db.sheetTemplate.findFirst({ where: { name: t.name, ...(id && { NOT: { id } }) }, select: { id: true } });
    if (clash) throw new ConflictException(`There is already a sheet called ${t.name}.`);
    const data = { name: t.name, counters: t.counters, taskHint: t.taskHint, signers: t.signers };
    const row = await this.tenant.tx(async (tx) => {
      const saved = id
        ? await tx.sheetTemplate.update({ where: { id }, data })
        : await tx.sheetTemplate.create({ data: { agencyId: this.tenant.agencyId, ...data, position: 99 } });
      await this.audit.record(tx, {
        action: id ? "update" : "create",
        entity: "sheet_template",
        entityId: saved.id,
        after: { name: t.name, signers: t.signers },
      });
      return saved;
    });
    return (await this.templates()).find((x) => x.id === row.id)!;
  }

  async removeTemplate(id: string) {
    const t = await this.tenant.db.sheetTemplate.findFirst({ where: { id } });
    if (!t) throw new NotFoundException("No sheet with that id.");
    if (await this.tenant.db.dailySheet.findFirst({ where: { templateId: id }, select: { id: true } }))
      throw new ConflictException("People have filled in this sheet — rename it instead.");
    await this.tenant.tx(async (tx) => {
      await tx.employeeProfile.updateMany({ where: { sheetTemplateId: id }, data: { sheetTemplateId: null } });
      await tx.sheetTemplate.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "sheet_template", entityId: id, before: { name: t.name } });
    });
    return { removed: true };
  }

  // ─── Who sees and signs whose ───────────────────────────────────────

  /** The person's managers: whom they report to, and the head of their department. */
  private async managersOf(userId: string) {
    const p = await this.tenant.db.employeeProfile.findFirst({ where: { userId }, select: { managerId: true, departmentId: true } });
    const dep = p?.departmentId ? await this.tenant.db.department.findFirst({ where: { id: p.departmentId }, select: { headId: true } }) : null;
    return [...new Set([p?.managerId, dep?.headId].filter((x): x is string => !!x && x !== userId))];
  }

  /** Whose days the signed-in person sees: everyone for HR, their reports for a manager. */
  private async visible(): Promise<Set<string> | "all"> {
    if (this.hr()) return "all";
    const me = this.tenant.userId ?? "";
    const [heads, profiles] = await Promise.all([
      this.tenant.db.department.findMany({ where: { headId: me }, select: { id: true } }),
      this.tenant.db.employeeProfile.findMany({ select: { userId: true, managerId: true, departmentId: true } }),
    ]);
    const headed = new Set(heads.map((h) => h.id));
    return new Set(profiles.filter((p) => p.userId !== me && (p.managerId === me || (p.departmentId && headed.has(p.departmentId)))).map((p) => p.userId));
  }

  /** May the signed-in person sign as this signer? Never their own sheet (the owner excepted). */
  private async maySign(sheet: Sheet, signer: Signer) {
    const me = this.tenant.userId ?? "";
    if (sheet.userId === me && this.tenant.role !== OWNER_ROLE) return false;
    if (signer === "hr") return this.hr("approve");
    const managers = await this.managersOf(sheet.userId);
    // With no manager set, HR (or the owner) signs for the manager so no sheet is stuck.
    return managers.length ? managers.includes(me) : this.hr("approve") || this.tenant.role === OWNER_ROLE;
  }

  // ─── A day ──────────────────────────────────────────────────────────

  async day(date: string, userId?: string): Promise<DailySheetRow> {
    const me = this.tenant.userId ?? "";
    const who = userId ?? me;
    if (who !== me) {
      const v = await this.visible();
      if (v !== "all" && !v.has(who)) throw new NotFoundException("No sheet for that person.");
    }
    const [sheet, member, settings] = await Promise.all([
      this.tenant.db.dailySheet.findFirst({ where: { userId: who, date: utc(date) } }),
      this.tenant.db.membership.findFirst({ where: { agencyId: this.tenant.agencyId, userId: who }, select: { user: { select: { id: true, name: true } } } }),
      this.settings(),
    ]);
    if (!member) throw new NotFoundException("No one in this agency with that id.");
    const template = await this.templateFor(who, sheet);
    const videos = await this.tenant.db.video.findMany({
      where: { stage: { notIn: ["planned", "published"] }, OR: [{ editorId: who }, { cameraId: who }, { directorId: who }] },
      select: { id: true, code: true, title: true },
      orderBy: { dueDate: "asc" },
      take: 60,
    });
    const rows = (sheet?.rows as SheetRow[] | undefined) ?? [];
    const signatures = (sheet?.signatures as Signature[] | undefined) ?? [];
    const names = await this.names(signatures.map((s) => s.by));
    return {
      id: sheet?.id ?? null,
      date,
      user: member.user,
      template: this.templateOf(template),
      rows,
      counters: (sheet?.counters as Record<string, number> | undefined) ?? {},
      otherWorks: sheet?.otherWorks ?? "",
      dayReason: sheet?.dayReason ?? "",
      status: (sheet?.status as DailySheetRow["status"] | undefined) ?? "draft",
      submittedAt: sheet?.submittedAt?.toISOString() ?? null,
      late: sheet?.late ?? false,
      signatures: signatures.map((s) => ({ ...s, by: names.get(s.by) ?? "" })),
      waitingFor: sheet ? this.next(sheet, template) : null,
      returnNote: sheet?.returnNote ?? null,
      totals: sheetTotals({ rows }, settings),
      videos,
    };
  }

  private async templateFor(userId: string, sheet: Sheet | null) {
    const id = sheet?.templateId ?? (await this.tenant.db.employeeProfile.findFirst({ where: { userId }, select: { sheetTemplateId: true } }))?.sheetTemplateId;
    const t = id ? await this.tenant.db.sheetTemplate.findFirst({ where: { id } }) : null;
    if (!t) throw new ConflictException("HR has not given a daily sheet for this person yet.");
    return t;
  }

  private next(sheet: Sheet, template: Template): Signer | null {
    if (sheet.status !== "submitted") return null;
    const done = (sheet.signatures as Signature[]).map((s) => s.signer);
    return (template.signers as Signer[]).find((s) => !done.includes(s)) ?? null;
  }

  /** The person saves their own day while it is a draft. */
  async save(date: string, input: SheetInput) {
    const s = sheetInput.parse(input);
    const me = this.tenant.userId;
    if (!me) throw new ForbiddenException("Sign in first.");
    if (date > todayIST()) throw new BadRequestException("Only a day that has come.");
    const existing = await this.tenant.db.dailySheet.findFirst({ where: { userId: me, date: utc(date) } });
    if (existing && existing.status !== "draft") throw new ConflictException("It is submitted — it can change only if it is sent back.");
    const template = await this.templateFor(me, existing);
    const ids = [...new Set(s.rows.map((r) => r.videoId).filter((x): x is string => !!x))];
    if (ids.length && (await this.tenant.db.video.count({ where: { id: { in: ids } } })) !== ids.length)
      throw new BadRequestException("Choose videos of your agency.");
    const data = { rows: s.rows, counters: s.counters, otherWorks: s.otherWorks, dayReason: s.dayReason };
    await this.tenant.db.dailySheet.upsert({
      where: { agencyId_userId_date: { agencyId: this.tenant.agencyId, userId: me, date: utc(date) } },
      create: { agencyId: this.tenant.agencyId, userId: me, date: utc(date), templateId: template.id, ...data },
      update: data,
    });
    return this.day(date);
  }

  /** Submitted: checked first; late after the cut-off (or for an earlier day); the first signer is told. */
  async submit(date: string) {
    const me = this.tenant.userId ?? "";
    const sheet = await this.tenant.db.dailySheet.findFirst({ where: { userId: me, date: utc(date) } });
    if (!sheet) throw new BadRequestException("Fill in the day first.");
    if (sheet.status !== "draft") throw new ConflictException("It is already submitted.");
    const settings = await this.settings();
    const problems = sheetProblems(
      sheetInput.parse({ rows: sheet.rows, counters: sheet.counters, otherWorks: sheet.otherWorks, dayReason: sheet.dayReason }),
      settings,
    );
    if (problems.length) throw new BadRequestException({ message: "Some things need filling in first.", issues: problems });
    const nowIST = new Date(Date.now() + IST).toISOString();
    const late = date < nowIST.slice(0, 10) || nowIST.slice(11, 16) > settings.cutoff;
    const template = await this.templateFor(me, sheet);
    await this.tenant.tx(async (tx) => {
      await tx.dailySheet.update({ where: { id: sheet.id }, data: { status: "submitted", submittedAt: new Date(), late, signatures: [], returnNote: null } });
      await this.audit.record(tx, { action: "update", entity: "daily_sheet", entityId: sheet.id, after: { date, submitted: true, late } });
      await this.tellSigner(tx, sheet, (template.signers as Signer[])[0]!, date);
    });
    return this.day(date);
  }

  private async tellSigner(tx: TenantTx, sheet: Sheet, signer: Signer, date: string) {
    const who = await this.tenant.db.user.findUnique({ where: { id: sheet.userId }, select: { name: true } });
    const notice = {
      kind: "sheet_to_sign" as const,
      title: `Daily sheet of ${who?.name ?? "someone"} for ${fmt(date)} to sign`,
      link: `/app/daily-sheet?date=${date}&person=${sheet.userId}`,
    };
    if (signer === "hr") await this.notifications.notify(tx, { can: { area: "hr", level: "approve" } }, notice);
    else {
      const managers = await this.managersOf(sheet.userId);
      await this.notifications.notify(tx, managers.length ? { users: managers } : { can: { area: "hr", level: "approve" } }, notice);
    }
  }

  async sign(id: string) {
    const sheet = await this.tenant.db.dailySheet.findFirst({ where: { id } });
    if (!sheet) throw new NotFoundException("No sheet with that id.");
    const template = await this.templateFor(sheet.userId, sheet);
    const signer = this.next(sheet, template);
    if (!signer) throw new ConflictException(sheet.status === "signed" ? "It is already signed." : "It is not submitted.");
    if (!(await this.maySign(sheet, signer))) throw new ForbiddenException(`The ${signer === "hr" ? "HR" : "manager's"} signature is someone else's.`);
    const signatures = [...(sheet.signatures as Signature[]), { signer, by: this.tenant.userId ?? "", at: new Date().toISOString() }];
    const then = (template.signers as Signer[]).find((s) => !signatures.some((x) => x.signer === s));
    const date = sheet.date.toISOString().slice(0, 10);
    await this.tenant.tx(async (tx) => {
      await tx.dailySheet.update({ where: { id }, data: { signatures, status: then ? "submitted" : "signed" } });
      await this.audit.record(tx, { action: "approve", entity: "daily_sheet", entityId: id, after: { date, signer } });
      if (then) await this.tellSigner(tx, sheet, then, date);
    });
    return this.day(date, sheet.userId);
  }

  /** A signer sends it back with a note; the person changes and submits it again. */
  async sendBack(id: string, note: string) {
    const sheet = await this.tenant.db.dailySheet.findFirst({ where: { id } });
    if (!sheet) throw new NotFoundException("No sheet with that id.");
    const template = await this.templateFor(sheet.userId, sheet);
    const signer = this.next(sheet, template);
    if (!signer) throw new ConflictException("Only a sheet waiting for a signature is sent back.");
    if (!(await this.maySign(sheet, signer))) throw new ForbiddenException("Only the one who signs next sends it back.");
    const date = sheet.date.toISOString().slice(0, 10);
    await this.tenant.tx(async (tx) => {
      await tx.dailySheet.update({ where: { id }, data: { status: "draft", signatures: [], returnNote: note } });
      await this.audit.record(tx, { action: "reject", entity: "daily_sheet", entityId: id, after: { date, note } });
      await this.notifications.notify(
        tx,
        { users: [sheet.userId] },
        { kind: "sheet_returned", title: `Your daily sheet for ${fmt(date)} is sent back`, body: note, link: `/app/daily-sheet?date=${date}` },
      );
    });
    return this.day(date, sheet.userId);
  }

  // ─── The team's day ─────────────────────────────────────────────────

  async team(date: string): Promise<SheetTeamRow[]> {
    const v = await this.visible();
    const me = this.tenant.userId ?? "";
    const [members, profiles, templates, sheets, leave, rules, settings] = await Promise.all([
      this.tenant.db.membership.findMany({ where: { agencyId: this.tenant.agencyId }, select: { user: { select: { id: true, name: true } } } }),
      this.tenant.db.employeeProfile.findMany({ where: { sheetTemplateId: { not: null } }, select: { userId: true, sheetTemplateId: true } }),
      this.tenant.db.sheetTemplate.findMany(),
      this.tenant.db.dailySheet.findMany({ where: { date: utc(date) } }),
      this.tenant.db.leaveRequest.findMany({ where: { status: "approved", from: { lte: utc(date) }, to: { gte: utc(date) } }, select: { userId: true } }),
      this.attendance.settings(),
      this.settings(),
    ]);
    const today = todayIST();
    const off = !!offDay(rules, date);
    return members
      .filter((m) => m.user.id !== me && (v === "all" || v.has(m.user.id)))
      .flatMap((m) => {
        const p = profiles.find((x) => x.userId === m.user.id);
        const s = sheets.find((x) => x.userId === m.user.id);
        const t = templates.find((x) => x.id === (s?.templateId ?? p?.sheetTemplateId));
        if (!t) return [];
        const state: SheetTeamRow["state"] =
          s?.status === "signed"
            ? "signed"
            : s?.status === "submitted"
              ? s.late
                ? "late"
                : "submitted"
              : leave.some((l) => l.userId === m.user.id)
                ? "on_leave"
                : off
                  ? "off"
                  : s
                    ? date < today
                      ? "missed"
                      : "draft"
                    : date < today
                      ? "missed"
                      : "pending";
        return [
          {
            user: m.user,
            template: t.name,
            state,
            sheetId: s?.id ?? null,
            minutes: s ? sheetTotals({ rows: s.rows as SheetRow[] }, settings).minutes : 0,
            waitingFor: s ? this.next(s, t) : null,
          },
        ];
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }

  private async names(ids: string[]) {
    const wanted = [...new Set(ids.filter(Boolean))];
    const people = wanted.length ? await this.tenant.db.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } }) : [];
    return new Map(people.map((p) => [p.id, p.name]));
  }
}
