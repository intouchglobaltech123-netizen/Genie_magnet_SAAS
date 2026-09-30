# ADR 0001 — A modular monolith API plus one background worker

- **Status:** Accepted · Phase 0 · 30 Sep 2026
- **Deciders:** Tech lead, InTouch Global Tech

## Context

Genie Magnet OS has about 50 modules that share the same records: a client appears in CRM, onboarding, content, production, billing and reviews. The team is small (tech lead, three developers, part-time QA), and the product must become a multi-tenant SaaS without a rewrite.

## Decision

- One NestJS API (`apps/api`) organised as **business modules** — `clients`, `agreements`, `onboarding`, `content`, `production`, `publishing`, `billing`, `reviews`, … Each module owns its folder (controller, service, DTO schemas) and its tables.
- A module talks to another module **only through that module's service**, never through its tables.
- One **worker** (`apps/worker`) runs everything that is slow, scheduled or retried: WhatsApp and email, onboarding reminders, Genie Assistant rules, publishing to platforms. It shares `@gm/db` and `@gm/shared` with the API.
- The web app (`apps/web`, Next.js) calls the API; it never reads the database directly.

## Consequences

- One deployable API and one worker — simple to host on Genie Magnet's VPS in stage 1 and on managed cloud in stage 2.
- Module boundaries keep the option of extracting a service later (publishing is the most likely candidate) without designing for it now.
- Discipline is needed to keep modules from reaching into each other's tables; code review checks it, and each module's tables are listed in `docs/database/erd-v0.md`.

## Alternatives considered

- **Microservices from day one** — too much operational cost for the team size, and cross-module transactions (e.g. script approved → video created) become distributed.
- **Next.js API routes only** — no good home for background jobs, queues and long-running work.
