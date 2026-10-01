# ADR 0004 — Permissions: the agency's own matrix, shared by API and web

- **Status:** Accepted · Phase 0 · updated for plan v1.1 (agency-editable) · **implemented 1 Oct 2026 without CASL** (see "Change at implementation")

## Context

Roles differ sharply: editors see their assigned videos; finance sees money but not HR; clients see only their own deliverables; salaries are visible to very few people. Every agency — Genie Magnet included — sets its own roles and permissions in Settings (plan v1.1); nothing about roles is hard-coded.

## Decision

- Each agency has a **permission matrix**: areas × roles, each cell none / view / edit / approve, and for some areas "own records only" (`packages/shared/src/permissions.ts`). It is stored per role in the agency's `roles` table and read fresh on every request, so a change applies from the person's next request.
- **Default** roles and their matrix live in `@gm/shared` and are copied into each new agency; the agency edits its copy. The **owner** role always has full access and cannot be changed, so an agency can never lock itself out.
- The **API enforces** the saved matrix: every endpoint declares `@Can(area, level)` or `@Public()`; a global guard checks it and refuses endpoints that declare neither, and a CI test fails if one is missing. The **web app uses the same rules** (`allows`, `scopeOf` from `@gm/shared`, and `GET /me` returns the person's matrix) to hide buttons and menu items.
- **Own records only** becomes a Prisma `where` through `TenantDb.ownOnly(area, field)` (e.g. clients they are account owner of; later, videos assigned to them).
- **No one can hand out more than they have:** only owners make owners, and nobody else can create, widen or assign a role beyond their own access — or change someone whose role has more access than theirs.
- Sensitive areas (salaries and payroll, personal finance planner) are off for every role but the owner until granted.
- RLS (ADR 0002) protects agencies from each other; the matrix protects people inside an agency from each other. Both apply.
- **People and roles are managed by the API** (`/team`, `/roles`), checked against the matrix and audited. Better Auth's own invite / role / remove / list routes are closed, so its fixed roles can never bypass the matrix; it still handles sign-in, creating and switching agencies, and accepting invitations (ADR 0003).

## Change at implementation

The ADR first chose CASL with `@casl/prisma`. At implementation the rules turned out to be a matrix of levels plus an "own records" flag, which a few lines of shared code check exactly the same way on the API and in the web app. CASL's general condition language was not needed, and leaving it out avoids a dependency on how `@casl/prisma` works with Prisma 7's generated client. If record rules grow beyond "own records" (for example "my team's records"), this is the place to reconsider CASL.

## Consequences

- One definition of "who can do what", tested per role (`apps/api/src/access/permissions.e2e.test.ts` checks every endpoint against the matrix for each default role).
- Custom roles and permission changes are audited and apply from the next request.
- Adding an endpoint means choosing its area and level; forgetting fails CI.
