# ADR 0003 — Authentication with Better Auth (agency = organization)

- **Status:** Accepted · Phase 0 · spike scheduled for Phase 1, week 1

## Context

We need email and Google sign-in, invitations, sessions, two-factor authentication for owners and finance, and — for the SaaS — one person belonging to several agencies. Clients also sign in to the Client Hub, and the onboarding questionnaire is opened from a private link without an account.

## Decision

- **Better Auth**, self-hosted inside the API, with the **organization** plugin: an agency is an organization; the active organization in the session is the agency used for every request (it replaces the Phase 0 `x-agency-id` development header).
- Sign-in methods: email + password, Google, magic link for clients. Two-factor (TOTP) required for owner and finance roles.
- Better Auth's tables (`session`, `account`, `verification`, plus organization tables mapped onto our `memberships`) are generated into the Prisma schema in Phase 1.
- Questionnaire links use a random, single-purpose token (stored hashed), scoped to one response — not a session.
- Production refuses to start with the development header mode (`AUTH_MODE=dev-header`) — enforced in `apps/api/src/env.ts`.

## Spike (Phase 1, week 1) — exit criteria

1. Better Auth organization plugin creates agencies and memberships in our tables.
2. The active organization is set on the request context and flows into `TenantDb` → RLS.
3. Switching agency changes what the same user sees, proven by an e2e test.
4. Invitations work by email; Google sign-in works on staging.

## Alternatives considered

- **Auth.js** — fine for sign-in, weaker on organizations and invitations.
- **Hosted identity (Clerk, Auth0)** — fastest to start, but per-user cost grows with the SaaS and user data leaves our database.
