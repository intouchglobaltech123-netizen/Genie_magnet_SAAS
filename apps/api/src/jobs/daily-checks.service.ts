import { Injectable } from "@nestjs/common";
import type { TenantTx } from "@gm/db";
import { DONE_STAGES, VIDEO_STAGE_LABEL, type VideoStageKey, windowOf } from "@gm/shared";
import { FileStore } from "../files/file-store.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { CyclesService } from "../production/cycles.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { ClientMessages } from "../whatsapp/client-messages.service.js";

const DAY = 86_400_000;
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const addDays = (d: string, n: number) => new Date(utc(d).getTime() + n * DAY).toISOString().slice(0, 10);
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const monthName = (m: string) => utc(`${m}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const RUNNING = ["active", "renewal_due", "paused"] as const;

/**
 * The checks each agency gets every morning (ADR 0010). Each runs in one transaction for the day it is for (`date`),
 * so it can run late or be retried without telling anyone twice: a day's notifications exist only if its run finished.
 * Each check looks for what changed on that day (due tomorrow, late since today, the notice period starting today), so
 * people hear about a thing once rather than every morning.
 */
@Injectable()
export class DailyChecks {
  constructor(
    private readonly tenant: TenantDb,
    private readonly notifications: NotificationsService,
    private readonly cycles: CyclesService,
    private readonly store: FileStore,
    private readonly messages: ClientMessages,
  ) {}

  /** Videos due tomorrow (their editor and director), and videos late since today (also whoever approves production). */
  async videosDue(tx: TenantTx, date: string) {
    const select = { id: true, code: true, title: true, stage: true, dueDate: true, editorId: true, directorId: true, client: { select: { name: true } } };
    const open = { stage: { notIn: DONE_STAGES } };
    const tomorrow = await tx.video.findMany({ where: { ...open, dueDate: utc(addDays(date, 1)) }, select });
    const late = await tx.video.findMany({ where: { ...open, dueDate: utc(addDays(date, -1)) }, select });
    for (const v of tomorrow)
      await this.notifications.notify(
        tx,
        // Nobody on it yet: whoever approves production hears instead.
        v.editorId || v.directorId ? { users: [v.editorId, v.directorId] } : { can: { area: "production", level: "approve" } },
        {
          kind: "video_due",
          title: `${v.code} is due tomorrow`,
          body: `${v.title} · ${v.client.name} · ${VIDEO_STAGE_LABEL[v.stage as VideoStageKey]}`,
          link: `/app/production/${v.id}`,
        },
      );
    for (const v of late)
      await this.notifications.notify(
        tx,
        { users: [v.editorId, v.directorId], can: { area: "production", level: "approve" } },
        {
          kind: "video_due",
          title: `${v.code} is late`,
          body: `${v.title} · ${v.client.name} — it was due ${fmt(v.dueDate!)} and is in ${VIDEO_STAGE_LABEL[v.stage as VideoStageKey]}`,
          link: `/app/production/${v.id}`,
        },
      );
    return { dueTomorrow: tomorrow.length, late: late.length };
  }

  /** A client's onboarding reminder falls due today, or their onboarding goes past its window today. */
  async onboardingReminders(tx: TenantTx, date: string) {
    const agency = await tx.agency.findUniqueOrThrow({ where: { id: this.tenant.agencyId }, select: { name: true, windowDays: true, reminderDays: true } });
    const rows = await tx.questionnaireResponse.findMany({
      where: { clientId: { not: null }, sentAt: { not: null }, completedAt: null },
      select: {
        id: true,
        clientId: true,
        sentAt: true,
        tokenSecret: true,
        client: { select: { name: true, accountOwnerId: true } },
        reminders: { select: { day: true } },
      },
    });
    let reminders = 0;
    let sent = 0;
    let overdue = 0;
    for (const r of rows) {
      const { day } = windowOf(r.sentAt!.toISOString(), agency.windowDays, false, date);
      if (day === null) continue;
      const who = r.client?.accountOwnerId ? { users: [r.client.accountOwnerId] } : { can: { area: "onboarding" as const, level: "edit" as const } };
      if (agency.reminderDays.includes(day) && !r.reminders.some((x) => x.day === day)) {
        // Sent by the app itself on WhatsApp when it can; the team is asked only otherwise.
        const queued = await this.messages.onboardingReminder(tx, { id: r.id, clientId: r.clientId!, tokenSecret: r.tokenSecret }, agency.name);
        if (queued.length) {
          sent++;
          await tx.questionnaireReminder.create({ data: { agencyId: this.tenant.agencyId, responseId: r.id, day, channel: "whatsapp" } });
          continue;
        }
        reminders++;
        await this.notifications.notify(tx, who, {
          kind: "onboarding_reminder",
          title: `Send ${r.client?.name}'s day-${day} onboarding reminder`,
          body: "The onboarding page has the message ready to send on WhatsApp.",
          link: `/app/onboarding/${r.id}`,
        });
      }
      if (day === agency.windowDays + 1) {
        overdue++;
        await this.notifications.notify(
          tx,
          { ...who, can: { area: "onboarding", level: "approve" } },
          {
            kind: "onboarding_reminder",
            title: `${r.client?.name}'s onboarding is past its ${agency.windowDays} days`,
            body: "Follow up with the client, or fill in the rest with them.",
            link: `/app/onboarding/${r.id}`,
          },
        );
      }
    }
    return { reminders, sentOnWhatsApp: sent, overdue };
  }

  /** An agreement's notice period starts today, or a running agreement ended yesterday without a renewal. */
  async renewals(tx: TenantTx, date: string) {
    const { renewalNoticeDays } = await tx.agency.findUniqueOrThrow({ where: { id: this.tenant.agencyId }, select: { renewalNoticeDays: true } });
    const select = { id: true, title: true, endDate: true, clientId: true, client: { select: { name: true, accountOwnerId: true } } };
    const renewed = async (id: string) => (await tx.agreement.count({ where: { renewsId: id } })) > 0;
    const starting = await tx.agreement.findMany({ where: { status: "active", endDate: utc(addDays(date, renewalNoticeDays)) }, select });
    const ended = await tx.agreement.findMany({ where: { status: { in: [...RUNNING] }, endDate: utc(addDays(date, -1)) }, select });
    let due = 0;
    let lapsed = 0;
    for (const a of starting) {
      if (await renewed(a.id)) continue;
      due++;
      await this.notifications.notify(
        tx,
        { users: [a.client.accountOwnerId], can: { area: "agreements", level: "approve" } },
        {
          kind: "renewal_due",
          title: `${a.client.name}: time to renew ${a.title}`,
          body: `It ends on ${fmt(a.endDate)}. Renew it from the client's page.`,
          link: `/app/clients/${a.clientId}`,
        },
      );
    }
    for (const a of ended) {
      if (await renewed(a.id)) continue;
      lapsed++;
      await this.notifications.notify(
        tx,
        { users: [a.client.accountOwnerId], can: { area: "agreements", level: "approve" } },
        {
          kind: "renewal_due",
          title: `${a.client.name}: ${a.title} ended without a renewal`,
          body: `It ended on ${fmt(a.endDate)}. Renew it, or mark it as ended.`,
          link: `/app/clients/${a.clientId}`,
        },
      );
    }
    return { renewalsDue: due, endedWithoutRenewal: lapsed };
  }

  /** Issued invoices that were due yesterday and are not paid. */
  async invoicesOverdue(tx: TenantTx, date: string) {
    const rows = await tx.invoice.findMany({
      where: { status: "sent", dueDate: utc(addDays(date, -1)) },
      select: { id: true, number: true, total: true, dueDate: true, createdBy: true, client: { select: { name: true } } },
    });
    for (const i of rows)
      await this.notifications.notify(
        tx,
        { users: [i.createdBy], can: { area: "invoices", level: "approve" } },
        {
          kind: "invoice_overdue",
          title: `${i.number} for ${i.client.name} is overdue`,
          body: `${money(i.total)} was due on ${fmt(i.dueDate!)}.`,
          link: `/app/invoices/${i.id}`,
        },
      );
    return { overdue: rows.length };
  }

  /** The month is set up for every running agreement; on the 1st, last month's open months wait to be closed. */
  async month(tx: TenantTx, date: string) {
    const month = date.slice(0, 7);
    const agreements = await tx.agreement.findMany({ where: { status: { in: [...RUNNING] } } });
    const before = await tx.cycle.count({ where: { month: utc(`${month}-01`) } });
    for (const a of agreements) await this.cycles.ensure(tx, a, month);
    const created = (await tx.cycle.count({ where: { month: utc(`${month}-01`) } })) - before;
    let toClose = 0;
    if (date.endsWith("-01")) {
      const last = addDays(date, -1).slice(0, 7);
      toClose = await tx.cycle.count({ where: { month: utc(`${last}-01`), closedAt: null } });
      if (toClose)
        await this.notifications.notify(
          tx,
          { can: { area: "agreements", level: "approve" } },
          {
            kind: "month_to_close",
            title: `${monthName(last)} is over — ${toClose === 1 ? "1 month waits" : `${toClose} months wait`} to be closed`,
            body: "Check what was delivered and decide on any shortfall.",
            link: "/app/cycles",
          },
        );
    }
    return { set: created, toClose };
  }

  /** Uploads started more than a day ago that never finished. */
  async filesCleanup(tx: TenantTx) {
    const rows = await tx.fileObject.findMany({
      where: { status: "pending", createdAt: { lt: new Date(Date.now() - DAY) } },
      select: { id: true, storageKey: true },
    });
    if (!rows.length) return { removed: 0 };
    await tx.fileObject.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    for (const r of rows) await this.store.remove(r.storageKey);
    return { removed: rows.length };
  }
}
