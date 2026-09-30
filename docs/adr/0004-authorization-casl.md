# ADR 0004 — Permissions with CASL

- **Status:** Accepted · Phase 0 · updated for plan v1.1 (agency-editable) · implemented in Phase 1

## Context

Roles differ sharply: editors see their assigned videos; finance sees money but not HR; clients see only their own deliverables; salaries are visible to very few people. Every agency — Genie Magnet included — sets its own roles and permissions in Settings (plan v1.1); nothing about roles is hard-coded.

## Decision

- **CASL** abilities built per request from the member's role **as saved in the agency's permission matrix** (areas × roles: none / view / edit / approve): `can("approve", "Invoice")`, `can("read", "Video", { editorId: user.id })`.
- **Default** roles and their matrix live in `@gm/shared` and are copied into each new agency; the agency edits its copy. The **API enforces** the saved rules (a Nest guard on every endpoint) and the **web app uses the same rules to hide** buttons and menu items.
- Record-level conditions (own / team / all) are CASL conditions translated to Prisma `where` clauses with `@casl/prisma`.
- RLS (ADR 0002) protects agencies from each other; CASL protects people inside an agency from each other. Both apply.
- Sensitive areas (salaries, payroll, personal finance planner) are denied by default and granted explicitly.

## Consequences

- One definition of "who can do what", tested with a permission matrix test per role.
- Custom roles and the permission matrix ship in Phase 1; permission changes are audited and apply from the next request.
