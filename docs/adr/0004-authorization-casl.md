# ADR 0004 — Permissions with CASL

- **Status:** Accepted · Phase 0 · implemented in Phase 1

## Context

Roles differ sharply: editors see their assigned videos; finance sees money but not HR; clients see only their own deliverables; salaries are visible to very few people. Genie Magnet will define the exact matrix (information request topic O3), and each SaaS agency will adjust it.

## Decision

- **CASL** abilities built per request from the member's role (and, later, custom agency rules): `can("approve", "Invoice")`, `can("read", "Video", { editorId: user.id })`.
- Default role → ability rules live in `@gm/shared` so the **API enforces** them (a Nest guard on every endpoint) and the **web app uses the same rules to hide** buttons and menu items.
- Record-level conditions (own / team / all) are CASL conditions translated to Prisma `where` clauses with `@casl/prisma`.
- RLS (ADR 0002) protects agencies from each other; CASL protects people inside an agency from each other. Both apply.
- Sensitive areas (salaries, payroll, personal finance planner) are denied by default and granted explicitly.

## Consequences

- One definition of "who can do what", tested with a permission matrix test per role.
- Agencies editing permissions (Phase 6) store extra rules per agency; the defaults stay in code.
