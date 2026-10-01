// Test database for the cross-tenant suite.
// CI provides a real Postgres (TEST_DATABASE_OWNER_URL, TEST_DATABASE_APP_URL, TEST_DATABASE_AUTH_URL); each suite gets its own database.
// Locally, without Docker, an embedded Postgres is started in .pg-test/ and removed afterwards.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, "../../prisma/migrations");

export interface TestDatabase {
  ownerUrl: string;
  /** genie_app — the API and worker; row-level security applies. */
  appUrl: string;
  /** genie_auth — Better Auth; sign-in tables only. */
  authUrl: string;
  stop: () => Promise<void>;
}

function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const s = createServer();
    s.once("error", fail);
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => ok(port));
    });
  });
}

async function applyMigrations(ownerUrl: string) {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    for (const dir of readdirSync(MIGRATIONS, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      await client.query(readFileSync(join(MIGRATIONS, dir.name, "migration.sql"), "utf8"));
    }
  } finally {
    await client.end();
  }
}

/** Best effort: Windows can keep the data folder locked for a moment after the server stops; the next run sweeps it. */
function removeQuietly(dir: string) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // left for the next run
  }
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const ownerFromEnv = process.env.TEST_DATABASE_OWNER_URL;
  const appFromEnv = process.env.TEST_DATABASE_APP_URL;
  const authFromEnv = process.env.TEST_DATABASE_AUTH_URL;
  if (ownerFromEnv && appFromEnv && authFromEnv) {
    // A fresh database per suite, so suites never share migrations or rows.
    const name = `genie_test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const withDb = (u: string) => {
      const url = new URL(u);
      url.pathname = `/${name}`;
      return url.toString();
    };
    const admin = new pg.Client({ connectionString: ownerFromEnv });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${name}`);
    await admin.end();
    await applyMigrations(withDb(ownerFromEnv));
    return {
      ownerUrl: withDb(ownerFromEnv),
      appUrl: withDb(appFromEnv),
      authUrl: withDb(authFromEnv),
      stop: async () => {
        const c = new pg.Client({ connectionString: ownerFromEnv });
        await c.connect();
        await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
        await c.end();
      },
    };
  }

  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const parent = resolve(here, "../../../../.pg-test");
  mkdirSync(parent, { recursive: true });
  // Folders a previous run could not remove (Windows sometimes keeps them locked for a while).
  for (const old of readdirSync(parent)) removeQuietly(join(parent, old));
  const dir = mkdtempSync(join(parent, "run-"));
  const port = await freePort();
  const server = new EmbeddedPostgres({
    databaseDir: dir,
    user: "genie_owner",
    password: "owner-test",
    port,
    // We remove the folder ourselves (removeQuietly): the library's own removal fails when Windows still holds it.
    persistent: true,
    onLog: () => {},
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
  await server.initialise();
  await server.start();
  await server.createDatabase("genie_test");

  const ownerUrl = `postgresql://genie_owner:owner-test@127.0.0.1:${port}/genie_test`;
  const admin = new pg.Client({ connectionString: ownerUrl });
  await admin.connect();
  await admin.query("CREATE ROLE genie_app LOGIN PASSWORD 'app-test' NOSUPERUSER NOBYPASSRLS");
  await admin.query("CREATE ROLE genie_auth LOGIN PASSWORD 'auth-test' NOSUPERUSER NOBYPASSRLS");
  await admin.end();
  await applyMigrations(ownerUrl);

  return {
    ownerUrl,
    appUrl: `postgresql://genie_app:app-test@127.0.0.1:${port}/genie_test`,
    authUrl: `postgresql://genie_auth:auth-test@127.0.0.1:${port}/genie_test`,
    stop: async () => {
      await server.stop();
      removeQuietly(dir);
    },
  };
}
