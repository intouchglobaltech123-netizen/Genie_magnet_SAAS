import { ConflictException, Injectable } from "@nestjs/common";
import { clientInput, leadInput, type SampleData, type SampleRemoved, videoInput } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { PlanService } from "../billing/plan.service.js";
import { ClientsService } from "../clients/clients.service.js";
import { LeadsService } from "../crm/leads.service.js";
import { PipelineService } from "../crm/pipeline.service.js";
import { ProductionSettingsService } from "../production/production-settings.service.js";
import { VideosService } from "../production/videos.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const DAY = 86_400_000;
const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const plusDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);

// Invented businesses. Emails use the reserved .test domain, so nothing can be emailed; phone numbers start with 0
// after +91, which no Indian mobile does, so no WhatsApp message can ever reach anyone.
const CLIENTS = [
  {
    name: "Sunrise Bakery (sample)",
    codes: ["SRB", "SNB", "SUN"],
    industry: "Food & beverage",
    city: "Chennai",
    contact: { name: "Meena Raghavan", title: "Owner", email: "meena@sunrisebakery.test", phone: "+91 00000 00001" },
  },
  {
    name: "Peak Fitness Studio (sample)",
    codes: ["PFS", "PKF", "PEK"],
    industry: "Fitness",
    city: "Coimbatore",
    contact: { name: "Vikram Das", title: "Founder", email: "vikram@peakfitness.test", phone: "+91 00000 00002" },
  },
  {
    name: "Lotus Interiors (sample)",
    codes: ["LTI", "LOT", "LTS"],
    industry: "Interiors",
    city: "Madurai",
    contact: { name: "Shalini Prakash", title: "Director", email: "shalini@lotusinteriors.test", phone: "+91 00000 00003" },
  },
];
const LEADS = [
  { name: "Arjun Krishnan", company: "Green Leaf Cafe (sample)", email: "arjun@greenleaf.test", source: "Instagram", value: 30000 },
  { name: "Divya Menon", company: "Bloom Salon (sample)", email: "divya@bloomsalon.test", source: "Referral", value: 45000 },
  { name: "Karthik Rao", company: "Urban Threads (sample)", email: "karthik@urbanthreads.test", source: "Website", value: 60000 },
  { name: "Nisha Varma", company: "Spice Route Foods (sample)", email: "nisha@spiceroute.test", source: "Event", value: 80000 },
];
const VIDEOS = [
  { title: "Morning bake: behind the scenes", days: 3 },
  { title: "Customer favourite: filter coffee cake", days: 6 },
  { title: "Festive menu announcement", days: 10 },
  { title: "Meet the baker", days: 14 },
];

/**
 * Sample data to try the workspace with (P6-06): three clients with a contact each, four leads along the pipeline and
 * four videos for the first client, all marked "(sample)" and made through the same services as real ones. Everything
 * is remembered, so it can be removed in one go — with whatever the team made for those clients since — by
 * `app_remove_sample` (migration 20261201000000_sample_data).
 */
@Injectable()
export class SampleService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly plans: PlanService,
    private readonly clients: ClientsService,
    private readonly leads: LeadsService,
    private readonly pipeline: PipelineService,
    private readonly videos: VideosService,
    private readonly production: ProductionSettingsService,
  ) {}

  async status(): Promise<SampleData | null> {
    const s = await this.tenant.db.sampleData.findFirst({ where: { removedAt: null } });
    if (!s) return null;
    const by = s.addedBy ? await this.tenant.db.user.findUnique({ where: { id: s.addedBy }, select: { name: true } }) : null;
    return {
      clients: s.clientIds.length,
      leads: s.leadIds.length,
      videos: s.videoIds.length,
      addedAt: s.addedAt.toISOString(),
      addedBy: { id: s.addedBy ?? "", name: by?.name ?? null },
    };
  }

  async add(): Promise<SampleData> {
    if (await this.status()) throw new ConflictException("The sample data is already here.");
    await this.plans.assertRoom("clients", CLIENTS.length);
    const taken = new Set((await this.tenant.db.client.findMany({ select: { code: true } })).map((c) => c.code));
    const stages = (await this.pipeline.stages()).filter((s) => s.kind === "open");
    const format = (await this.production.get()).formats[0]?.name ?? "Reel";
    const made = { clientIds: [] as string[], leadIds: [] as string[], videoIds: [] as string[] };
    try {
      for (const c of CLIENTS) {
        const code = c.codes.find((x) => !taken.has(x));
        if (!code) continue;
        taken.add(code);
        const client = await this.clients.create(
          clientInput.parse({ name: c.name, code, industry: c.industry, city: c.city, contacts: [{ ...c.contact, approver: true }] }),
        );
        made.clientIds.push(client.id);
      }
      for (const [i, l] of LEADS.entries()) {
        const stage = stages[Math.min(i, stages.length - 1)]?.key;
        const lead = await this.leads.create({ ...leadInput.parse({ ...l, stage, nextFollowUp: plusDays(istToday(), i + 1) }), value: l.value });
        made.leadIds.push(lead.id);
      }
      const first = made.clientIds[0];
      if (first)
        for (const v of VIDEOS) {
          const video = await this.videos.create(videoInput.parse({ clientId: first, title: v.title, format, dueDate: plusDays(istToday(), v.days) }));
          made.videoIds.push(video.id);
        }
    } finally {
      // Whatever was made is remembered, even if something failed half-way, so it can still be removed.
      if (made.clientIds.length || made.leadIds.length || made.videoIds.length)
        await this.tenant.tx(async (tx) => {
          const data = { ...made, addedBy: this.tenant.userId ?? null, addedAt: new Date(), removedAt: null, removedBy: null };
          await tx.sampleData.upsert({ where: { agencyId: this.tenant.agencyId }, create: { agencyId: this.tenant.agencyId, ...data }, update: data });
          await this.audit.record(tx, {
            action: "create",
            entity: "sample_data",
            entityId: this.tenant.agencyId,
            after: { clients: made.clientIds.length, leads: made.leadIds.length, videos: made.videoIds.length },
          });
        });
    }
    return (await this.status())!;
  }

  async remove(): Promise<SampleRemoved> {
    const s = await this.tenant.db.sampleData.findFirst({ where: { removedAt: null } });
    if (!s) throw new ConflictException("There is no sample data to remove.");
    return this.tenant.tx(async (tx) => {
      const kept = (await tx.$queryRaw<{ kept: string[] }[]>`SELECT app_remove_sample() AS kept`)[0]?.kept ?? [];
      await tx.sampleData.update({ where: { agencyId: this.tenant.agencyId }, data: { removedAt: new Date(), removedBy: this.tenant.userId ?? null } });
      const removed = { clients: s.clientIds.length - kept.length, leads: s.leadIds.length, videos: s.videoIds.length, kept };
      await this.audit.record(tx, { action: "delete", entity: "sample_data", entityId: this.tenant.agencyId, before: removed });
      return removed;
    });
  }
}
