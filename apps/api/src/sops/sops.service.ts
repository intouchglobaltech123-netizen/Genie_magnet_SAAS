import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import {
  allows,
  type Kra,
  OWNER_ROLE,
  type RunResult,
  type SopInput,
  type SopRow,
  type SopRunInput,
  type SopRunRow,
  type SopRunStatus,
  type SopVersionInput,
  type SopVersionRow,
  type SopVersionStatus,
  sopInput,
  sopRunInput,
  sopVersionInput,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const IST = 330 * 60_000;
type Version = Prisma.SopVersionGetPayload<object>;
type Full = Prisma.SopGetPayload<{ include: { versions: true } }>;
type Item = { key: string; text: string; result: RunResult; note: string };

/**
 * SOPs and checklists (P5-17). Everyone reads the SOPs in use and runs their checklists; those who may edit reviews
 * (or an SOP's owner) keep SOPs and draft versions; each version is approved by the SOP's approver (or someone who may
 * approve reviews) before it is used; each run is checked by the SOP's checker — a failed one counts in the reviews and
 * the doer's KRAs.
 */
@Injectable()
export class SopsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private me() {
    return this.tenant.userId ?? "";
  }

  private may(level: "view" | "edit" | "approve") {
    return allows(this.tenant.permissions, "reports", level);
  }

  private async names(ids: (string | null | undefined)[]) {
    const wanted = [...new Set(ids.filter((x): x is string => !!x))];
    const people = wanted.length ? await this.tenant.db.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } }) : [];
    return new Map(people.map((p) => [p.id, p.name]));
  }

  // ─── SOPs ───────────────────────────────────────────────────────────

  async list(): Promise<SopRow[]> {
    const rows = await this.tenant.db.sop.findMany({ where: this.may("view") ? {} : { active: true }, include: { versions: true }, orderBy: { title: "asc" } });
    return this.present(
      rows.filter((r) => this.may("view") || r.versions.some((v) => v.status === "approved")),
      false,
    );
  }

  async get(id: string): Promise<SopRow> {
    const s = await this.tenant.db.sop.findFirst({ where: { id }, include: { versions: true } });
    if (!s || (!this.may("view") && !s.versions.some((v) => v.status === "approved"))) throw new NotFoundException("No SOP with that id.");
    return (await this.present([s], true))[0]!;
  }

  private async validate(s: ReturnType<typeof sopInput.parse>) {
    const people = [...new Set([s.ownerId, s.checkerId, s.approverId, ...s.doerIds].filter((x): x is string => !!x))];
    if (people.length && (await this.tenant.db.membership.count({ where: { agencyId: this.tenant.agencyId, userId: { in: people } } })) !== people.length)
      throw new BadRequestException("Choose people in your team.");
    if (s.departmentId && !(await this.tenant.db.department.findFirst({ where: { id: s.departmentId }, select: { id: true } })))
      throw new BadRequestException("Choose one of your departments.");
    if (s.kraTemplateId) {
      const t = await this.tenant.db.kraTemplate.findFirst({ where: { id: s.kraTemplateId } });
      if (!t || (s.kraKey && !(t.kras as Kra[]).some((k) => k.key === s.kraKey)))
        throw new BadRequestException({ message: "Choose one of your KRAs.", issues: [{ path: "kraKey", message: "Choose the KRA" }] });
    }
  }

  async create(input: SopInput) {
    const s = sopInput.parse(input);
    await this.validate(s);
    const row = await this.tenant.tx(async (tx) => {
      const created = await tx.sop.create({ data: { agencyId: this.tenant.agencyId, ...s } });
      await tx.sopVersion.create({ data: { agencyId: this.tenant.agencyId, sopId: created.id, number: 1, createdBy: this.me() || null } });
      await this.audit.record(tx, { action: "create", entity: "sop", entityId: created.id, after: { title: s.title } });
      return created;
    });
    return this.get(row.id);
  }

  async update(id: string, input: SopInput) {
    const s = sopInput.parse(input);
    const before = await this.tenant.db.sop.findFirst({ where: { id } });
    if (!before) throw new NotFoundException("No SOP with that id.");
    await this.validate(s);
    await this.tenant.tx(async (tx) => {
      await tx.sop.update({ where: { id }, data: s });
      await this.audit.record(tx, {
        action: "update",
        entity: "sop",
        entityId: id,
        before: { title: before.title, active: before.active },
        after: { title: s.title, active: s.active },
      });
    });
    return this.get(id);
  }

  // ─── Versions ───────────────────────────────────────────────────────

  private async version(versionId: string) {
    const v = await this.tenant.db.sopVersion.findFirst({ where: { id: versionId }, include: { sop: true } });
    if (!v) throw new NotFoundException("No SOP version with that id.");
    return v;
  }

  private assertKeeps(sop: { ownerId: string | null }) {
    if (!(this.may("edit") || sop.ownerId === this.me())) throw new ForbiddenException("Its owner, or someone who keeps SOPs, changes it.");
  }

  /** A new draft from the version in use, unless one is being worked on. */
  async newDraft(sopId: string) {
    const s = await this.tenant.db.sop.findFirst({ where: { id: sopId }, include: { versions: { orderBy: { number: "desc" } } } });
    if (!s) throw new NotFoundException("No SOP with that id.");
    this.assertKeeps(s);
    if (s.versions.some((v) => v.status === "draft" || v.status === "in_review")) throw new ConflictException("A new version is already being worked on.");
    const from = s.versions.find((v) => v.status === "approved");
    await this.tenant.tx(async (tx) => {
      await tx.sopVersion.create({
        data: {
          agencyId: this.tenant.agencyId,
          sopId,
          number: (s.versions[0]?.number ?? 0) + 1,
          purpose: from?.purpose ?? "",
          scope: from?.scope ?? "",
          steps: (from?.steps as Prisma.InputJsonValue | undefined) ?? [],
          checklist: (from?.checklist as Prisma.InputJsonValue | undefined) ?? [],
          createdBy: this.me() || null,
        },
      });
    });
    return this.get(sopId);
  }

  async saveVersion(versionId: string, input: SopVersionInput) {
    const d = sopVersionInput.parse(input);
    const v = await this.version(versionId);
    this.assertKeeps(v.sop);
    if (v.status !== "draft") throw new ConflictException("Only a draft changes.");
    if (new Set(d.checklist.map((c) => c.key)).size !== d.checklist.length) throw new BadRequestException("Each check needs its own key.");
    await this.tenant.db.sopVersion.update({
      where: { id: versionId },
      data: { purpose: d.purpose, scope: d.scope, steps: d.steps, checklist: d.checklist, changeNote: d.changeNote },
    });
    return this.get(v.sopId);
  }

  /** Sent to the approver. */
  async submit(versionId: string) {
    const v = await this.version(versionId);
    this.assertKeeps(v.sop);
    if (v.status !== "draft") throw new ConflictException("Only a draft is sent for approval.");
    if (!(v.steps as unknown[]).length && !(v.checklist as unknown[]).length) throw new BadRequestException("Write its steps or its checklist first.");
    await this.tenant.tx(async (tx) => {
      await tx.sopVersion.update({ where: { id: versionId }, data: { status: "in_review" } });
      await this.audit.record(tx, { action: "update", entity: "sop_version", entityId: versionId, after: { sop: v.sop.title, number: v.number, sent: true } });
      await this.notifications.notify(tx, v.sop.approverId ? { users: [v.sop.approverId] } : { can: { area: "reports", level: "approve" } }, {
        kind: "sop_to_approve",
        title: `${v.sop.title}, version ${v.number}, waits for approval`,
        body: v.changeNote || undefined,
        link: `/app/sops?sop=${v.sopId}`,
      });
    });
    return this.get(v.sopId);
  }

  /** The approver approves (it is used from now, the one before replaced) or sends it back to draft. */
  async decide(versionId: string, approved: boolean, note: string) {
    const v = await this.version(versionId);
    if (v.status !== "in_review") throw new ConflictException("It is not waiting for approval.");
    const me = this.me();
    const mayApprove = v.sop.approverId ? v.sop.approverId === me || this.may("approve") : this.may("approve");
    if (!mayApprove) throw new ForbiddenException("The SOP's approver decides.");
    if (v.createdBy === me && this.tenant.role !== OWNER_ROLE && v.sop.approverId !== me) throw new ForbiddenException("Someone else approves what you wrote.");
    await this.tenant.tx(async (tx) => {
      if (approved) {
        await tx.sopVersion.updateMany({ where: { sopId: v.sopId, status: "approved" }, data: { status: "superseded" } });
        await tx.sopVersion.update({ where: { id: versionId }, data: { status: "approved", approvedBy: me || null, approvedAt: new Date() } });
      } else
        await tx.sopVersion.update({
          where: { id: versionId },
          data: { status: "draft", changeNote: note ? `${v.changeNote}\nSent back: ${note}`.trim() : v.changeNote },
        });
      await this.audit.record(tx, {
        action: approved ? "approve" : "reject",
        entity: "sop_version",
        entityId: versionId,
        after: { sop: v.sop.title, number: v.number, note },
      });
    });
    return this.get(v.sopId);
  }

  // ─── Runs ───────────────────────────────────────────────────────────

  /** A run of the version in use: by one of its doers (anyone, when it names none). */
  async run(sopId: string, input: SopRunInput) {
    const r = sopRunInput.parse(input);
    const s = await this.tenant.db.sop.findFirst({ where: { id: sopId, active: true }, include: { versions: { where: { status: "approved" } } } });
    const v = s?.versions[0];
    if (!s || !v) throw new NotFoundException("No SOP in use with that id.");
    const me = this.me();
    if (s.doerIds.length && !s.doerIds.includes(me) && !this.may("edit")) throw new ForbiddenException("Its doers run it.");
    const checks = v.checklist as { key: string; text: string }[];
    const items: Item[] = checks.map((c) => {
      const got = r.items.find((i) => i.key === c.key);
      if (!got) throw new BadRequestException({ message: "Answer every check.", issues: [{ path: `items.${c.key}`, message: `“${c.text}” is not answered` }] });
      return { key: c.key, text: c.text, result: got.result, note: got.note };
    });
    const row = await this.tenant.tx(async (tx) => {
      const created = await tx.sopRun.create({ data: { agencyId: this.tenant.agencyId, sopId, versionId: v.id, by: me, about: r.about, items, note: r.note } });
      await this.notifications.notify(tx, s.checkerId ? { users: [s.checkerId] } : { can: { area: "reports", level: "edit" } }, {
        kind: "checklist_to_check",
        title: `${s.title}${r.about ? ` — ${r.about}` : ""}: checklist to check`,
        link: `/app/sops?run=${created.id}`,
      });
      return created;
    });
    return (await this.runs({ id: row.id }))[0]!;
  }

  async runs(filter: { sopId?: string; status?: SopRunStatus; id?: string; mine?: boolean }): Promise<SopRunRow[]> {
    const me = this.me();
    const rows = await this.tenant.db.sopRun.findMany({
      where: {
        ...(filter.sopId && { sopId: filter.sopId }),
        ...(filter.status && { status: filter.status }),
        ...(filter.id && { id: filter.id }),
        ...(filter.mine || !this.may("view") ? { OR: [{ by: me }, { sop: { checkerId: me } }] } : {}),
      },
      include: { sop: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    const versions = await this.tenant.db.sopVersion.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.versionId))] } },
      select: { id: true, number: true },
    });
    const names = await this.names(rows.flatMap((r) => [r.by, r.checkedBy]));
    return rows.map((r) => ({
      id: r.id,
      sop: r.sop,
      version: versions.find((v) => v.id === r.versionId)?.number ?? 0,
      by: { id: r.by, name: names.get(r.by) ?? "" },
      about: r.about,
      items: r.items as Item[],
      note: r.note,
      status: r.status as SopRunStatus,
      checkedBy: r.checkedBy ? (names.get(r.checkedBy) ?? null) : null,
      checkNote: r.checkNote,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** The checker passes it, or fails it with what was wrong — never their own run. */
  async check(runId: string, passed: boolean, note: string) {
    const r = await this.tenant.db.sopRun.findFirst({ where: { id: runId }, include: { sop: true } });
    if (!r) throw new NotFoundException("No checklist run with that id.");
    const me = this.me();
    if (!(r.sop.checkerId === me || this.may("edit"))) throw new ForbiddenException("Its checker checks it.");
    if (r.by === me && this.tenant.role !== OWNER_ROLE) throw new ForbiddenException("Someone else checks your own run.");
    if (r.status !== "submitted") throw new ConflictException("It is checked.");
    await this.tenant.tx(async (tx) => {
      await tx.sopRun.update({
        where: { id: runId },
        data: { status: passed ? "passed" : "failed", checkedBy: me, checkedAt: new Date(), checkNote: note || null },
      });
      await this.audit.record(tx, { action: passed ? "approve" : "reject", entity: "sop_run", entityId: runId, after: { sop: r.sop.title, note } });
    });
    return (await this.runs({ id: runId }))[0]!;
  }

  // ─── Reading ────────────────────────────────────────────────────────

  private async present(rows: Full[], full: boolean): Promise<SopRow[]> {
    const [deps, templates, names, counts] = await Promise.all([
      this.tenant.db.department.findMany({ select: { id: true, name: true } }),
      this.tenant.db.kraTemplate.findMany({ where: { id: { in: rows.map((r) => r.kraTemplateId).filter((x): x is string => !!x) } } }),
      this.names(rows.flatMap((r) => [r.ownerId, r.checkerId, r.approverId, ...r.doerIds, ...r.versions.map((v) => v.approvedBy)])),
      this.tenant.db.sopRun.groupBy({
        by: ["sopId", "status"],
        where: {
          sopId: { in: rows.map((r) => r.id) },
          createdAt: { gte: new Date(Date.parse(new Date(Date.now() + IST).toISOString().slice(0, 7) + "-01T00:00:00Z") - IST) },
        },
        _count: { _all: true },
      }),
    ]);
    const person = (id: string | null) => (id ? { id, name: names.get(id) ?? "" } : null);
    const version = (v: Version | undefined): SopVersionRow | null =>
      v
        ? {
            id: v.id,
            number: v.number,
            status: v.status as SopVersionStatus,
            purpose: v.purpose,
            scope: v.scope,
            steps: v.steps as { text: string }[],
            checklist: v.checklist as { key: string; text: string }[],
            changeNote: v.changeNote,
            approvedBy: v.approvedBy ? (names.get(v.approvedBy) ?? null) : null,
            approvedAt: v.approvedAt?.toISOString() ?? null,
            createdAt: v.createdAt.toISOString(),
          }
        : null;
    const editor = this.may("view");
    return rows.map((s) => {
      const t = templates.find((x) => x.id === s.kraTemplateId);
      const kra = t && s.kraKey ? (t.kras as Kra[]).find((k) => k.key === s.kraKey) : undefined;
      const mine = counts.filter((c) => c.sopId === s.id);
      const sorted = [...s.versions].sort((a, b) => b.number - a.number);
      return {
        id: s.id,
        title: s.title,
        department: deps.find((d) => d.id === s.departmentId) ?? null,
        owner: person(s.ownerId),
        pssRef: s.pssRef,
        kra: t && kra ? { templateId: t.id, template: t.name, key: kra.key, name: kra.name } : null,
        doers: s.doerIds.map((d) => ({ id: d, name: names.get(d) ?? "" })),
        checker: person(s.checkerId),
        approver: person(s.approverId),
        active: s.active,
        current: version(sorted.find((v) => v.status === "approved")),
        draft: editor || s.ownerId === this.me() ? version(sorted.find((v) => v.status === "draft" || v.status === "in_review")) : null,
        ...(full && {
          versions: sorted.map((v) => ({
            id: v.id,
            number: v.number,
            status: v.status as SopVersionStatus,
            changeNote: v.changeNote,
            approvedAt: v.approvedAt?.toISOString() ?? null,
          })),
        }),
        runs: { month: mine.reduce((n, c) => n + c._count._all, 0), failed: mine.find((c) => c.status === "failed")?._count._all ?? 0 },
      };
    });
  }
}
