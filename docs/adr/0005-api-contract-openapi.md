# ADR 0005 — REST API described by OpenAPI, generated from shared schemas

- **Status:** Accepted · Phase 0 · started (`/docs` on the API)

## Context

The web app, the future mobile app (Expo) and, later, SaaS customers' integrations all call the API. Types drifting between client and server is the most common source of bugs in this kind of project.

## Decision

- **REST + JSON**, resource-oriented (`/clients`, `/clients/:id/agreements`, `/videos/:id/versions`).
- Request bodies are validated with the **same Zod schema** the web form uses (`@gm/shared`, see ADR 0006) through `ZodPipe`.
- The OpenAPI document is generated from those schemas (`z.toJSONSchema`) and served at `/docs`.
- ~~A typed client (`packages/api-client`) generated from the OpenAPI document.~~ **Changed at implementation (1 Oct 2026):** the web app uses the response types in `@gm/shared` (`src/api.ts`) with a small fetch helper and TanStack Query hooks (`apps/web/src/live`). The OpenAPI document describes request bodies but not yet responses, so a generated client would not have been typed end to end. A generated client returns when the mobile app or public API needs one (response schemas get added to OpenAPI then).
- Errors use one shape: `{ message, issues?: [{ path, message }] }` with standard status codes (400 validation, 401 no session/agency, 403 permission matrix, 404, 409 conflicts).
- Versioning: additive changes only; breaking changes get `/v2` routes (needed once the public API opens in Phase 7).

## Alternatives considered

- **tRPC** — excellent inside one TypeScript codebase, but the mobile app and SaaS integrations need a language-neutral contract.
- **GraphQL** — flexible, but more moving parts (caching, permissions per field) than the team needs.
