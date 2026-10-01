# Engineering guide

How to run, test and change Genie Magnet OS. Decisions behind this setup are in [`docs/adr`](adr/README.md); the work ahead is in [`docs/backlog`](backlog/phase-1.md).

## Repository layout

| Path              | What                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| `apps/web`        | Next.js web app — the real app under `/app` (`src/live`) and the clickable demo at `/` |
| `apps/api`        | NestJS API (modular monolith) — health, tenant context, first module: clients          |
| `apps/worker`     | BullMQ worker — notifications, Genie Assistant rules, publishing                       |
| `packages/shared` | `@gm/shared` — domain enums and Zod schemas used by every app                          |
| `packages/db`     | `@gm/db` — Prisma schema, migrations (incl. row-level security), tenant-scoped client  |
| `packages/config` | `@gm/config` — shared TypeScript settings                                              |
| `infra`           | Local stack: PostgreSQL, Redis, MinIO (files), Mailpit (email)                         |
| `docs`            | ADRs, database design, plans for Genie Magnet                                          |

## Quick start without Docker

1. `npm install`
2. `npm run dev:local` — PostgreSQL in `.pg-dev/` (port 5433), migrations, sample data and the API on http://localhost:4000, with test sign-in on and email confirmation off. Data stays between runs; delete `.pg-dev/` to start again.
3. In a second terminal: `npm run dev` — the web app on http://localhost:3000. The real app is at **http://localhost:3000/app** (pick a sample person to sign in); the clickable demo stays at http://localhost:3000.

The web app sends `/api/*` to the API (`apps/web/next.config.ts`), so the browser only ever talks to the web app and sign-in cookies are first-party. On a server, set `API_URL` for the web app at build time; without it, `/app` says the real app is not connected and the demo works as before.

## First-time setup (with Docker)

1. Node 22 (`.nvmrc`) and Docker Desktop.
2. `npm install`
3. `cp .env.example .env`
4. `npm run infra:up` — starts PostgreSQL, Redis, MinIO and Mailpit (inbox at http://localhost:8025).
5. `npm run db:migrate` — applies migrations as the schema owner.
6. `npm run db:seed` — sample agencies (Genie Magnet and Zen Studio) with people, packages, clients, agreements and leads.
7. Run what you need:
   - `npm run dev` — web app on http://localhost:3000
   - `npm run dev:api` — API on http://localhost:4000, OpenAPI docs at `/docs`
   - `npm run dev:worker` — background worker
8. Optional: `git config core.hooksPath .githooks` for the pre-commit checks.

## Everyday commands

| Command              | Does                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| `npm test`           | Builds the services and runs every suite, including the cross-tenant one |
| `npm run typecheck`  | Services build + web type-check                                          |
| `npm run lint`       | Web lint                                                                 |
| `npm run format`     | Prettier on service code and docs                                        |
| `npm run db:migrate` | New migration from schema changes (development, needs a database)        |
| `npm run db:diff`    | Print the SQL for schema changes using a temporary database (no Docker)  |
| `npm run db:seed`    | Sample data (safe to run again; never in production)                     |
| `npm run build`      | Web production build (what the hosted demo runs)                         |

The cross-tenant tests need PostgreSQL. With Docker they can use the compose database; **without Docker they start an embedded PostgreSQL automatically** (first run downloads nothing — the binary comes with `npm install`). In CI they use a Postgres service container, one fresh database per suite.

## Sample data and test sign-in

`npm run db:seed` creates two invented agencies — never real client data:

- **Genie Magnet** — the same people, clients, packages, agreements and leads as the web demo, plus Anitha (finance).
- **Zen Studio (test agency)** — a second agency for checking that agencies never see each other. Rahul Menon (freelancer) works for both, so switching agencies can be tried.

Every seeded email ends in `.test`, a domain that can never receive mail. Seeded people have **no password**: until two-factor and Google sign-in are built (P1-10, last in Phase 1), testing uses **test sign-in** — start the API with `TEST_SIGN_IN=true` and sign in as anyone:

```bash
curl -c cookies.txt -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \n  -d '{"email":"ashwin@geniemagnet.test"}' http://localhost:4000/api/auth/test-sign-in
curl -b cookies.txt http://localhost:4000/clients
```

Email confirmation is off while testing (`REQUIRE_EMAIL_VERIFICATION=false`), so an invited person can sign up and accept straight away; the invitation link is in the API log. It is switched on in the last step and required in production.

`GET /api/auth/test-sign-in/people` lists who can be picked; add `"agencyId"` to choose the agency. The API refuses to start with `TEST_SIGN_IN=true` in production, and it must stay off on any server that holds real data — anyone who can reach that server could sign in as anyone.

## Errors, logs and limits (API)

- **Errors** always come back as `{ message, issues?, requestId }`. A 500 never shows internals; the full error is in the server log under the same request id. Sign-in routes (`/api/auth/*`) use Better Auth's own `{ message, code }`.
- **Logs**: one line per request with request id, method, path, status, time, agency id and user id — never query strings, IP addresses, names, emails or tokens. JSON in production, readable text locally. Send `x-request-id` from the web app to follow one action end to end.
- **Rate limits**: sign-in and sign-up 3 tries per 10 seconds per IP, other sign-in routes 100 a minute (Better Auth); every API route 300 a minute per person, or per IP when not signed in (`RATE_LIMIT_PER_MINUTE`). Routes can set their own with `@RateLimit(...)`; health checks are exempt. Kept in memory — fine for one API process, moved to Redis when the API runs on several.
- Behind a proxy (Railway) set `TRUST_PROXY=1` so the caller's IP is read correctly.

## Permissions

Each agency edits its own permission matrix (Settings → Roles): areas × roles, each cell none / view / edit / approve, some areas limited to "own records". Defaults and the check functions are in `packages/shared/src/permissions.ts`; the API reads the person's row on every request.

- New endpoint: `@Can("clients", "edit")` (or `@Public()` for health and who-am-I). The guard refuses endpoints without a rule, and `access/coverage.test.ts` fails CI.
- Areas with "own records": filter with `this.tenant.ownOnly("clients", "accountOwnerId")`.
- People and roles: `/team` (members, invitations) and `/roles` (the matrix). Better Auth's own invite/role/remove routes are closed.
- In `AUTH_MODE=dev-header`, add `x-role` to act as a role (owner when left out).

## Database roles

| Role          | Used by               | Can reach                                                                                  |
| ------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| `genie_owner` | Migrations only       | Everything (owns the schema)                                                               |
| `genie_app`   | API and worker        | Business data of the current agency only (row-level security); never passwords or sessions |
| `genie_auth`  | Better Auth (sign-in) | Sign-in tables, agencies, memberships and invitations — never business data                |

## Rules that are never skipped

1. **Every new tenant table** gets `agency_id`, an index on it, and a line in the RLS migration. The schema guard test fails the build otherwise.
2. **Services reach the database only through `TenantDb`** (`forAgency` / `withAgency`). Never create a Prisma client in a module.
3. **Every endpoint** validates its body with a `@gm/shared` schema (`ZodPipe`) and declares `@Can(area, level)` or `@Public()` ([ADR 0004](adr/0004-authorization-casl.md)); a missing rule fails CI.
4. **Background jobs carry `agencyId`** and validate their payload (`apps/worker/src/jobs.ts`).
5. **No secrets, personal data or real client data** in code, fixtures, logs or screenshots. Test data uses sample names.
6. **Money is whole rupees.** No floats.

## Adding a module (API)

1. `apps/api/src/<module>/` with `<module>.controller.ts` and `<module>.service.ts`; register both in `app.module.ts`.
2. Input schemas in `packages/shared/src/schemas.ts`; tables in `schema.prisma` + RLS lines; `npm run db:migrate`.
3. Every change is audited inside its own transaction: `this.tenant.tx(async (tx) => { …; await this.audit.record(tx, { action, entity, entityId, before, after }) })`. For updates, pass only what changed: `changes(before, after)` from `audit.service.ts`.
4. An e2e test that includes a cross-agency case (see `clients.e2e.test.ts`).
5. PR with the template checklist filled in.

## Branches, commits and pull requests

- Branch from `main`: `feature/<module>-<short-name>`, `fix/<short-name>`, `phase-<n>/<topic>`.
- Small PRs; each links its story. CI must be green; one review from the tech lead.
- Commit messages: imperative summary line, then what and why.

## Troubleshooting

- **SWC "cache root" error on Windows when running API tests** — set `SWC_NATIVE_BINDING_CACHE` to a writable folder, e.g. `node_modules/.cache/swc`.
- **`prisma migrate diff` needs a shadow database** — set `SHADOW_DATABASE_URL` to an empty database.
