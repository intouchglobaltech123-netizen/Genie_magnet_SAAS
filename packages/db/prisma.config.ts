import { defineConfig } from "prisma/config";

// Migrations run as the schema owner (DATABASE_OWNER_URL). The API and worker never do.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_OWNER_URL ?? process.env.DATABASE_URL ?? "postgresql://genie_owner:genie_owner_dev@localhost:5432/genie",
    // Empty database used by `prisma migrate dev/diff` to replay migrations.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
