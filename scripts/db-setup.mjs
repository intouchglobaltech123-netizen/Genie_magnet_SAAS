// npm run db:setup — prepares a server's database before each deploy (Railway runs it as the pre-deploy step):
//   1. the app's own database roles, with no way around row-level security: genie_app (the API and its jobs) and
//      genie_auth (sign-in only), with the passwords in APP_DB_PASSWORD and AUTH_DB_PASSWORD;
//   2. the migrations, as the schema owner (DATABASE_OWNER_URL);
//   3. on a staging server only (SEED_SAMPLE_DATA=true), the sample agencies for testing with test sign-in.
// Safe to run every time. It never seeds a server marked APP_ENV=production.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (message) => {
  console.error(`db:setup — ${message}`);
  process.exit(1);
};

const ownerUrl = process.env.DATABASE_OWNER_URL;
if (!ownerUrl) fail("DATABASE_OWNER_URL is not set (the database's owner, e.g. Railway's DATABASE_URL for its Postgres).");
const roles = [
  ["genie_app", process.env.APP_DB_PASSWORD],
  ["genie_auth", process.env.AUTH_DB_PASSWORD],
];
for (const [role, password] of roles) if (!password || password.length < 16) fail(`${role === "genie_app" ? "APP" : "AUTH"}_DB_PASSWORD must be at least 16 characters.`);
const seed = process.env.SEED_SAMPLE_DATA === "true";
if (seed && process.env.APP_ENV === "production") fail("SEED_SAMPLE_DATA is refused on a server marked APP_ENV=production.");

// 1. Roles first: the migrations grant them their tables only when they exist.
const admin = new pg.Client({ connectionString: ownerUrl });
await admin.connect();
for (const [role, password] of roles) {
  const exists = (await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role])).rowCount > 0;
  const literal = (await admin.query("SELECT quote_literal($1) AS q", [password])).rows[0].q;
  await admin.query(`${exists ? "ALTER" : "CREATE"} ROLE ${role} LOGIN PASSWORD ${literal} NOSUPERUSER NOBYPASSRLS`);
  console.log(`· role ${role} ${exists ? "up to date" : "created"}`);
}
await admin.end();

// 2. Migrations.
const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: join(root, "packages/db"),
  env: { ...process.env, DATABASE_OWNER_URL: ownerUrl },
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (migrate.status !== 0) fail("migrations failed.");

// 3. Sample agencies on staging.
if (seed) {
  const { createPrisma } = await import(pathToFileURL(join(root, "packages/db/dist/index.js")).href);
  const { seedSampleData } = await import(pathToFileURL(join(root, "packages/db/dist/seed/index.js")).href);
  const prisma = createPrisma(ownerUrl);
  for (const r of await seedSampleData(prisma)) console.log(`· ${r.created ? "created" : "sample data present"} · ${r.agency}`);
  await prisma.$disconnect();
}
console.log("db:setup — done");
