# Phase 1 backlog — Foundation

**Weeks 2–5 · Mon 19 Oct – Fri 13 Nov 2026.** Goal: the real application skeleton — sign-in, agencies, roles, audit — with clients won and onboarded on real data.
**Exit gate:** a client can be won and onboarded in the real app (story P1-30).

Sizes: **S** ≤ 2 days · **M** 3–5 days · **L** 6–10 days.

**Everything is configurable by each agency (plan v1.1).** Roles and permissions, packages, pipeline stages, onboarding questions and invoice settings are settings with Growth OS defaults — never hard-coded. Genie Magnet does not need to send them in advance; their team sets up their own workspace in a guided session in week 4 (P1-29). If they send the information request answers anyway, we pre-load them.

Already done in Phase 0: monorepo, `@gm/shared`, `@gm/db` schema v0 with forced RLS and the cross-tenant suite, API skeleton with tenant context and the clients endpoint, worker skeleton, CI, ADRs.

---

## Platform

**P1-01 · API hardening (M)**
As the tech lead, I want every request logged, rate-limited and returning one error shape, so problems are traceable and the API is safe to expose.

- Structured JSON logs with a request id, agency id and user id; no personal data in logs.
- One error format `{ message, issues? }` from a global exception filter; unexpected errors return 500 without internals.
- Rate limits per IP and per session on auth and public-link routes.
- `/health` and `/health/ready` used by staging uptime checks.

**P1-02 · Seed and sample data (S)**
As a developer, I want `npm run db:seed` to create Genie Magnet (tenant #1) and a second test agency with sample data, so everyone works on the same realistic data.

- Seeds the agency with the Growth OS defaults (roles, packages, stages, question sets) and sample clients — never real client data without Genie Magnet's approval.
- A second agency exists in every environment except production, for cross-tenant checks.

**P1-03 · Audit log (M)**
As the owner, I want every change to clients, agreements, packages, invoices, roles and questionnaire answers recorded, so I can see who changed what and when.

- Written in the same transaction as the change, with actor, before/after for changed fields.
- Read-only list per record and per agency, filterable by user, entity and date.
- The application role cannot update or delete entries (already enforced by the database).

**P1-04 · Notifications, in-app and email (M)**
As a team member, I want notifications in the app and by email, with preferences, so I do not miss approvals and reminders.

- In-app notification centre (unread count, mark read); email via the worker from the agency's sending domain.
- Per-user preferences per notification type; quiet hours respected.

**P1-05 · File storage (M)**
As a user, I want to upload brand files and documents with previews, so onboarding and production files live with the record.

- S3-compatible storage (MinIO locally), per-agency key prefix, signed upload and download links that expire.
- Size and type limits; files linked to records through `files`.

**P1-06 · Job reliability (S)**
As an operator, I want failed jobs retried and then listed with their reason, so nothing silently disappears.

- Retries with exponential back-off; after the last try the job lands in an exceptions list with a retry action.
- Idempotency keys on reminder and message jobs (no duplicate sends on retry).

## Sign-in and permissions

**P1-07 · Better Auth spike (M)** — exit criteria in [ADR 0003](../adr/0003-authentication-better-auth.md). Owner: tech lead. Blocks P1-08 to P1-11.

**P1-08 · Sign in and sessions (M)**
As a team member, I want to sign in with email and password or Google, so I can use the app securely.

- Sign in, sign out, password reset by email; sessions expire after inactivity.
- The active agency comes from the session and replaces the development `x-agency-id` header everywhere.

**P1-09 · Invitations and roles (M)**
As the owner, I want to invite people by email with a role, so each person sees only what they should.

- Default roles (Owner, Manager, Team leader, Editor, Shooter, Script writer, Social media manager, Finance, HR, Freelancer, Client approver, Client viewer) that the agency can rename, copy or add to.
- An invitation expires after 7 days; accepting it creates the membership.
- A person can belong to more than one agency and switch between them.

**P1-10 · Two-factor authentication (S)**
As the owner, I want two-factor sign-in required for owner and finance roles, so money and settings are protected.

**P1-11 · Custom roles and the permission matrix (L)**
As the owner, I want to decide for each role what it may see, change and approve, so salaries, costs and other clients' data stay private — without asking the developers.

- A permission matrix in Settings (areas × roles: none / view / edit / approve), starting from the default for each role; sensitive areas (salaries, payroll, personal finance) are off unless granted.
- CASL abilities are built from the agency's saved matrix, enforced by a guard on every endpoint and used by the web app to hide actions.
- A permission change is audited and applies from the next request.
- Record-level rules (e.g. editors see their assigned videos).
- A permission-matrix test per role; a missing check fails CI.

## Settings

**P1-12 · Agency profile and branding (S)** — name, logo, colours, business stage, completion window (default 7 days), reminder days, languages used with clients.

**P1-13 · Packages (M)**
As the owner, I want to set up packages with price, videos and posts per month, platforms, shoot days and revision allowance, so agreements and quotas come from one place.

- Create, edit, archive; changes never alter signed agreements retroactively.

## CRM

**P1-14 · Leads and pipeline (M)** — pipeline stages the agency can rename, add and reorder (Won and Lost stay fixed); owner, source, value, next follow-up; board and list views.

**P1-15 · Calls and activities (S)** — log calls, meetings and notes; follow-up reminders.

**P1-16 · Proposals and discount approval (M)**
As a salesperson, I want to send a proposal with a discount, and have discounts above my limit approved by the owner, so pricing stays under control.

- Discounts up to the sales authority (10 % by default, configurable) are auto-approved; above it, the owner approves or rejects with a note.

**P1-17 · Deal won → client set up (M)**
As the account manager, when a deal is won I want the client, agreement, onboarding questionnaire and checklist created automatically, so onboarding starts the same day.

- Creates client and contacts, agreement from the package, questionnaire response (not yet sent), checklist; notifies the account manager.
- Runs in one transaction; the audit log shows each record created.

## Clients, agreements and invoices

**P1-18 · Clients and contacts (M)** — extends the Phase 0 endpoint: edit, archive, approvers, WhatsApp group link, account owner; list and profile screens.

**P1-19 · Agreements (M)** — package, terms, quotas per month, revision allowance, billing schedule, start/end, status; renewal-due flag 45 days before the end.

**P1-20 · Invoice settings and basic invoices (M)**
As finance, I want to set up our own invoice details once and then raise GST invoices with a PDF, so billing can start in the new system.

- Invoice settings: GSTIN, registered state, SAC code and tax rate per service, number format (e.g. `GM/{FY}/{0000}`), payment terms, bank details, logo.
- Tax split chosen automatically: CGST + SGST within the state, IGST for clients in other states.
- Manual invoices; PDF download; status draft / sent / paid.

## Onboarding engine

**P1-21 · Question builder and versions (L)**
As the owner, I want to add, edit, reorder and remove onboarding questions myself, so the questionnaires fit how my agency works.

- Client and agency templates start from the Growth OS question sets (Appendix C).
- For each question: text, help, type (text, long text, number, currency, single/multiple choice, table, file), required or within the window, the field its answer fills, and translations (e.g. Tamil).
- Edits go into a draft; publishing creates a new version; answers already given keep the version they were answered on.

**P1-22 · Responses, public link and assisted mode (L)**
As a client, I want to open a private link and answer at my own pace, and as an account manager I want to fill it with the client on a call, so onboarding works either way.

- Answers save as the person types; the link opens at the next unanswered question; tokens are single-purpose and stored hashed.
- Assisted mode records who entered each answer; both modes are always available, the agency picks the default.
- The client sees the questionnaire in the language chosen for them, where translations exist.
- Branching (`showIf`) and answer-to-field mapping (e.g. business stage → client profile).

**P1-23 · Progress and the onboarding gate (M)**
As the account manager, I want to see required and within-7-days progress and have checklist items tick themselves from answers, so I know when production can start.

- Gate opens when required sections and mandatory checklist items are done, or an exception is approved by the owner.
- Deeper sections never block work.

**P1-24 · Reminders and flag (M)**
As the account manager, I want reminders sent on day 2 and day 5 and a flag after the window, so answers come in without chasing.

- Email and in-app for now (WhatsApp in Phase 3); idempotent jobs; stop when complete.

**P1-25 · Outputs (M)**
As the account manager, I want the client profile and a draft Business Canvas built from answers, and as the owner I want packages, main goal and team roles set up from the agency questionnaire.

## Web app

**P1-26 · Data layer (M)** — generated API client (`packages/api-client`) with TanStack Query; session handling; role-aware navigation.

**P1-27 · Screens on real data (L)** — sign in, invitation, two-factor, Settings, CRM, Clients, Agreements, Invoices, Onboarding (internal, assisted, public link). The demo stays available behind a flag until each module is live.

## Operations

**P1-28 · Staging (M)** — deploy from `main` automatically with migrations; error tracking; uptime check; nightly backups; staging uses sample or consented data only.

**P1-29 · Genie Magnet sets up its own workspace (S)** — a guided half-day session in week 4: Janarthanan and Ashwin answer the agency questionnaire and enter their packages, team, roles and permissions, question changes and invoice settings on staging. We note anything the settings could not handle and fix it before the exit gate.

**P1-30 · Exit-gate scenario (M)**
An automated end-to-end test (and a live demo) of the whole phase:

1. The owner signs in with two-factor and invites a manager.
1. The owner creates a custom role and changes one permission, edits an onboarding question and sets the invoice number format; each change takes effect at once and is in the audit log.
1. The manager creates a lead, logs a call and sends a proposal with a discount that needs the owner's approval; the owner approves.
1. The deal is won; client, agreement and questionnaire are created automatically.
1. The client answers the required sections by link; the 7-day sections show pending and the reminder goes out (clock moved on staging).
1. The onboarding gate shows ready; the audit log shows every step.
1. A user of the second agency sees none of it.

---

**What Genie Magnet provides:** demo feedback and scope sign-off (week 1), hosting decision and sending domain (by week 3), and the half-day set-up session (week 4). Meta Business verification, the WhatsApp number, the Google Cloud project and Razorpay KYC should start now — they are needed in Phase 3.
