import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TenantTx } from "@gm/db";
import {
  allows,
  type AreaKey,
  captionDraft,
  DRAFT_FINAL,
  type DraftKind,
  type DraftOutput,
  type DraftRequest,
  type DraftRow,
  draftRequest,
  type IdeasDraft,
  ideasDraft,
  type MonthlyReportData,
  nudgeDraft,
  PLATFORM_LABELS,
  reportSummaryDraft,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { ENV, type Env } from "../env.js";
import { ContentService } from "../production/content.service.js";
import { ReportsService } from "../reports/reports.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { GenieService } from "./genie.service.js";
import { type DraftCall, GENIE_MODEL, type GenieModel, ModelError, type ModelUsage } from "./model.js";

type Request = ReturnType<typeof draftRequest.parse>;
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean).join(", ") : typeof v === "string" ? v : "");

/** Insights about the client's side: a nudge about them goes to the client; any other goes to the colleague who should act. */
const CLIENT_FACING = new Set(["client_waiting", "invoice_overdue", "onboarding_incomplete"]);

/** Who may ask for and decide each kind of draft. */
const NEEDS: Record<DraftKind, { area: AreaKey; level: "edit" }> = {
  nudge: { area: "clients", level: "edit" },
  caption: { area: "publishing", level: "edit" },
  ideas: { area: "content", level: "edit" },
  report_summary: { area: "clients", level: "edit" },
};

/** The rules every draft follows (ADR 0008): it is a draft for a person, in the client's voice, with no invented facts. */
const HOUSE_RULES = [
  "You are Genie Assistant, inside a digital-marketing agency's operating system in India.",
  "You write drafts that a person at the agency reads, edits and approves before anything is sent or published.",
  "Use only the facts given. Never invent numbers, prices, dates, offers or claims. If something is missing, leave it out.",
  "Follow the client's tone of voice, their do's and don'ts, and their content languages when given.",
  "Write naturally for Indian audiences; keep Tamil, Tanglish or other languages as the client uses them.",
].join("\n");

/** Rough share of words changed between the draft and what was approved, 0 to 100. */
export function editedPct(before: string, after: string) {
  const a = before.toLowerCase().split(/\s+/).filter(Boolean);
  const b = after.toLowerCase().split(/\s+/).filter(Boolean);
  if (!a.length && !b.length) return 0;
  const dp: number[] = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const keep = dp[j]!;
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j]!, dp[j - 1]!);
      prev = keep;
    }
  }
  return Math.round((1 - (2 * dp[b.length]!) / (a.length + b.length)) * 100);
}

const textOf = (kind: DraftKind, o: DraftOutput): string => {
  switch (kind) {
    case "nudge":
      return (o as { message: string }).message;
    case "caption": {
      const c = o as { caption: string; hashtags: string[]; thumbnailText: string };
      return [c.caption, c.hashtags.join(" "), c.thumbnailText].join("\n");
    }
    case "ideas":
      return (o as IdeasDraft).ideas.map((i) => `${i.title} ${i.pillar} ${i.format} ${i.why}`).join("\n");
    case "report_summary":
      return (o as { note: string }).note;
  }
};

/**
 * Genie Assistant's drafts (P4-05 to P4-07): a WhatsApp nudge to a client, a caption for an approved video, content
 * ideas for a month, a monthly report's summary. Each is written from the record it is for, the client's brand voice
 * from onboarding and their past approved work; checked against the agency's switch and monthly budget first; metered;
 * and only takes effect when a person approves it, as written or edited.
 */
@Injectable()
export class DraftsService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(GENIE_MODEL) private readonly model: GenieModel,
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly genie: GenieService,
    private readonly content: ContentService,
    private readonly reports: ReportsService,
  ) {}

  private need(kind: DraftKind) {
    const n = NEEDS[kind];
    if (!allows(this.tenant.permissions, n.area, n.level)) throw new ForbiddenException("Your role cannot work on this kind of draft.");
  }

  /** What a call cost the agency, in paise. */
  private cost(u: ModelUsage) {
    const usd =
      ((u.inputTokens + u.cacheWriteTokens * 1.25 + u.cacheReadTokens * 0.1) * this.env.AI_INPUT_USD_PER_MTOK +
        u.outputTokens * this.env.AI_OUTPUT_USD_PER_MTOK) /
      1e6;
    return Math.round(usd * this.env.AI_USD_TO_INR * 100);
  }

  /** The agency switched drafting on, the server has a model, and this month's budget is not used up. */
  private async gate() {
    const s = await this.genie.settings();
    if (this.model.kind === "off") throw new ConflictException("Genie Assistant's drafting is not switched on for this server yet — write this one yourself.");
    if (!s.ai.enabled) throw new ConflictException("Switch drafting on in Settings → Genie Assistant first.");
    if (s.ai.spentThisMonth >= s.ai.monthlyBudget)
      throw new ConflictException(
        `This month's AI budget (₹${s.ai.monthlyBudget.toLocaleString("en-IN")}) is used up — raise it in Settings → Genie Assistant, or write this one yourself.`,
      );
  }

  /** The client's tone of voice, do's and don'ts and languages from their onboarding. */
  private async voice(clientId: string) {
    const answers = await this.tenant.db.answer.findMany({
      where: { questionKey: { in: ["c29b", "c29c", "c30"] }, response: { clientId } },
      select: { questionKey: true, value: true },
      orderBy: { answeredAt: "desc" },
    });
    const of = (k: string) => list(answers.find((a) => a.questionKey === k)?.value);
    return [
      of("c29b") && `Tone of voice: ${of("c29b")}`,
      of("c29c") && `Do's and don'ts: ${of("c29c")}`,
      of("c30") && `Content languages: ${of("c30")}`,
    ].filter(Boolean) as string[];
  }

  // ─── Drafting ───────────────────────────────────────────────────────

  async create(input: DraftRequest) {
    const req = draftRequest.parse(input);
    this.need(req.kind);
    await this.gate();
    const built = await this.build(req);
    const { output, usage } = await this.model.draft(built.call as DraftCall<DraftOutput>);
    const id = await this.tenant.tx(async (tx) => {
      await tx.aiUsage.create({
        data: {
          agencyId: this.tenant.agencyId,
          feature: req.kind,
          userId: this.tenant.userId,
          model: this.model.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          costPaise: this.cost(usage),
        },
      });
      const d = await tx.draft.create({
        data: {
          agencyId: this.tenant.agencyId,
          kind: req.kind,
          entity: built.entity,
          entityId: built.entityId,
          clientId: built.clientId,
          request: (built.request ?? { ...req }) as Prisma.InputJsonValue,
          context: `${built.call.context}\n\n${built.call.task}`,
          output: output as unknown as Prisma.InputJsonValue,
          source: this.model.kind === "claude" ? "claude" : "stand-in",
          model: this.model.model,
          createdBy: this.tenant.userId,
        },
      });
      return d.id;
    });
    return this.get(id);
  }

  private async build(req: Request): Promise<{ entity: string; entityId: string; clientId: string | null; request?: object; call: DraftCall<unknown> }> {
    const agency = await this.tenant.db.agency.findUniqueOrThrow({ where: { id: this.tenant.agencyId }, select: { name: true } });
    switch (req.kind) {
      case "nudge": {
        const insight = req.insightId ? await this.genie.find(req.insightId) : null;
        const clientId = req.clientId ?? insight?.clientId ?? null;
        if (!insight && !clientId) throw new BadRequestException("Say which client or insight the nudge is about.");
        if (insight && req.clientId && insight.clientId && insight.clientId !== req.clientId)
          throw new BadRequestException("That insight is about another client.");
        const about = [insight?.title, insight?.body, req.notes].filter(Boolean).join("\n") || "A friendly check-in about their work with us.";
        const me = this.tenant.userId ? await this.tenant.db.user.findUnique({ where: { id: this.tenant.userId }, select: { name: true } }) : null;

        // About the client's side (or no insight): to the client's contact. About the team's own work: to whoever should act.
        if (req.contactId || !insight || CLIENT_FACING.has(insight.rule)) {
          const client = clientId
            ? await this.tenant.db.client.findFirst({
                where: { id: clientId },
                select: { id: true, name: true, contacts: { select: { id: true, name: true, approver: true }, orderBy: { name: "asc" } } },
              })
            : null;
          if (!client) throw new NotFoundException("No client with that id.");
          const contact =
            (req.contactId ? client.contacts.find((c) => c.id === req.contactId) : undefined) ?? client.contacts.find((c) => c.approver) ?? client.contacts[0];
          if (!contact) throw new BadRequestException("The client has no contact to send it to.");
          return {
            entity: insight ? "insight" : "client",
            entityId: insight?.id ?? client.id,
            clientId: client.id,
            request: { ...req, to: { kind: "client", contactId: contact.id, name: contact.name } },
            call: {
              system: `${HOUSE_RULES}\nNow you write short WhatsApp messages from the agency to a client contact: warm, polite, clear about what is needed, at most 3 short sentences, no hashtags, at most one emoji.`,
              context: [`Agency: ${agency.name}`, `Client: ${client.name}`, ...(await this.voice(client.id))].join("\n"),
              task: `Write a WhatsApp message to ${contact.name} (address them as ${first(contact.name)}) about:\n${about}\nReturn it as "message".`,
              schema: nudgeDraft,
              effort: "low",
              maxTokens: 4000,
              standIn: () => ({
                message: `Hello ${first(contact.name)}, a gentle reminder from ${agency.name}: ${insight?.title ?? req.notes ?? "we would love your inputs"}. Could you take a look when you have a moment? Thank you!`,
              }),
            },
          };
        }
        const teammate = insight.ownerId ? await this.tenant.db.user.findUnique({ where: { id: insight.ownerId }, select: { id: true, name: true } }) : null;
        const to = teammate?.name ?? "the team";
        return {
          entity: "insight",
          entityId: insight.id,
          clientId,
          request: { ...req, to: { kind: "team", userId: teammate?.id ?? null, name: to } },
          call: {
            system: `${HOUSE_RULES}\nNow you write short WhatsApp messages between colleagues at the agency: friendly and direct, say what is needed and by when if known, offer help, at most 3 short sentences, no hashtags.`,
            context: `Agency: ${agency.name}`,
            task: `Write a WhatsApp message from ${me?.name ?? "the team leader"} to ${to}${teammate ? ` (address them as ${first(teammate.name)})` : ""} about:\n${about}\nReturn it as "message".`,
            schema: nudgeDraft,
            effort: "low",
            maxTokens: 4000,
            standIn: () => ({
              message: `Hi ${teammate ? first(teammate.name) : "team"}, a quick one: ${insight.title}. Can you take a look today? Tell me if anything is holding it up.`,
            }),
          },
        };
      }
      case "caption": {
        const v = await this.tenant.db.video.findFirst({
          where: { id: req.videoId },
          select: {
            id: true,
            code: true,
            title: true,
            format: true,
            stage: true,
            platforms: true,
            client: { select: { id: true, name: true, pillars: true } },
            contentItemId: true,
          },
        });
        if (!v) throw new NotFoundException("No video with that id.");
        if (v.stage !== "approved" && v.stage !== "published") throw new ConflictException("Captions are drafted for videos the client approved.");
        const [script, past] = await Promise.all([
          v.contentItemId
            ? this.tenant.db.scriptVersion.findFirst({
                where: { contentItemId: v.contentItemId, status: "approved" },
                orderBy: { number: "desc" },
                select: { hook: true, body: true, cta: true },
              })
            : null,
          this.tenant.db.scheduledPost.findMany({
            where: { video: { clientId: v.client.id }, caption: { not: null }, status: "published" },
            orderBy: { publishedAt: "desc" },
            take: 5,
            select: { caption: true },
          }),
        ]);
        const platform = req.platform ? (PLATFORM_LABELS[req.platform as keyof typeof PLATFORM_LABELS] ?? req.platform) : null;
        return {
          entity: "video",
          entityId: v.id,
          clientId: v.client.id,
          call: {
            system: `${HOUSE_RULES}\nNow you write social media captions for a client's approved video: a hook in the first line, the value, a clear call to action; 5 to 12 relevant hashtags without spaces; and a short thumbnail text (at most 6 words).`,
            context: [
              `Agency: ${agency.name}`,
              `Client: ${v.client.name}`,
              ...(await this.voice(v.client.id)),
              v.client.pillars.length ? `Content pillars: ${v.client.pillars.join(", ")}` : "",
              past.length ? `Captions the client approved before (match their style):\n${past.map((p) => `- ${p.caption}`).join("\n")}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            task: [
              `Video ${v.code}: “${v.title}” (${v.format}).`,
              script ? `Its approved script — hook: ${script.hook}\nbody: ${script.body}\ncall to action: ${script.cta}` : "",
              platform ? `It is for ${platform}.` : v.platforms.length ? `It goes on: ${v.platforms.join(", ")}.` : "",
              req.notes ? `The team asks: ${req.notes}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            schema: captionDraft,
            effort: "medium",
            maxTokens: 6000,
            standIn: () => ({
              caption: [script?.hook ?? v.title, script?.cta ?? `Follow ${v.client.name} for more.`].join("\n\n"),
              hashtags: [v.client.name, ...v.client.pillars].map((t) => `#${t.replace(/[^\p{L}\p{N}]+/gu, "")}`).slice(0, 6),
              thumbnailText: v.title.split(/\s+/).slice(0, 5).join(" "),
            }),
          },
        };
      }
      case "ideas": {
        const client = await this.tenant.db.client.findFirst({ where: { id: req.clientId }, select: { id: true, name: true, pillars: true, industry: true } });
        if (!client) throw new NotFoundException("No client with that id.");
        const past = await this.tenant.db.contentItem.findMany({
          where: { clientId: client.id },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { title: true },
        });
        const pillars = client.pillars.length ? client.pillars : ["Products", "Behind the scenes", "Customer stories"];
        return {
          entity: "client",
          entityId: client.id,
          clientId: client.id,
          call: {
            system: `${HOUSE_RULES}\nNow you suggest short-video content ideas for a client's month: specific, filmable in a day, each tied to one of their content pillars, with a one-line reason it will work.`,
            context: [
              `Agency: ${agency.name}`,
              `Client: ${client.name}${client.industry ? ` (${client.industry})` : ""}`,
              ...(await this.voice(client.id)),
              `Content pillars: ${pillars.join(", ")}`,
              past.length ? `Ideas they already have (do not repeat):\n${past.map((p) => `- ${p.title}`).join("\n")}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            task: `Suggest ${req.count} ideas for ${monthName(req.month)}. Formats: Reel, Short, Carousel, Long video.${req.notes ? `\nThe team asks: ${req.notes}` : ""}`,
            schema: ideasDraft,
            effort: "medium",
            maxTokens: 8000,
            standIn: () => ({
              ideas: Array.from({ length: req.count }, (_, i) => ({
                title: `${pillars[i % pillars.length]}: idea ${i + 1} for ${monthName(req.month)}`,
                pillar: pillars[i % pillars.length]!,
                format: "Reel",
                why: `Keeps ${client.name}'s ${pillars[i % pillars.length]!.toLowerCase()} pillar going.`,
              })),
            }),
          },
        };
      }
      case "report_summary": {
        const r = await this.tenant.db.monthlyReport.findFirst({ where: { id: req.reportId }, select: { id: true, status: true, data: true, clientId: true } });
        if (!r) throw new NotFoundException("No report with that id.");
        if (r.status === "released") throw new ConflictException("A released report stays as it was released.");
        const d = r.data as unknown as MonthlyReportData;
        const best = [...d.videos.flatMap((v) => v.posts.map((p) => ({ title: v.title, views: p.metrics?.views ?? 0 })))].sort((a, b) => b.views - a.views)[0];
        const facts = [
          `Month: ${monthName(d.month)}`,
          `Videos promised: ${d.promised}; delivered: ${d.delivered}`,
          `Posts: ${d.totals.posts}; views: ${d.totals.views}; reach: ${d.totals.reach}; likes: ${d.totals.likes}; comments: ${d.totals.comments}; shares: ${d.totals.shares}; saves: ${d.totals.saves}`,
          best && best.views ? `Best post: “${best.title}” with ${best.views} views` : "",
          d.nextMonth.length ? `Next month's picked topics: ${d.nextMonth.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        return {
          entity: "report",
          entityId: r.id,
          clientId: r.clientId,
          call: {
            system: `${HOUSE_RULES}\nNow you write the agency's note at the top of a client's monthly report: 3 to 5 sentences, what went well with the real numbers, what is short and why if known, and what comes next. Plain words, no hype.`,
            context: [`Agency: ${agency.name}`, `Client: ${d.client.name}`, ...(await this.voice(r.clientId))].join("\n"),
            task: `The month's facts:\n${facts}${req.notes ? `\nThe team asks: ${req.notes}` : ""}\nReturn it as "note".`,
            schema: reportSummaryDraft,
            effort: "medium",
            maxTokens: 6000,
            standIn: () => ({
              note: `In ${monthName(d.month)} we delivered ${d.delivered} of ${d.promised} videos and ${d.totals.posts} posts, reaching ${d.totals.views.toLocaleString("en-IN")} views.${best && best.views ? ` “${best.title}” did best.` : ""}${d.nextMonth.length ? ` Next month: ${d.nextMonth.slice(0, 3).join(", ")}.` : ""}`,
            }),
          },
        };
      }
    }
  }

  // ─── Deciding ───────────────────────────────────────────────────────

  private async find(id: string) {
    const d = await this.tenant.db.draft.findFirst({ where: { id } });
    if (!d) throw new NotFoundException("No draft with that id.");
    return d;
  }

  private async present(rows: Prisma.DraftGetPayload<object>[]): Promise<DraftRow[]> {
    const [clients, people] = await Promise.all([
      this.tenant.db.client.findMany({ where: { id: { in: rows.map((r) => r.clientId).filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
      this.tenant.db.user.findMany({ where: { id: { in: rows.map((r) => r.createdBy).filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
    ]);
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as DraftKind,
      status: r.status as DraftRow["status"],
      entity: r.entity,
      entityId: r.entityId,
      client: clients.find((c) => c.id === r.clientId) ?? null,
      output: r.output as unknown as DraftOutput,
      final: (r.final as unknown as DraftOutput | null) ?? null,
      editedPct: r.editedPct,
      source: r.source as DraftRow["source"],
      createdBy: r.createdBy ? { id: r.createdBy, name: people.find((p) => p.id === r.createdBy)?.name ?? null } : null,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
    }));
  }

  async get(id: string) {
    const d = await this.find(id);
    this.need(d.kind as DraftKind);
    return (await this.present([d]))[0]!;
  }

  /** Drafts for one record (a video's captions, an insight's nudges…), newest first. */
  async list(entity: string, entityId: string) {
    const rows = await this.tenant.db.draft.findMany({ where: { entity, entityId }, orderBy: { createdAt: "desc" }, take: 20 });
    return this.present(rows.filter((r) => allows(this.tenant.permissions, NEEDS[r.kind as DraftKind].area, "edit")));
  }

  /**
   * Approved (as written or edited) or rejected. Approving puts it to use: a nudge comes back with its WhatsApp link
   * to send, a caption goes on the video's posts still to go out, picked ideas join the idea bank, a summary becomes
   * the report's note.
   */
  async decide(id: string, input: { status: "approved" | "rejected"; final?: Record<string, unknown> }) {
    const d = await this.find(id);
    const kind = d.kind as DraftKind;
    this.need(kind);
    if (d.status !== "draft") throw new ConflictException("This draft is already decided.");
    if (input.status === "rejected") {
      await this.tenant.tx(async (tx) => {
        await tx.draft.update({ where: { id }, data: { status: "rejected", decidedBy: this.tenant.userId, decidedAt: new Date() } });
        await this.audit.record(tx, { action: "reject", entity: "draft", entityId: id, after: { kind } });
      });
      return { draft: await this.get(id) };
    }
    const parsed = DRAFT_FINAL[kind].safeParse(input.final ?? d.output);
    if (!parsed.success)
      throw new BadRequestException({
        message: "Some of the draft needs fixing before it is approved.",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    const final = parsed.data as DraftOutput;
    const pct = editedPct(textOf(kind, d.output as unknown as DraftOutput), textOf(kind, final));
    // Effects that go through other services come first, so a draft is approved only once they worked.
    if (kind === "ideas") {
      const req = d.request as { month: string };
      for (const idea of (final as IdeasDraft).ideas)
        await this.content.create({
          clientId: d.clientId!,
          title: idea.title,
          pillar: idea.pillar,
          format: idea.format || "Reel",
          source: "Genie Assistant",
          month: req.month,
          notes: idea.why,
        });
    }
    if (kind === "report_summary") await this.reports.setNote(d.entityId, (final as { note: string }).note);
    const effect = await this.tenant.tx(async (tx) => {
      await tx.draft.update({
        where: { id },
        data: { status: "approved", final: final as unknown as Prisma.InputJsonValue, editedPct: pct, decidedBy: this.tenant.userId, decidedAt: new Date() },
      });
      await this.audit.record(tx, { action: "approve", entity: "draft", entityId: id, after: { kind, editedPct: pct, ...(pct > 0 && { final }) } });
      return this.apply(tx, d, final);
    });
    return { draft: await this.get(id), ...effect };
  }

  private async apply(tx: TenantTx, d: Prisma.DraftGetPayload<object>, final: DraftOutput) {
    switch (d.kind as DraftKind) {
      case "nudge": {
        // To a client contact, their number; to a colleague, WhatsApp asks which chat.
        const to = (d.request as { to?: { kind: string; contactId?: string } }).to;
        const contact = to?.kind === "client" && to.contactId ? await tx.contact.findFirst({ where: { id: to.contactId }, select: { phone: true } }) : null;
        const digits = contact?.phone.replace(/\D/g, "") ?? "";
        const phone = digits.length === 10 ? `91${digits}` : digits;
        return { whatsappLink: `https://wa.me/${phone}?text=${encodeURIComponent((final as { message: string }).message)}` };
      }
      case "caption": {
        const c = final as { caption: string; hashtags: string[] };
        const text = [c.caption, c.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")].filter(Boolean).join("\n\n");
        const updated = await tx.scheduledPost.updateMany({ where: { videoId: d.entityId, status: "scheduled" }, data: { caption: text } });
        return { postsUpdated: updated.count };
      }
      default:
        return {};
    }
  }
}
