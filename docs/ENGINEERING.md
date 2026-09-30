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
6. Run what you need:
   - `npm run dev` — web app on http://localhost:3000
   - `npm run dev:api` — API on http://localhost:4000, OpenAPI docs at `/docs`
   - `npm run dev:worker` — background worker
7. Optional: `git config core.hooksPath .githooks` for the pre-commit checks.

## Everyday commands

| Command              | Does                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| `npm test`           | Builds the services and runs every suite, including the cross-tenant one |
| `npm run typecheck`  | Services build + web type-check                                          |
| `npm run lint`       | Web lint                                                                 |
| `npm run format`     | Prettier on service code and docs                                        |
| `npm run db:migrate` | New migration from schema changes (development)                          |
| `npm run build`      | Web production build (what the hosted demo runs)                         |

The cross-tenant tests need PostgreSQL. With Docker they can use the compose database; **without Docker they start an embedded PostgreSQL automatically** (first run downloads nothing — the binary comes with `npm install`). In CI they use a Postgres service container, one fresh database per suite.

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
