// Runs a command against a throwaway embedded PostgreSQL — for machines without Docker.
//   node scripts/with-temp-postgres.mjs npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script
// Sets DATABASE_OWNER_URL (empty "main" database) and SHADOW_DATABASE_URL (empty "shadow" database).
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("Usage: node scripts/with-temp-postgres.mjs <command> [args…]");
  process.exit(2);
}

const port = await new Promise((ok) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => ok(p));
  });
});
const parent = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.pg-test");
mkdirSync(parent, { recursive: true });
const dir = mkdtempSync(join(parent, "tmp-"));
const server = new EmbeddedPostgres({
  databaseDir: dir,
  user: "genie_owner",
  password: "tmp",
  port,
  persistent: false,
  onLog: () => {},
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

let status = 1;
try {
  await server.initialise();
  await server.start();
  await server.createDatabase("main");
  await server.createDatabase("shadow");
  const env = {
    ...process.env,
    DATABASE_OWNER_URL: `postgresql://genie_owner:tmp@127.0.0.1:${port}/main`,
    SHADOW_DATABASE_URL: `postgresql://genie_owner:tmp@127.0.0.1:${port}/shadow`,
  };
  status = spawnSync(cmd, args, { env, stdio: "inherit", shell: process.platform === "win32" }).status ?? 1;
} finally {
  await server.stop().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
}
process.exit(status);
