# ADR 0002 — Multi-tenancy with `agency_id` and PostgreSQL row-level security

- **Status:** Accepted · Phase 0 · 30 Sep 2026 · implemented and tested (`packages/db`)

## Context

Genie Magnet is tenant #1; the SaaS will host many agencies in one database. A missed `where agencyId = …` in any query would leak one agency's clients, videos or money to another. That must be impossible, not just unlikely.

## Decision

1. **Every tenant table has `agency_id`** (uuid, indexed). `users` is the only global table (a person can belong to several agencies).
2. **Row-level security is enabled and FORCED** on every tenant table, with one policy:
   `agency_id = app_current_agency()` for reads (`USING`) and writes (`WITH CHECK`).
   `app_current_agency()` reads the transaction setting `app.agency_id`.
3. **Two database roles.** `genie_owner` owns the schema and runs migrations. The API and worker connect as **`genie_app`**, which has `NOBYPASSRLS` and no DDL rights, so RLS always applies.
4. **Every query runs in a transaction that sets the agency first** (`SELECT set_config('app.agency_id', $1, true)`):
   - `forAgency(prisma, agencyId)` — a Prisma client extension for single operations;
   - `withAgency(prisma, agencyId, fn)` — for multi-step transactions;
   - in the API, `TenantDb` is the only way services reach the database; it reads the agency from the request context (AsyncLocalStorage).
5. **Special cases:**
   - `agencies` — an agency sees only its own row;
   - `memberships` — visible inside the agency, or to the signed-in user (`app.user_id`) so they can switch agencies;
   - `audit_logs` — the application may insert and read, never update or delete.
6. **Cross-tenant test suite in CI** (`packages/db/src/tenancy.test.ts`, `apps/api/src/clients/clients.e2e.test.ts`): read, update, delete and insert across agencies must fail, and a schema guard fails the build if any table with `agency_id` lacks forced RLS and a policy. A failure blocks the merge.

## Consequences

- A forgotten filter returns nothing instead of another agency's data.
- Every query pays for a small transaction. Measured cost is negligible at our scale; revisit with pooling (PgBouncer in transaction mode works with `SET LOCAL`/`set_config(…, true)`).
- Background jobs must carry `agencyId` (see ADR 0007).
- Platform-admin tooling (support, billing across agencies) uses a separate, audited role — designed in Phase 6.
- New tables must be added to the RLS migration; the schema guard test enforces it.

## Alternatives considered

- **Application-only filtering** — one mistake leaks data; rejected.
- **Schema or database per agency** — strong isolation but painful migrations and reporting across hundreds of agencies; kept as an enterprise option (dedicated database) for later.
