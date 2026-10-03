// Restore drill (P6-14): checks that a database restored from a backup is the same as the one it came from — the same
// tables and rows, row-level security on and forced on the same tables with the same policies, the same grants for
// the API's roles, the same functions run as their owner, and the same migrations — and prints what differs.
// Connect both as a role that reads past row-level security (superuser or BYPASSRLS, as backups are taken), so the
// counts are not filtered.
//
//   node scripts/verify-restore.mjs <source database URL> <restored database URL>

import pg from "pg";

const [sourceUrl, restoredUrl] = process.argv.slice(2);
if (!sourceUrl || !restoredUrl) {
  console.error("Usage: node scripts/verify-restore.mjs <source database URL> <restored database URL>");
  process.exit(2);
}

async function snapshot(url) {
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    const [{ bypass }] = (await db.query("SELECT rolsuper OR rolbypassrls AS bypass FROM pg_roles WHERE rolname = current_user")).rows;
    if (!bypass) throw new Error(`${new URL(url).username} cannot read past row-level security: connect as the role backups are taken with.`);
    await db.query("SET row_security = off");
    const q = async (sql) => (await db.query(sql)).rows;
    const tables = await q(`SELECT c.relname AS name, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1`);
    const agencyTables = (await q(`SELECT table_name AS name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'agency_id'`)).map(
      (t) => t.name,
    );
    const rows = {};
    for (const t of tables) rows[t.name] = Number((await q(`SELECT count(*) AS n FROM "${t.name}"`))[0].n);
    return {
      agencyTables: Object.fromEntries(agencyTables.map((t) => [t, "holds agency data"])),
      tables: Object.fromEntries(tables.map((t) => [t.name, `rls ${t.rls ? "on" : "off"}, ${t.forced ? "forced" : "not forced"}`])),
      rows,
      policies: Object.fromEntries(
        (
          await q(`SELECT tablename, policyname, cmd, coalesce(qual, '') AS qual, coalesce(with_check, '') AS chk FROM pg_policies WHERE schemaname = 'public'`)
        ).map((p) => [`${p.tablename}.${p.policyname}`, `${p.cmd} using ${p.qual} check ${p.chk}`]),
      ),
      grants: Object.fromEntries(
        (
          await q(`SELECT grantee, table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
            FROM information_schema.role_table_grants WHERE table_schema = 'public' AND grantee IN ('genie_app', 'genie_auth') GROUP BY 1, 2`)
        ).map((g) => [`${g.grantee} on ${g.table_name}`, g.privileges]),
      ),
      functions: Object.fromEntries(
        (
          await q(`SELECT p.proname AS name, p.prosecdef AS definer, pg_get_function_identity_arguments(p.oid) AS args
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname LIKE 'app\\_%'`)
        ).map((f) => [`${f.name}(${f.args})`, f.definer ? "runs as its owner" : "runs as the caller"]),
      ),
      roles: Object.fromEntries((await q(`SELECT rolname FROM pg_roles WHERE rolname IN ('genie_app', 'genie_auth')`)).map((r) => [r.rolname, "exists"])),
      migrations: Object.fromEntries(
        (await q(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)).map((m) => [
          m.migration_name,
          "applied",
        ]),
      ),
    };
  } finally {
    await db.end();
  }
}

const [a, b] = await Promise.all([snapshot(sourceUrl), snapshot(restoredUrl)]);
let differences = 0;
for (const part of Object.keys(a)) {
  const keys = [...new Set([...Object.keys(a[part]), ...Object.keys(b[part])])].sort();
  const diff = keys.filter((k) => String(a[part][k]) !== String(b[part][k]));
  differences += diff.length;
  console.log(`${diff.length ? "✗" : "✓"} ${part}: ${keys.length} compared${diff.length ? `, ${diff.length} differ` : ""}`);
  for (const k of diff.slice(0, 20)) console.log(`    ${k}: ${a[part][k] ?? "(missing)"} → ${b[part][k] ?? "(missing)"}`);
}
// A restore must also be safe on its own: every table holding agency data has row-level security on and forced.
const open = Object.keys(b.agencyTables).filter((t) => b.tables[t] !== "rls on, forced");
if (open.length) console.log(`✗ agency tables without row-level security forced in the restored database: ${open.join(", ")}`);
const total = Object.values(b.rows).reduce((s, n) => s + n, 0);
console.log(
  differences || open.length
    ? `\nFAILED: ${differences + open.length} differences`
    : `\nPASSED: ${Object.keys(b.tables).length} tables, ${total} rows, the same in both`,
);
process.exit(differences || open.length ? 1 : 0);
