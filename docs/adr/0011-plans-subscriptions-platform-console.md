# ADR 0011 — Plans, subscriptions and the platform console

- **Status:** Accepted · Phase 6 · implemented (`apps/api/src/platform`, `apps/api/src/billing`)
- **Builds on:** [ADR 0002](0002-tenancy-row-level-security.md) (row-level security), [ADR 0004](0004-authorization-casl.md) (the agency's own permissions), [ADR 0010](0010-background-jobs-postgres.md) (the runner's narrow switch).

## Context

Phase 6 opens the app to other agencies: they sign up, try it, choose a plan and pay. A plan decides which add-on suites an agency has and how much it may use; the people who run the platform (InTouch) need to see every agency's plan, usage and health — but must not be able to open an agency's data without its consent. The SaaS brand name, the plans' contents and prices, and our invoice details are not decided yet, and must not be written into the code.

## Decision

- **Suites, not areas.** The app's add-on suites are People and payroll, Finance and costing, Management, Operations, and Genie Assistant; everything else (sales, clients, delivery, publishing, the portal, invoices, settings) is the core every plan has. Each suite's API controllers carry `@Suite(...)`; the permission guard refuses a suite the agency's plan does not have ("not in your plan"), whatever the person's role. Turning a suite off hides it; its data stays and comes back with the suite.
- **Plans are platform settings.** One `platform_settings` row holds the brand name and domain, the trial's length and plan, the grace period for a failed payment, our invoice details, and the plans — each with its name, suites, limits (people, clients, Genie Assistant drafts a month, storage) and prices. The platform admin edits them in the console; the defaults in `@gm/shared` exist so development works and are placeholders until set. Anyone signed in may read the plans (they are what the pricing page shows); only the platform's own transactions may change them.
- **A subscription per agency.** `subscriptions` (one row per agency, under row-level security like any tenant table) holds the plan, status (trialing, active, past due, expired, cancelled), the trial's end, the paid period's end and the grace period's end, and the billing provider's reference. An agency that signs up starts a trial of the trial plan. **An agency with no subscription has every suite and no limits** — Genie Magnet (tenant number 1), the sample agencies and anything made before Phase 6 — until the platform admin gives it one.
- **Read-only, never locked out.** When a trial ends unpaid, or a payment is still failing after the grace period, the workspace turns read-only: everyone can still sign in, read everything and export it; changing anything is refused with what to do, except choosing a plan, paying and exporting.
- **Limits are checked where things are added** (inviting a person, adding a client, drafting with Genie Assistant, uploading a file), with the plan named in the refusal. Going over a limit by a downgrade keeps what is there and stops adding more.
- **The platform console** is for the people listed in `PLATFORM_ADMIN_EMAILS`. Its transactions set `app.platform`, which reveals the list of agencies, their subscriptions and the platform settings — nothing else. Each agency's figures (people, clients, usage, storage, last activity, failed jobs) are counted inside that agency's own row-level context and only the numbers leave it. Opening an agency's data needs the agency's time-limited consent (P6-08), and every action under it is logged in the agency's audit log.

## Consequences

- Every new suite's controllers must carry `@Suite`; the route-coverage test checks that each controller in a suite's folder does.
- Prices, plan contents and our GSTIN are entered in the console before launch; until then the pricing page and invoices show what the platform admin has set (and nothing is charged — the billing provider is pretend until the last step).
- The list of agencies and their subscriptions is visible to the platform's transactions; tenant tables are not, so a bug in the console cannot leak an agency's records.
