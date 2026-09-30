# ADR 0009 — Toolchain: ESM packages, Prisma 7 with the pg adapter, pinned versions

- **Status:** Accepted · Phase 0 · 30 Sep 2026

## Context

NestJS 12 ships as ES modules only. Prisma 7 generates a TypeScript client and connects through a driver adapter. At setup time the `latest` tag of the Prisma CLI pointed at a release candidate (8.0.0-rc) and TypeScript's `latest` was 7.0 (the new native compiler), while the web app builds with TypeScript 5.9.

## Decision

- All service packages (`@gm/shared`, `@gm/db`, `api`, `worker`) are **ESM** (`"type": "module"`, `NodeNext`, relative imports with `.js`). The web app keeps Next.js's own setup.
- **Prisma 7.10.0** (CLI and client pinned to the same version), `prisma-client` generator with `moduleFormat = "esm"`, `@prisma/adapter-pg` for connections, `prisma.config.ts` for URLs. Migrations run as the schema owner (`DATABASE_OWNER_URL`); the app never does.
- **TypeScript 5.9** across the repo until Next.js and our tooling support TypeScript 7; revisit in Phase 2.
- **Vitest** for all service tests; the API uses SWC through `unplugin-swc` so Nest's decorator metadata works in tests.
- **Node 22 LTS** (`.nvmrc`). Prettier for formatting (`npm run format`).
- Pre-release versions are never used; `npm run test` and CI must pass before any upgrade is merged.

## Consequences

- One module system for all backend code; no dual CommonJS/ESM builds.
- Upgrades (Prisma 8, TypeScript 7) are deliberate PRs with this ADR updated.
