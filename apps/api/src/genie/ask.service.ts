import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import { allows, type AreaKey, type AskConversationRow, type AskInput, type AskSource, GENIE_RULES, VIDEO_STAGE_LABEL, type VideoStageKey } from "@gm/shared";
import { z } from "zod";
import { ClientsService } from "../clients/clients.service.js";
import { LeadsService } from "../crm/leads.service.js";
import { InvoicesService } from "../invoices/invoices.service.js";
import { CyclesService } from "../production/cycles.service.js";
import { VideosService } from "../production/videos.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { DraftsService } from "./drafts.service.js";
import { GenieService } from "./genie.service.js";
import { type AskTool, GENIE_MODEL, type GenieModel } from "./model.js";

const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const LINK = /\[([^\]]+)\]\((\/app\/[^)\s]+)\)/g;
/** Earlier turns sent with a new question. */
const HISTORY = 10;

/**
 * Ask Genie (P4-08): questions about the agency answered by the model with read-only tools over the app's own data.
 * Every tool runs as the person asking, through the same services and permission checks as their screens, so an
 * editor asking about a client's videos hears only about their own. Answers link to the records they used, and the
 * conversation is kept for the agency's retention period.
 */
@Injectable()
export class AskService {
  constructor(
    @Inject(GENIE_MODEL) private readonly model: GenieModel,
    private readonly tenant: TenantDb,
    private readonly genie: GenieService,
    private readonly drafts: DraftsService,
    private readonly clients: ClientsService,
    private readonly videos: VideosService,
    private readonly invoices: InvoicesService,
    private readonly leads: LeadsService,
    private readonly cycles: CyclesService,
  ) {}

  private can(area: AreaKey) {
    return allows(this.tenant.permissions, area, "view");
  }

  /** A client this person may see, by code or by (part of) its name. */
  private async client(ref: string | undefined) {
    if (!ref) return null;
    const all = (await this.clients.list()).filter((c) => !c.archivedAt);
    const r = ref.trim().toLowerCase();
    return (
      all.find((c) => c.code.toLowerCase() === r) ?? all.find((c) => c.name.toLowerCase() === r) ?? all.find((c) => c.name.toLowerCase().includes(r)) ?? null
    );
  }

  /** The read-only tools, each checked against the asker's own access. */
  tools(sources: Map<string, string>): AskTool[] {
    const cite = <T extends { label: string; href: string }>(items: T[]) => {
      for (const i of items) sources.set(i.href, i.label);
      return items;
    };
    const cannot = (what: string) => ({ error: `This person's role cannot see ${what}.` });
    const noClient = (ref: string) => ({ error: `No client called "${ref}" that this person can see.` });
    return [
      {
        name: "find_clients",
        description: "The agency's clients this person can see, optionally only those whose name or code contains the query.",
        input: z.object({ query: z.string().optional().describe("Part of a client's name or code") }),
        run: async (i) => {
          if (!this.can("clients")) return cannot("clients");
          const q = typeof i.query === "string" ? i.query.toLowerCase() : "";
          const rows = (await this.clients.list()).filter((c) => !c.archivedAt && (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)));
          return {
            clients: cite(
              rows.slice(0, 30).map((c) => ({
                code: c.code,
                name: c.name,
                health: c.health,
                accountOwner: c.accountOwner?.name ?? null,
                label: c.name,
                href: `/app/clients/${c.id}`,
              })),
            ),
          };
        },
      },
      {
        name: "list_videos",
        description:
          "Videos this person can see (an editor sees only the videos they work on). Filter by client, by stage, to those waiting on the client's approval, or to those past their due date.",
        input: z.object({
          client: z.string().optional().describe("The client's code or name"),
          stage: z.enum(Object.keys(VIDEO_STAGE_LABEL) as [VideoStageKey, ...VideoStageKey[]]).optional(),
          waitingOnClient: z.boolean().optional().describe("Only videos sent to the client and waiting for their approval"),
          overdue: z.boolean().optional().describe("Only videos past their due date and not done"),
        }),
        run: async (i) => {
          if (!this.can("production")) return cannot("videos");
          const client = await this.client(i.client as string | undefined);
          if (i.client && !client) return noClient(String(i.client));
          const rows = await this.videos.list({
            clientId: client?.id,
            stage: i.waitingOnClient ? "client_review" : (i.stage as string | undefined),
            due: i.overdue ? "overdue" : undefined,
          });
          return {
            count: rows.length,
            videos: cite(
              rows.slice(0, 50).map((v) => ({
                code: v.code,
                title: v.title,
                client: v.client.name,
                stage: VIDEO_STAGE_LABEL[v.stage as VideoStageKey] ?? v.stage,
                due: v.dueDate,
                editor: v.editor?.name ?? null,
                latestVersion: v.latestVersion?.label ?? null,
                label: `${v.code} · ${v.title}`,
                href: `/app/production/${v.id}`,
              })),
            ),
          };
        },
      },
      {
        name: "client_summary",
        description:
          "One client at a glance: running agreements, this month's videos delivered against promised, unpaid invoices, and open Genie Assistant insights.",
        input: z.object({ client: z.string().describe("The client's code or name") }),
        run: async (i) => {
          if (!this.can("clients")) return cannot("clients");
          const c = await this.client(i.client as string);
          if (!c) return noClient(String(i.client));
          const month = new Date().toISOString().slice(0, 7);
          const [agreements, cycles, invoices, insights] = await Promise.all([
            this.can("agreements")
              ? this.tenant.db.agreement.findMany({
                  where: { clientId: c.id, status: { in: ["active", "renewal_due", "paused"] } },
                  select: { title: true, monthlyFee: true, endDate: true, status: true },
                })
              : null,
            this.can("production") ? this.cycles.list(month) : null,
            this.can("invoices") ? this.invoices.list({ clientId: c.id, status: "sent" }) : null,
            this.genie.list({ status: "open" }),
          ]);
          const cycle = cycles?.find((x) => x.client.id === c.id);
          cite([{ label: c.name, href: `/app/clients/${c.id}` }]);
          return {
            client: { code: c.code, name: c.name, health: c.health, accountOwner: c.accountOwner?.name ?? null, href: `/app/clients/${c.id}` },
            agreements:
              agreements?.map((a) => ({ title: a.title, monthlyFee: money(a.monthlyFee), ends: a.endDate.toISOString().slice(0, 10), status: a.status })) ??
              "not visible to this role",
            thisMonth: cycle ? { promised: cycle.promised, delivered: cycle.delivered } : cycles ? "no delivery cycle this month" : "not visible to this role",
            unpaidInvoices: invoices
              ? cite(
                  invoices.map((v) => ({
                    number: v.number,
                    total: money(v.total),
                    due: v.dueDate,
                    label: v.number ?? "Invoice",
                    href: `/app/invoices/${v.id}`,
                  })),
                )
              : "not visible to this role",
            openInsights: cite(
              insights
                .filter((x) => x.client?.id === c.id)
                .map((x) => ({ rule: GENIE_RULES[x.rule].label, title: x.title, label: x.title, href: x.link ?? "/app/genie" })),
            ),
          };
        },
      },
      {
        name: "list_invoices",
        description: "Issued invoices this person can see: unpaid, overdue, drafts or paid, optionally for one client.",
        input: z.object({ client: z.string().optional(), status: z.enum(["unpaid", "overdue", "draft", "paid"]).optional() }),
        run: async (i) => {
          if (!this.can("invoices")) return cannot("invoices");
          const client = await this.client(i.client as string | undefined);
          if (i.client && !client) return noClient(String(i.client));
          const status = i.status as string | undefined;
          const rows = await this.invoices.list({
            clientId: client?.id,
            overdue: status === "overdue",
            status: status === "unpaid" ? "sent" : status === "draft" || status === "paid" ? status : undefined,
          });
          return {
            count: rows.length,
            invoices: cite(
              rows.slice(0, 50).map((v) => ({
                number: v.number,
                client: v.client.name,
                total: money(v.total),
                status: v.status,
                due: v.dueDate,
                label: v.number ?? `Draft for ${v.client.name}`,
                href: `/app/invoices/${v.id}`,
              })),
            ),
          };
        },
      },
      {
        name: "list_leads",
        description: "Sales leads this person can see (a role limited to its own leads sees only its own), optionally only those whose follow-up is due.",
        input: z.object({ followUpDue: z.boolean().optional(), query: z.string().optional() }),
        run: async (i) => {
          if (!this.can("crm")) return cannot("sales leads");
          const rows = await this.leads.list({ due: i.followUpDue === true, q: typeof i.query === "string" ? i.query : undefined });
          return {
            count: rows.length,
            leads: cite(
              rows.slice(0, 50).map((l) => ({
                name: l.name,
                company: l.company,
                stage: l.stage,
                nextFollowUp: l.nextFollowUp,
                owner: l.owner?.name ?? null,
                label: l.company ?? l.name,
                href: `/app/sales?lead=${l.id}`,
              })),
            ),
          };
        },
      },
      {
        name: "list_insights",
        description: "What Genie Assistant's rules found that needs a look (stuck videos, clients waiting, overdue invoices…), as this person may see it.",
        input: z.object({ rule: z.enum(Object.keys(GENIE_RULES) as [string, ...string[]]).optional() }),
        run: async (i) => {
          const rows = await this.genie.list({ status: "open", rule: i.rule as string | undefined });
          return {
            count: rows.length,
            insights: cite(
              rows
                .slice(0, 30)
                .map((x) => ({ severity: x.severity, title: x.title, client: x.client?.name ?? null, label: x.title, href: x.link ?? "/app/genie" })),
            ),
          };
        },
      },
    ];
  }

  /** A plain answer from the same tools, for servers without the model. */
  private async standIn(question: string, tools: AskTool[]) {
    const tool = (name: string) => tools.find((t) => t.name === name)!;
    const q = question.toLowerCase();
    const found = (await tool("find_clients").run({})) as { clients?: { code: string; name: string }[] };
    const client = found.clients?.find((c) => q.includes(c.code.toLowerCase()) || q.includes(c.name.toLowerCase().split(" ")[0]!));
    const bullets = (items: { label: string; href: string; extra?: string }[]) =>
      items.map((x) => `- [${x.label}](${x.href})${x.extra ? ` — ${x.extra}` : ""}`).join("\n");
    if (/waiting|approv|with the client/.test(q)) {
      const r = (await tool("list_videos").run({ client: client?.code, waitingOnClient: true })) as {
        videos?: { label: string; href: string; latestVersion: string | null }[];
        error?: string;
      };
      if (r.error) return r.error;
      const who = client ? client.name : "your clients";
      return r.videos!.length
        ? `${r.videos!.length === 1 ? "1 video is" : `${r.videos!.length} videos are`} waiting on ${who}:\n${bullets(r.videos!.map((v) => ({ ...v, extra: v.latestVersion ? `${v.latestVersion} sent` : undefined })))}`
        : `No videos you can see are waiting on ${who}.`;
    }
    if (/invoice|payment|paid|money/.test(q)) {
      // Name what was asked: "any overdue invoices?" is answered about overdue ones, not all unpaid ones.
      const which = /overdue|late/.test(q) ? "overdue" : "unpaid";
      const r = (await tool("list_invoices").run({ client: client?.code, status: which })) as {
        invoices?: { label: string; href: string; total: string }[];
        error?: string;
      };
      if (r.error) return r.error;
      return r.invoices!.length
        ? `${which === "overdue" ? "Overdue" : "Unpaid"} invoices:\n${bullets(r.invoices!.map((v) => ({ ...v, extra: v.total })))}`
        : `No ${which} invoices you can see.`;
    }
    if (/late|overdue|due/.test(q)) {
      const r = (await tool("list_videos").run({ client: client?.code, overdue: true })) as {
        videos?: { label: string; href: string; due: string | null }[];
        error?: string;
      };
      if (r.error) return r.error;
      return r.videos!.length
        ? `Videos past their due date:\n${bullets(r.videos!.map((v) => ({ ...v, extra: v.due ? `due ${v.due}` : undefined })))}`
        : "No videos you can see are past their due date.";
    }
    if (/lead|follow/.test(q)) {
      const r = (await tool("list_leads").run({ followUpDue: true })) as { leads?: { label: string; href: string }[]; error?: string };
      if (r.error) return r.error;
      return r.leads!.length ? `Follow-ups due:\n${bullets(r.leads!)}` : "No follow-ups are due.";
    }
    if (client) {
      const r = (await tool("client_summary").run({ client: client.code })) as { client: { name: string; href: string }; thisMonth: unknown };
      const month = r.thisMonth as { promised?: number; delivered?: number };
      return `[${r.client.name}](${r.client.href})${month.promised !== undefined ? `: ${month.delivered} of ${month.promised} videos delivered this month.` : "."}`;
    }
    const r = (await tool("list_insights").run({})) as { insights: { label: string; href: string }[] };
    return r.insights.length ? `Here is what needs a look:\n${bullets(r.insights)}` : "Nothing has slipped that you can see.";
  }

  // ─── Conversations ──────────────────────────────────────────────────

  private present(c: Prisma.AskConversationGetPayload<{ include: { messages: true } }>): AskConversationRow {
    return {
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt.toISOString(),
      messages: c.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        sources: m.sources as unknown as AskSource[],
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  private async conversation(id: string) {
    const c = await this.tenant.db.askConversation.findFirst({
      where: { id, userId: this.tenant.userId ?? "" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!c) throw new NotFoundException("No conversation with that id.");
    return c;
  }

  async list() {
    const rows = await this.tenant.db.askConversation.findMany({ where: { userId: this.tenant.userId ?? "" }, orderBy: { updatedAt: "desc" }, take: 30 });
    return rows.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }));
  }

  async get(id: string) {
    return this.present(await this.conversation(id));
  }

  async remove(id: string) {
    await this.conversation(id);
    await this.tenant.db.askConversation.delete({ where: { id } });
  }

  async ask(input: AskInput): Promise<AskConversationRow> {
    await this.drafts.gate();
    const earlier = input.conversationId ? await this.conversation(input.conversationId) : null;
    const [me, agency] = await Promise.all([
      this.tenant.db.user.findUniqueOrThrow({ where: { id: this.tenant.userId! }, select: { name: true } }),
      this.tenant.db.agency.findUniqueOrThrow({ where: { id: this.tenant.agencyId }, select: { name: true } }),
    ]);
    const asked = new Date();
    const sources = new Map<string, string>();
    const tools = this.tools(sources);
    const system = [
      `You are Genie Assistant inside ${agency.name}'s agency operating system. You answer questions from ${me.name} (${this.tenant.role?.replace(/_/g, " ") ?? "a team member"}) about the agency's own work.`,
      "Look things up with the tools before answering; they show only what this person may see. If a tool says they cannot see something, tell them so plainly. Never guess or invent records, numbers or names.",
      "Answer briefly in plain words, as a short sentence or a short list. Link every record you mention with the link the tools give, as a markdown link: [KVR-1026-03 · Title](/app/production/…).",
      `Today is ${new Date().toISOString().slice(0, 10)}.`,
    ].join("\n");
    const history = (earlier?.messages ?? []).slice(-HISTORY).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    const { text, usage } = await this.model.ask({
      system,
      messages: [...history, { role: "user", content: input.question }],
      tools,
      standIn: () => this.standIn(input.question, tools),
    });
    // The sources are the records the answer links to.
    const linked: AskSource[] = [];
    for (const m of text.matchAll(LINK)) if (!linked.some((s) => s.href === m[2]) && sources.has(m[2]!)) linked.push({ label: m[1]!, href: m[2]! });
    const id = await this.tenant.tx(async (tx) => {
      const c = earlier
        ? await tx.askConversation.update({ where: { id: earlier.id }, data: { updatedAt: new Date() } })
        : await tx.askConversation.create({ data: { agencyId: this.tenant.agencyId, userId: this.tenant.userId!, title: input.question.slice(0, 80) } });
      await tx.askMessage.createMany({
        data: [
          { agencyId: this.tenant.agencyId, conversationId: c.id, role: "user", content: input.question, createdAt: asked },
          {
            agencyId: this.tenant.agencyId,
            conversationId: c.id,
            role: "assistant",
            content: text,
            sources: linked as unknown as Prisma.InputJsonValue,
            createdAt: new Date(asked.getTime() + 1),
          },
        ],
      });
      await this.drafts.meter(tx, "ask", usage);
      return c.id;
    });
    return this.get(id);
  }
}
