// npm run dev:local — the whole backend on this computer, no Docker needed:
// PostgreSQL kept in .pg-dev/ (port 5433), migrations, the sample agencies, and the API on http://localhost:4000
// with test sign-in on and email confirmation off. Run the web app next to it (npm run dev) and open
// http://localhost:3000/app. Stop with Ctrl+C; the data stays for next time (delete .pg-dev/ to start over).
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, ".pg-dev");
const PORT = Number(process.env.DEV_DB_PORT ?? 5433);
const url = (user, password) => `postgresql://${user}:${password}@127.0.0.1:${PORT}/genie`;
const OWNER_URL = url("genie_owner", "genie_owner_dev");

async function reachable() {
  const client = new pg.Client({ connectionString: OWNER_URL });
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

// 1. Database: reuse one that is already running (e.g. after the API was restarted), otherwise start it.
let server = null;
if (await reachable()) {
  console.log(`· database already running on port ${PORT}`);
} else {
  server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "genie_owner",
    password: "genie_owner_dev",
    port: PORT,
    persistent: true,
    onLog: () => {},
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
  const fresh = !existsSync(join(dataDir, "PG_VERSION"));
  if (fresh) await server.initialise();
  await server.start();
  if (fresh) await server.createDatabase("genie");
  console.log(`· database ${fresh ? "created" : "started"} in .pg-dev on port ${PORT}`);
}

// 2. The API's and sign-in's own database roles (same passwords as .env.example), then migrations.
const admin = new pg.Client({ connectionString: OWNER_URL });
await admin.connect();
for (const [role, password] of [
  ["genie_app", "genie_app_dev"],
  ["genie_auth", "genie_auth_dev"],
]) {
  await admin.query(
    `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS; END IF; END $$`,
  );
}
await admin.end();

const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: join(root, "packages/db"),
  env: { ...process.env, DATABASE_OWNER_URL: OWNER_URL },
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (migrate.status !== 0) {
  await server?.stop();
  process.exit(migrate.status ?? 1);
}

// 3. Sample agencies (safe to run every time).
const { createPrisma } = await import(pathToFileURL(join(root, "packages/db/dist/index.js")).href);
const { seedSampleData } = await import(pathToFileURL(join(root, "packages/db/dist/seed/index.js")).href);
const prisma = createPrisma(OWNER_URL);
for (const r of await seedSampleData(prisma)) console.log(`· ${r.created ? "created" : "sample data present"} · ${r.agency}`);
await prisma.$disconnect();

// 4. The API. The browser reaches it through the web app (/api/…), so its public address is the web app's.
const api = spawn(process.execPath, [join(root, "apps/api/dist/main.js")], {
  cwd: join(root, "apps/api"),
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "development",
    API_PORT: "4000",
    DATABASE_URL: url("genie_app", "genie_app_dev"),
    AUTH_DATABASE_URL: url("genie_auth", "genie_auth_dev"),
    AUTH_MODE: "better-auth",
    BETTER_AUTH_SECRET: "local-development-secret-not-for-real-use-0123456789",
    BETTER_AUTH_URL: "http://localhost:3000",
    WEB_ORIGIN: "http://localhost:3000",
    TEST_SIGN_IN: "true",
    REQUIRE_EMAIL_VERIFICATION: "false",
    // Background jobs in the same process (ADR 0010): the daily reminders and checks.
    RUN_JOBS: "true",
  },
});

let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api.kill();
  await server?.stop().catch(() => {});
  process.exit(code);
}
api.on("exit", (code) => void stop(code ?? 0));
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
