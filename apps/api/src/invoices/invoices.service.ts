import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type TenantTx } from "@gm/db";
import {
  allows,
  formatInvoiceNumber,
  type InvoiceInput,
  type InvoiceLine,
  type InvoicePayment,
  type InvoiceSettingsInput,
  invoiceTotals,
  type InvoiceUpdate,
  numberSeries,
  rupeesInWords,
} from "@gm/shared";
import { AuditService, changes } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { ClientMessages } from "../whatsapp/client-messages.service.js";
import { PaymentsService } from "../payments/payments.service.js";

type Settings = Prisma.InvoiceSettingsGetPayload<object>;
const WITH = {
  client: { select: { id: true, name: true, code: true, legalName: true, gstin: true, state: true, billingAddress: true } },
  agreement: { select: { id: true, title: true } },
} as const satisfies Prisma.InvoiceInclude;
type Row = Prisma.InvoiceGetPayload<{ include: typeof WITH }>;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const x = utc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2026-11" → "November 2026" */
export const periodLabel = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;

/** What the audit log keeps of the settings (not the bank account number in full). */
const settingsTerms = (s: Omit<Settings, "agencyId" | "updatedAt" | "numberSeries">) => ({
  legalName: s.legalName,
  gstin: s.gstin,
  state: s.state,
  address: s.address,
  services: s.services,
  numberFormat: s.numberFormat,
  nextNumber: s.nextNumber,
  paymentTermsDays: s.paymentTermsDays,
  bankName: s.bankName,
  accountName: s.accountName,
  accountNumber: s.accountNumber ? `…${s.accountNumber.slice(-4)}` : null,
  ifsc: s.ifsc,
  upiId: s.upiId,
  footer: s.footer,
});

/**
 * Invoice settings and GST invoices (P1-20). Drafts are made by people who may edit invoices; issuing (which numbers the
 * invoice and fixes its details) and cancelling need approve. The tax is CGST + SGST for a client in the agency's
 * registered state and IGST otherwise; an agency without a GSTIN charges none.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly messages: ClientMessages,
    private readonly payments: PaymentsService,
  ) {}

  // ─── Settings ─────────────────────────────────────────────────────

  private settingsRow() {
    return this.tenant.db.invoiceSettings.findUnique({ where: { agencyId: this.tenant.agencyId } });
  }

  private presentSettings(s: Settings) {
    const on = today();
    const series = numberSeries(s.numberFormat, on);
    // A new financial year starts again at 1 when the number shows the year.
    const next = s.numberSeries && s.numberSeries !== series ? 1 : s.nextNumber;
    return {
      legalName: s.legalName,
      gstin: s.gstin,
      state: s.state,
      address: s.address,
      services: s.services as unknown as { name: string; sac: string; rate: InvoiceLine["taxRate"] }[],
      numberFormat: s.numberFormat,
      nextNumber: next,
      nextNumberPreview: formatInvoiceNumber(s.numberFormat, next, on),
      paymentTermsDays: s.paymentTermsDays,
      bankName: s.bankName,
      accountName: s.accountName,
      accountNumber: s.accountNumber,
      ifsc: s.ifsc,
      upiId: s.upiId,
      footer: s.footer,
    };
  }

  async settings() {
    const s = await this.settingsRow();
    return s ? this.presentSettings(s) : null;
  }

  /** Agency settings editors and people who may approve invoices (finance) keep the invoice details. */
  async saveSettings(input: Omit<InvoiceSettingsInput, "gstin"> & { gstin: string | null }) {
    const p = this.tenant.permissions;
    if (!allows(p, "settings", "edit") && !allows(p, "invoices", "approve"))
      throw new ForbiddenException("Invoice settings are kept by people who may change agency settings or approve invoices.");
    const current = await this.settingsRow();
    const { nextNumber, ...rest } = input;
    const data = {
      ...rest,
      services: input.services as Prisma.InputJsonValue,
      // Setting the next number starts the series from it today.
      ...(nextNumber !== undefined && nextNumber !== current?.nextNumber && { nextNumber, numberSeries: numberSeries(input.numberFormat, today()) }),
    };
    await this.tenant.tx(async (tx) => {
      const saved = await tx.invoiceSettings.upsert({
        where: { agencyId: this.tenant.agencyId },
        create: { agencyId: this.tenant.agencyId, ...data },
        update: data,
      });
      const diff = current ? changes(settingsTerms(current), settingsTerms(saved)) : { before: {}, after: settingsTerms(saved) };
      if (diff) await this.audit.record(tx, { action: current ? "update" : "create", entity: "invoice_settings", before: diff.before, after: diff.after });
    });
    return this.settings();
  }

  // ─── Invoices ─────────────────────────────────────────────────────

  private async agencyLook() {
    return this.tenant.db.agency.findUnique({ where: { id: this.tenant.agencyId }, select: { name: true, logo: true, brandColor: true } });
  }

  private seller(s: Settings | null, look: { logo: string | null; brandColor: string | null } | null) {
    if (!s) return null;
    const { services: _s, numberFormat: _f, nextNumber: _n, nextNumberPreview: _p, paymentTermsDays: _t, ...rest } = this.presentSettings(s);
    return { ...rest, logo: look?.logo ?? null, brandColor: look?.brandColor ?? null };
  }

  private billedTo(c: Row["client"]) {
    return { name: c.legalName ?? c.name, gstin: c.gstin, state: c.state, address: c.billingAddress };
  }

  /** Totals for lines billed to a client in `clientState`. Without a client state, the supply is taken as within the state. */
  private totals(lines: InvoiceLine[], clientState: string | null, s: Settings | null) {
    const placeOfSupply = clientState ?? s?.state ?? null;
    const intraState = !s || placeOfSupply === s.state;
    return { placeOfSupply, intraState, registered: !!s?.gstin, ...invoiceTotals(lines, { intraState, registered: !!s?.gstin }) };
  }

  private async present(rows: Row[]) {
    const [s, look] = rows.some((r) => r.status === "draft") ? await Promise.all([this.settingsRow(), this.agencyLook()]) : [null, null];
    const received = rows.length
      ? await this.tenant.db.payment.findMany({ where: { invoiceId: { in: rows.map((r) => r.id) } }, orderBy: { paidAt: "asc" } })
      : [];
    const on = today();
    return rows.map((r) => {
      const lines = r.lines as unknown as InvoiceLine[];
      const draft = r.status === "draft";
      const seller = draft ? this.seller(s, look) : (r.seller as ReturnType<InvoicesService["seller"]>);
      const registered = draft ? !!s?.gstin : !!seller?.gstin;
      const placeOfSupply = draft ? (r.client.state ?? s?.state ?? null) : r.placeOfSupply;
      return {
        id: r.id,
        number: r.number,
        status: r.status as "draft" | "sent" | "paid" | "cancelled",
        client: { id: r.client.id, name: r.client.name, code: r.client.code },
        agreement: r.agreement,
        period: r.period,
        issueDate: day(r.issueDate),
        dueDate: day(r.dueDate),
        placeOfSupply,
        intraState: !seller || placeOfSupply === seller.state,
        registered,
        lines: lines.map((l) => ({ ...l, amount: l.quantity * l.rate })),
        taxable: r.taxable,
        cgst: r.cgst,
        sgst: r.sgst,
        igst: r.igst,
        total: r.total,
        totalInWords: rupeesInWords(r.total),
        billedTo: draft ? this.billedTo(r.client) : (r.billedTo as ReturnType<InvoicesService["billedTo"]>),
        seller,
        notes: r.notes,
        sentAt: r.sentAt,
        paidOn: day(r.paidOn),
        paymentNote: r.paymentNote,
        cancelReason: r.cancelReason,
        overdue: r.status === "sent" && !!r.dueDate && day(r.dueDate)! < on,
        createdAt: r.createdAt,
        payLink: r.payLinkStatus ? { url: r.payLinkUrl, status: r.payLinkStatus, error: r.payLinkError } : null,
        payments: received
          .filter((p) => p.invoiceId === r.id)
          .map((p) => ({ amount: p.amount, method: p.method, paidAt: p.paidAt.toISOString(), reference: p.providerPaymentId })),
      };
    });
  }

  async list(f: { status?: string; clientId?: string; overdue?: boolean }) {
    const rows = await this.tenant.db.invoice.findMany({
      where: {
        ...(f.clientId && { clientId: f.clientId }),
        ...(f.status && { status: f.status }),
        ...(f.overdue && { status: "sent", dueDate: { lt: utc(today()) } }),
      },
      include: WITH,
      orderBy: [{ issueDate: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      take: 1000,
    });
    return this.present(rows);
  }

  private async find(id: string) {
    const row = await this.tenant.db.invoice.findFirst({ where: { id }, include: WITH });
    if (!row) throw new NotFoundException("No invoice with that id.");
    return row;
  }

  async get(id: string) {
    return (await this.present([await this.find(id)]))[0]!;
  }

  private async client(clientId: string) {
    const client = await this.tenant.db.client.findFirst({ where: { id: clientId }, select: { id: true, name: true, state: true, archivedAt: true } });
    if (!client) throw new BadRequestException({ message: "Choose one of your clients.", issues: [{ path: "clientId", message: "Choose the client" }] });
    return client;
  }

  private async insert(
    tx: TenantTx,
    data: { clientId: string; agreementId?: string; period?: string; lines: InvoiceLine[]; notes?: string },
    clientState: string | null,
  ) {
    const t = this.totals(data.lines, clientState, await this.settingsRow());
    const inv = await tx.invoice.create({
      data: {
        agencyId: this.tenant.agencyId,
        clientId: data.clientId,
        agreementId: data.agreementId,
        period: data.period,
        lines: data.lines as unknown as Prisma.InputJsonValue,
        notes: data.notes,
        taxable: t.taxable,
        cgst: t.cgst,
        sgst: t.sgst,
        igst: t.igst,
        total: t.total,
        createdBy: this.tenant.userId,
      },
    });
    await this.audit.record(tx, {
      action: "create",
      entity: "invoice",
      entityId: inv.id,
      after: { status: "draft", clientId: data.clientId, period: data.period ?? null, total: t.total },
    });
    await this.notifications.notify(
      tx,
      { can: { area: "invoices", level: "approve" } },
      {
        kind: "invoice_to_issue",
        title: "Draft invoice to issue",
        body: `₹${t.total.toLocaleString("en-IN")}${data.period ? ` for ${periodLabel(data.period)}` : ""}`,
        link: `/app/invoices/${inv.id}`,
      },
    );
    return inv.id;
  }

  async create(input: InvoiceInput & { lines: InvoiceLine[] }) {
    const client = await this.client(input.clientId);
    if (input.agreementId) {
      const a = await this.tenant.db.agreement.findFirst({ where: { id: input.agreementId, clientId: client.id }, select: { id: true } });
      if (!a)
        throw new BadRequestException({
          message: "That agreement is not this client's.",
          issues: [{ path: "agreementId", message: "Choose one of the client's agreements" }],
        });
    }
    const id = await this.tenant.tx((tx) => this.insert(tx, input, client.state));
    return this.get(id);
  }

  /** A draft for one month of an agreement: its fee as one line, with the agency's first service. */
  async fromAgreement(agreementId: string, period: string) {
    const a = await this.tenant.db.agreement.findFirst({ where: { id: agreementId }, include: { client: { select: { state: true } } } });
    if (!a) throw new NotFoundException("No agreement with that id.");
    if (a.status === "draft") throw new ConflictException("Sign off the agreement before invoicing it.");
    const first = `${period}-01`;
    if (first > day(a.endDate)! || period < day(a.startDate)!.slice(0, 7))
      throw new BadRequestException({
        message: "That month is outside the agreement.",
        issues: [{ path: "period", message: "Pick a month the agreement runs" }],
      });
    const existing = await this.tenant.db.invoice.findFirst({
      where: { agreementId, period, status: { not: "cancelled" } },
      select: { number: true, status: true },
    });
    if (existing)
      throw new ConflictException(
        existing.number ? `${periodLabel(period)} is already invoiced: ${existing.number}.` : `There is already a draft for ${periodLabel(period)}.`,
      );
    const settings = await this.settingsRow();
    const service = (settings?.services as unknown as { sac: string; rate: InvoiceLine["taxRate"] }[] | undefined)?.[0];
    const line: InvoiceLine = {
      description: `${a.title} — ${periodLabel(period)}`,
      sac: service?.sac ?? "998361",
      quantity: 1,
      rate: a.monthlyFee,
      taxRate: service?.rate ?? 18,
    };
    const id = await this.tenant.tx((tx) => this.insert(tx, { clientId: a.clientId, agreementId, period, lines: [line] }, a.client.state));
    return this.get(id);
  }

  /** Only a draft changes. */
  async update(id: string, input: InvoiceUpdate & { lines?: InvoiceLine[] }) {
    const current = await this.find(id);
    if (current.status !== "draft") throw new ConflictException("An issued invoice cannot be changed — cancel it and issue a new one.");
    const lines = input.lines ?? (current.lines as unknown as InvoiceLine[]);
    const t = this.totals(lines, current.client.state, await this.settingsRow());
    const next = { lines, period: input.period ?? current.period, notes: input.notes === undefined ? current.notes : input.notes || null };
    const diff = changes({ lines: current.lines, period: current.period, notes: current.notes, total: current.total }, { ...next, total: t.total });
    if (diff) {
      await this.tenant.tx(async (tx) => {
        await tx.invoice.update({
          where: { id },
          data: { ...next, lines: lines as unknown as Prisma.InputJsonValue, taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, igst: t.igst, total: t.total },
        });
        await this.audit.record(tx, { action: "update", entity: "invoice", entityId: id, before: diff.before, after: diff.after });
      });
    }
    return this.get(id);
  }

  /**
   * Issuing gives the invoice the next number, its date and due date, and keeps a copy of the agency's and the client's
   * details as they are now. The number comes from the settings row, which the update locks until the transaction ends,
   * so two invoices issued at once never share a number.
   */
  async issue(id: string, issueDate = today()) {
    const current = await this.find(id);
    if (current.status !== "draft") throw new ConflictException("This invoice is already issued.");
    const s = await this.settingsRow();
    if (!s) throw new ConflictException("Set up your invoice details first (Settings → Invoice settings).");
    const look = await this.agencyLook();
    const lines = current.lines as unknown as InvoiceLine[];
    const t = this.totals(lines, current.client.state, s);
    const series = numberSeries(s.numberFormat, issueDate);
    try {
      await this.tenant.tx(async (tx) => {
        const locked = await tx.invoiceSettings.update({ where: { agencyId: this.tenant.agencyId }, data: { nextNumber: { increment: 1 } } });
        let seq = locked.nextNumber - 1;
        if (locked.numberSeries !== series) {
          // First invoice of a new financial year (or first ever): start again at 1, unless a starting number was set for it.
          seq = locked.numberSeries === null ? seq : 1;
          await tx.invoiceSettings.update({ where: { agencyId: this.tenant.agencyId }, data: { numberSeries: series, nextNumber: seq + 1 } });
        }
        const number = formatInvoiceNumber(s.numberFormat, seq, issueDate);
        await tx.invoice.update({
          where: { id },
          data: {
            number,
            status: "sent",
            issueDate: utc(issueDate),
            dueDate: addDays(issueDate, s.paymentTermsDays),
            placeOfSupply: t.placeOfSupply,
            taxable: t.taxable,
            cgst: t.cgst,
            sgst: t.sgst,
            igst: t.igst,
            total: t.total,
            billedTo: this.billedTo(current.client),
            seller: this.seller(s, look) as Prisma.InputJsonValue,
            sentAt: new Date(),
          },
        });
        await this.audit.record(tx, {
          action: "issue",
          entity: "invoice",
          entityId: id,
          before: { status: "draft" },
          after: { status: "sent", number, issueDate, client: current.client.name, total: t.total },
        });
        await this.payments.queueLink(tx, id);
        await this.messages.invoiceIssued(tx, current.clientId, { id, number, total: t.total, dueDate: addDays(issueDate, s.paymentTermsDays) });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new ConflictException("That invoice number is already used — set the next number in Settings → Invoice settings.");
      throw e;
    }
    return this.get(id);
  }

  async markPaid(id: string, input: InvoicePayment) {
    const current = await this.find(id);
    if (current.status !== "sent")
      throw new ConflictException(current.status === "draft" ? "Issue the invoice first." : "Only a sent invoice can be marked as paid.");
    if (input.paidOn < day(current.issueDate)!)
      throw new BadRequestException({
        message: "It cannot be paid before it was issued.",
        issues: [{ path: "paidOn", message: "On or after the invoice date" }],
      });
    await this.tenant.tx(async (tx) => {
      await tx.invoice.update({ where: { id }, data: { status: "paid", paidOn: utc(input.paidOn), paymentNote: input.note ?? null } });
      await this.audit.record(tx, {
        action: "paid",
        entity: "invoice",
        entityId: id,
        before: { status: "sent" },
        after: { status: "paid", number: current.number, paidOn: input.paidOn, note: input.note ?? null },
      });
      await this.notifications.notify(
        tx,
        { users: [current.createdBy] },
        { kind: "invoice_paid", title: `Paid: ${current.number} · ${current.client.name}`, link: `/app/invoices/${id}` },
      );
    });
    return this.get(id);
  }

  /** An issued invoice keeps its number when cancelled, so the numbering has no gaps. */
  async cancel(id: string, reason: string) {
    const current = await this.find(id);
    if (current.status !== "sent")
      throw new ConflictException(current.status === "draft" ? "Delete the draft instead." : "A paid invoice cannot be cancelled.");
    await this.tenant.tx(async (tx) => {
      await tx.invoice.update({ where: { id }, data: { status: "cancelled", cancelReason: reason } });
      if (current.payLinkId) await this.payments.queueCancel(tx, id);
      await this.audit.record(tx, {
        action: "cancel",
        entity: "invoice",
        entityId: id,
        before: { status: "sent" },
        after: { status: "cancelled", number: current.number, reason },
      });
    });
    return this.get(id);
  }

  async remove(id: string) {
    const current = await this.find(id);
    if (current.status !== "draft") throw new ConflictException("Only a draft can be deleted; cancel an issued invoice instead.");
    await this.tenant.tx(async (tx) => {
      await tx.invoice.delete({ where: { id } });
      await this.audit.record(tx, {
        action: "delete",
        entity: "invoice",
        entityId: id,
        before: { status: "draft", client: current.client.name, total: current.total },
      });
    });
  }
}
