# ADR 0005 — REST API described by OpenAPI, generated from shared schemas

- **Status:** Accepted · Phase 0 · started (`/docs` on the API)

## Context

The web app, the future mobile app (Expo) and, later, SaaS customers' integrations all call the API. Types drifting between client and server is the most common source of bugs in this kind of project.

## Decision

- **REST + JSON**, resource-oriented (`/clients`, `/clients/:id/agreements`, `/videos/:id/versions`).
- Request bodies are validated with the **same Zod schema** the web form uses (`@gm/shared`, see ADR 0006) through `ZodPipe`.
- The OpenAPI document is generated from those schemas (`z.toJSONSchema`) and served at `/docs`.
- A typed client (`packages/api-client`) is generated from the OpenAPI document with `openapi-typescript`, wrapped in TanStack Query hooks for the web app. Generation runs in CI; a changed contract fails the build until the client is regenerated.
- Errors use one shape: `{ message, issues?: [{ path, message }] }` with standard status codes (400 validation, 401 no session/agency, 403 CASL, 404, 409 conflicts).
- Versioning: additive changes only; breaking changes get `/v2` routes (needed once the public API opens in Phase 7).

## Alternatives considered

- **tRPC** — excellent inside one TypeScript codebase, but the mobile app and SaaS integrations need a language-neutral contract.
- **GraphQL** — flexible, but more moving parts (caching, permissions per field) than the team needs.
