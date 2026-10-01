# Engineering guide

How to run, test and change Genie Magnet OS. Decisions behind this setup are in [`docs/adr`](adr/README.md); the work ahead is in [`docs/backlog`](backlog/phase-1.md).

## Repository layout

| Path              | What                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------- |
| `apps/web`        | Next.js web app — today the clickable demo with sample data, hosted with an access code |
| `apps/api`        | NestJS API (modular monolith) — health, tenant context, first module: clients           |
| `apps/worker`     | BullMQ worker — notifications, Genie Assistant rules, publishing                        |
| `packages/shared` | `@gm/shared` — domain enums and Zod schemas used by every app                           |
| `packages/db`     | `@gm/db` — Prisma schema, migrations (incl. row-level security), tenant-scoped client   |
| `packages/config` | `@gm/config` — shared TypeScript settings                                               |
| `infra`           | Local stack: PostgreSQL, Redis, MinIO (files), Mailpit (email)                          |
| `docs`            | ADRs, database design, plans for Genie Magnet                                           |

## First-time setup

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

`GET /api/auth/test-sign-in/people` lists who can be picked; add `"agencyId"` to choose the agency. The API refuses to start with `TEST_SIGN_IN=true` in production, and it must stay off on any server that holds real data — anyone who can reach that server could sign in as anyone.

## Database roles

| Role          | Used by               | Can reach                                                                                  |
| ------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| `genie_owner` | Migrations only       | Everything (owns the schema)                                                               |
| `genie_app`   | API and worker        | Business data of the current agency only (row-level security); never passwords or sessions |
| `genie_auth`  | Better Auth (sign-in) | Sign-in tables, agencies, memberships and invitations — never business data                |

## Rules that are never skipped

1. **Every new tenant table** gets `agency_id`, an index on it, and a line in the RLS migration. The schema guard test fails the build otherwise.
2. **Services reach the database only through `TenantDb`** (`forAgency` / `withAgency`). Never create a Prisma client in a module.
3. **Every endpoint** validates its body with a `@gm/shared` schema (`ZodPipe`) and checks permissions with CASL (Phase 1).
4. **Background jobs carry `agencyId`** and validate their payload (`apps/worker/src/jobs.ts`).
5. **No secrets, personal data or real client data** in code, fixtures, logs or screenshots. Test data uses sample names.
6. **Money is whole rupees.** No floats.

## Adding a module (API)

1. `apps/api/src/<module>/` with `<module>.controller.ts` and `<module>.service.ts`; register both in `app.module.ts`.
2. Input schemas in `packages/shared/src/schemas.ts`; tables in `schema.prisma` + RLS lines; `npm run db:migrate`.
3. An e2e test that includes a cross-agency case (see `clients.e2e.test.ts`).
4. PR with the template checklist filled in.

## Branches, commits and pull requests

- Branch from `main`: `feature/<module>-<short-name>`, `fix/<short-name>`, `phase-<n>/<topic>`.
- Small PRs; each links its story. CI must be green; one review from the tech lead.
- Commit messages: imperative summary line, then what and why.

## Troubleshooting

- **SWC "cache root" error on Windows when running API tests** — set `SWC_NATIVE_BINDING_CACHE` to a writable folder, e.g. `node_modules/.cache/swc`.
- **`prisma migrate diff` needs a shadow database** — set `SHADOW_DATABASE_URL` to an empty database.
