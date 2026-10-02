import { Injectable } from "@nestjs/common";
import { asPlatform, type Prisma } from "@gm/db";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings, platformSettingsInput } from "@gm/shared";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * The platform's own settings (ADR 0011): the brand, the trial, the grace period, the plans and our invoice details.
 * Read on every request through a short cache; anyone may read them, only the platform's transactions change them.
 */
@Injectable()
export class PlatformSettingsService {
  private cached: { at: number; value: PlatformSettings } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<PlatformSettings> {
    if (this.cached && Date.now() - this.cached.at < 30_000) return this.cached.value;
    const row = await this.prisma.client.platformSettings.findUnique({ where: { id: 1 } });
    const parsed = row ? platformSettingsInput.safeParse(row.data) : null;
    const value = parsed?.success ? parsed.data : DEFAULT_PLATFORM_SETTINGS;
    this.cached = { at: Date.now(), value };
    return value;
  }

  async save(input: unknown, by: string | null) {
    const s = platformSettingsInput.parse(input);
    const data = s as unknown as Prisma.InputJsonValue;
    await asPlatform(this.prisma.client, (tx) =>
      tx.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, data, updatedBy: by }, update: { data, updatedBy: by } }),
    );
    this.cached = null;
    return this.get();
  }
}
