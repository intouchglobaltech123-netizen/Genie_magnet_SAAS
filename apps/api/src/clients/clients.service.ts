import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@gm/db";
import { type ClientInput, type FitmentQuadrant, scopeOf } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const FITMENT: Record<FitmentQuadrant, "amazing" | "bread_winning" | "convenience" | "dangerous"> = {
  Amazing: "amazing",
  "Bread-winning": "bread_winning",
  Convenience: "convenience",
  Dangerous: "dangerous",
};

@Injectable()
export class ClientsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.tenant.db.client.findMany({
      where: this.tenant.ownOnly("clients", "accountOwnerId"),
      include: { contacts: true },
      orderBy: { name: "asc" },
    });
  }

  async create(input: ClientInput) {
    const agencyId = this.tenant.agencyId;
    try {
      return await this.tenant.tx(async (tx) => {
        const client = await tx.client.create({
          data: {
            agencyId,
            code: input.code,
            name: input.name,
            industry: input.industry,
            city: input.city,
            stage: input.stage ? (input.stage.toLowerCase() as Lowercase<typeof input.stage>) : undefined,
            fitment: input.fitment ? FITMENT[input.fitment] : undefined,
            whatsappGroupUrl: input.whatsappGroupUrl,
            // Someone who may only handle their own clients becomes the account owner of the ones they add.
            accountOwnerId: scopeOf(this.tenant.permissions, "clients") === "own" ? this.tenant.userId : undefined,
            contacts: { create: input.contacts.map((c) => ({ ...c, agencyId })) },
          },
          include: { contacts: true },
        });
        await this.audit.record(tx, { action: "create", entity: "client", entityId: client.id, after: { code: client.code, name: client.name } });
        return client;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException(`Client code ${input.code} is already used in this agency.`);
      }
      throw e;
    }
  }
}
