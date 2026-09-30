import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { createPrisma } from "@gm/db";
import { ENV, type Env } from "../env.js";

/** One connection pool per process, as the genie_app role. Queries go through TenantDb, never directly. */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: ReturnType<typeof createPrisma>;

  constructor(@Inject(ENV) env: Env) {
    this.client = createPrisma(env.DATABASE_URL);
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
