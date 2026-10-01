# ADR 0003 — Authentication with Better Auth (agency = organization)

- **Status:** Accepted · spike passed 30 Sep 2026 (`apps/api/src/auth`)

## Context

We need email and Google sign-in, invitations, sessions, two-factor authentication for owners and finance, and — for the SaaS — one person belonging to several agencies. Clients also sign in to the Client Hub, and the onboarding questionnaire is opened from a private link without an account.

## Decision

- **Better Auth**, self-hosted inside the API, with the **organization** plugin: an agency is an organization; the active organization in the session is the agency used for every request (it replaces the Phase 0 `x-agency-id` development header).
- Sign-in methods: email + password, Google, magic link for clients. Two-factor (TOTP) required for owner and finance roles.
- Better Auth's tables (`session`, `account`, `verification`, plus organization tables mapped onto our `memberships`) are generated into the Prisma schema in Phase 1.
- Questionnaire links use a random, single-purpose token (stored hashed), scoped to one response — not a session.
- Production refuses to start with the development header mode (`AUTH_MODE=dev-header`) — enforced in `apps/api/src/env.ts`.

## Spike — exit criteria and result

1. Better Auth organization plugin creates agencies and memberships in our tables. **Passed.**
2. The active organization is set on the request context and flows into `TenantDb` → RLS. **Passed.**
3. Switching agency changes what the same user sees, proven by an e2e test. **Passed.**
4. Invitations work by email **(passed)**; Google sign-in works on staging **(pending — needs the Google Cloud project)**.

Proven by `apps/api/src/auth/auth.e2e.test.ts` and `packages/db/src/tenancy.test.ts`. Decisions made during the spike:

- **A separate database role for sign-in.** Better Auth connects as `genie_auth`, which can reach only users, sessions, accounts, verifications, agencies, memberships and invitations — never business data. Sign-in happens before an agency is chosen, so on those tables `genie_auth` is not limited by agency. The API role (`genie_app`) cannot read passwords, sessions or verification codes, and sees only the people in its current agency (migration `20261019000000_auth`).
- **Live membership check.** On every request the API confirms the person is still a member of the session's active agency, so removing someone cuts access at once, even with a live session.
- **Confirmed email before accepting an invitation** (`requireEmailVerificationOnInvitation`). A confirmation link is sent on sign-up.
- **Roles.** Membership roles are strings chosen by each agency. Better Auth's own checks (who may invite or remove people) use its presets: owner, manager (admin preset), everyone else (member preset). What a role may do in the product comes from the agency's permission matrix (ADR 0004).
- **People and roles moved to the API (1 Oct 2026, P1-11).** Inviting, changing roles and removing people go through `/team` and `/roles`, which check the agency's permission matrix and audit each change. Better Auth's own routes for those are closed; it keeps sign-in, sessions, creating and switching agencies, and accepting invitations (ADR 0004).
- **Emails** (confirmation, invitation, password reset) go to an in-memory outbox that logs the link, until email sending is built (P1-04).

## Alternatives considered

- **Auth.js** — fine for sign-in, weaker on organizations and invitations.
- **Hosted identity (Clerk, Auth0)** — fastest to start, but per-user cost grows with the SaaS and user data leaves our database.
