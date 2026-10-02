import { randomBytes } from "node:crypto";
import { resolveCname, resolveTxt } from "node:dns/promises";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { asPlatform, Prisma } from "@gm/db";
import type { PortalDomain } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { ENV, type Env } from "../env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

/** DNS lookups, in a class of their own so tests can give the answers. */
@Injectable()
export class DnsLookup {
  txt(name: string): Promise<string[]> {
    return resolveTxt(name).then(
      (r) => r.map((parts) => parts.join("")),
      () => [],
    );
  }

  cname(name: string): Promise<string[]> {
    return resolveCname(name).catch(() => []);
  }
}

/** The DNS record that proves the agency controls the address: `_portal-verify.<address>`. */
export const verifyName = (domain: string) => `_portal-verify.${domain}`;
const verifyValue = (token: string) => `portal-verify=${token}`;

/**
 * The agency's own address for its client portal and questionnaire links (P6-07), e.g. portal.zenstudio.in: the
 * agency adds a CNAME to the platform and a TXT record proving it controls the address; once the TXT record is seen,
 * the links it sends use that address. The certificate for it is issued by the server, which asks `allowed` first.
 */
@Injectable()
export class PortalDomainService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly dns: DnsLookup,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Where the address should point: the platform's own host, unless hosting gives another. */
  target() {
    return (this.env.PORTAL_CNAME_TARGET ?? new URL(this.env.WEB_ORIGIN).hostname).toLowerCase();
  }

  private async row() {
    return this.tenant.db.agency.findUniqueOrThrow({
      where: { id: this.tenant.agencyId },
      select: { portalDomain: true, portalDomainToken: true, portalDomainVerifiedAt: true },
    });
  }

  async get(): Promise<PortalDomain | null> {
    const a = await this.row();
    if (!a.portalDomain || !a.portalDomainToken) return null;
    return {
      domain: a.portalDomain,
      verifiedAt: a.portalDomainVerifiedAt?.toISOString() ?? null,
      records: [
        { type: "CNAME", name: a.portalDomain, value: this.target() },
        { type: "TXT", name: verifyName(a.portalDomain), value: verifyValue(a.portalDomainToken) },
      ],
      pointed: null,
    };
  }

  async set(domain: string) {
    const target = this.target();
    if (domain === target || domain.endsWith(`.${target}`))
      throw new ConflictException({
        message: "Use your own agency's address, not the platform's.",
        issues: [{ path: "domain", message: "Use your own address" }],
      });
    const current = await this.row();
    if (current.portalDomain === domain) return this.get();
    try {
      await this.tenant.tx(async (tx) => {
        await tx.agency.update({
          where: { id: this.tenant.agencyId },
          data: { portalDomain: domain, portalDomainToken: randomBytes(16).toString("hex"), portalDomainVerifiedAt: null },
        });
        await this.audit.record(tx, {
          action: "update",
          entity: "agency",
          entityId: this.tenant.agencyId,
          before: { portalDomain: current.portalDomain },
          after: { portalDomain: domain },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new ConflictException({ message: "Another workspace uses that address.", issues: [{ path: "domain", message: "Already in use" }] });
      throw e;
    }
    return this.get();
  }

  /** Looks for the records now: the TXT record verifies the address; the CNAME is needed before the certificate. */
  async check(): Promise<PortalDomain> {
    const a = await this.row();
    if (!a.portalDomain || !a.portalDomainToken) throw new NotFoundException("Add your portal address first.");
    const [txt, cname] = await Promise.all([this.dns.txt(verifyName(a.portalDomain)), this.dns.cname(a.portalDomain)]);
    const verified = txt.includes(verifyValue(a.portalDomainToken));
    const pointed = cname.some((c) => c.replace(/\.$/, "").toLowerCase() === this.target());
    if (verified && !a.portalDomainVerifiedAt)
      await this.tenant.tx(async (tx) => {
        await tx.agency.update({ where: { id: this.tenant.agencyId }, data: { portalDomainVerifiedAt: new Date() } });
        await this.audit.record(tx, { action: "verify", entity: "agency", entityId: this.tenant.agencyId, after: { portalDomain: a.portalDomain } });
      });
    return { ...(await this.get())!, pointed };
  }

  async remove() {
    const a = await this.row();
    if (!a.portalDomain) return null;
    await this.tenant.tx(async (tx) => {
      await tx.agency.update({ where: { id: this.tenant.agencyId }, data: { portalDomain: null, portalDomainToken: null, portalDomainVerifiedAt: null } });
      await this.audit.record(tx, {
        action: "update",
        entity: "agency",
        entityId: this.tenant.agencyId,
        before: { portalDomain: a.portalDomain },
        after: { portalDomain: null },
      });
    });
    return null;
  }

  /** For the server issuing certificates: is this a verified portal address of some agency? */
  async allowed(domain: string) {
    const n = await asPlatform(this.prisma.client, (tx) =>
      tx.agency.count({ where: { portalDomain: domain.toLowerCase(), portalDomainVerifiedAt: { not: null } } }),
    );
    return n > 0;
  }

  /** The links the agency sends its clients: on its own verified address, or on the platform's. */
  async links() {
    const a = await this.row();
    const own = a.portalDomain && a.portalDomainVerifiedAt ? `https://${a.portalDomain}` : null;
    return {
      portal: (token: string) => (own ? `${own}/c/${token}` : `${this.env.WEB_ORIGIN}/app/c/${token}`),
      questionnaire: (token: string) => (own ? `${own}/q/${token}` : `${this.env.WEB_ORIGIN}/app/q/${token}`),
    };
  }
}
