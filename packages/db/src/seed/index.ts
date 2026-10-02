import { createHash } from "node:crypto";
import { packageTotals } from "@gm/shared";
import type { PrismaClient } from "../generated/prisma/client.js";
import { setUpAgencyDefaults } from "../defaults.js";
import { withAgency } from "../tenancy.js";
import { type SeedAgency, sampleAgencies } from "./data.js";

export { genieMagnet, sampleAgencies, type SeedAgency, zenStudio } from "./data.js";

/** Stable user id per email, so a person seeded into two agencies is one user and a re-run finds them again. */
export function seedUserId(email: string) {
  const h = createHash("sha256").update(`genie-seed:${email}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export interface SeedResult {
  agency: string;
  created: boolean;
}

/**
 * Creates the sample agencies with their people, packages, clients, agreements and leads (P1-02).
 * Runs as the schema owner. Every write sets the agency (and, for a person, the user) first, so it also
 * works where the owner is not a superuser and row-level security applies to it.
 * Seeded people have no password: on test servers they sign in with test sign-in (TEST_SIGN_IN in the API).
 * An agency that already exists is left as it is (it only gets default roles and stages it is missing), so running it again is safe.
 */
export async function seedSampleData(prisma: PrismaClient, agencies: SeedAgency[] = sampleAgencies): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  for (const a of agencies) {
    const exists = await withAgency(prisma, a.id, (tx) => tx.agency.findUnique({ where: { id: a.id }, select: { id: true } }));
    if (exists) {
      await withAgency(prisma, a.id, (tx) => setUpAgencyDefaults(tx, a.id));
      results.push({ agency: a.name, created: false });
      continue;
    }

    // People first. Until it has a membership, a user row is visible only to itself, hence the user id per write.
    const userIds = new Map<string, string>();
    for (const p of a.people) {
      const id = seedUserId(p.email);
      const user = await withAgency(
        prisma,
        a.id,
        (tx) =>
          tx.user.upsert({ where: { email: p.email }, create: { id, email: p.email, name: p.name, emailVerified: true }, update: {}, select: { id: true } }),
        id,
      );
      userIds.set(p.email, user.id);
    }
    const userId = (email: string) => {
      const id = userIds.get(email);
      if (!id) throw new Error(`Seed data for ${a.name}: ${email} is not one of its people.`);
      return id;
    };

    await withAgency(prisma, a.id, async (tx) => {
      await tx.agency.create({ data: { id: a.id, name: a.name, slug: a.slug, plan: a.plan, ...a.profile } });
      await setUpAgencyDefaults(tx, a.id);
      if (a.invoiceSettings) await tx.invoiceSettings.create({ data: { agencyId: a.id, ...a.invoiceSettings } });
      await tx.membership.createMany({ data: a.people.map((p) => ({ agencyId: a.id, userId: userId(p.email), role: p.role, title: p.title })) });

      const packages = new Map<string, string>();
      for (const pkg of a.packages) {
        const created = await tx.package.create({ data: { agencyId: a.id, ...pkg, ...packageTotals(pkg.deliverables) }, select: { id: true } });
        packages.set(pkg.name, created.id);
      }

      for (const c of a.clients) {
        const client = await tx.client.create({
          data: {
            agencyId: a.id,
            code: c.code,
            name: c.name,
            industry: c.industry,
            city: c.city,
            fitment: c.fitment,
            health: c.health,
            accountOwnerId: userId(c.owner),
            legalName: c.billing?.legalName,
            gstin: c.billing?.gstin,
            state: c.billing?.state,
            billingAddress: c.billing?.address,
            contacts: { create: c.contacts.map((contact) => ({ agencyId: a.id, ...contact })) },
          },
          select: { id: true },
        });
        if (c.agreement) {
          const { packageName, startDate, endDate, ...terms } = c.agreement;
          const pkg = a.packages.find((p) => p.name === packageName);
          await tx.agreement.create({
            data: {
              agencyId: a.id,
              clientId: client.id,
              packageId: packages.get(packageName),
              startDate: new Date(startDate),
              endDate: new Date(endDate),
              ...terms,
              // The package's deliverables are the agreement's monthly quotas.
              deliverables: pkg?.deliverables ?? [],
              shootDays: pkg?.shootDays ?? 0,
              platforms: pkg?.platforms ?? [],
              signedAt: new Date(startDate),
            },
          });
        }
      }

      await tx.lead.createMany({
        data: a.leads.map(({ owner, nextFollowUp, ...lead }) => ({ agencyId: a.id, ...lead, ownerId: userId(owner), nextFollowUp: new Date(nextFollowUp) })),
      });

      await tx.auditLog.create({
        data: {
          agencyId: a.id,
          action: "seed",
          entity: "agency",
          entityId: a.id,
          after: { sampleData: true, people: a.people.length, packages: a.packages.length, clients: a.clients.length, leads: a.leads.length },
        },
      });
    });
    results.push({ agency: a.name, created: true });
  }
  return results;
}
