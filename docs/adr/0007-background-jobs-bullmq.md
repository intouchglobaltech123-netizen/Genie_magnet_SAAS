# ADR 0007 — Background jobs with BullMQ and Redis

- **Status:** Accepted · Phase 0 · skeleton implemented (`apps/worker`)

## Context

Much of the product happens outside a request: WhatsApp and email messages, onboarding reminders on day 2 and day 5, monthly cycle generation, Genie Assistant rules every hour, posting approved videos at their scheduled slot, and retries when a platform API fails.

## Decision

- **BullMQ on Redis**, three queues to start: `notifications`, `genie`, `publishing`.
- **Every job carries `agencyId`** and the worker sets it on the database transaction exactly like the API (ADR 0002), so RLS applies to background work too.
- **Payloads are validated with Zod** before any handler runs (`apps/worker/src/jobs.ts`); an invalid or unknown job fails immediately.
- **Idempotency:** a job id derived from the business key (e.g. `onboarding.remind:<responseId>:day2`) so retries and duplicate schedules never send twice.
- **Retries with back-off**, then an **exception queue** shown in the Automation module with the reason and a retry button.
- Scheduled work (hourly Genie rules, reminders) uses BullMQ repeatable jobs, one per agency.
- Quiet hours for client messages (no WhatsApp between 9 PM and 8 AM IST unless the agency changes it).

## Consequences

- Redis becomes part of every environment (local compose, staging, production).
- The worker scales separately from the API when publishing volume grows.
