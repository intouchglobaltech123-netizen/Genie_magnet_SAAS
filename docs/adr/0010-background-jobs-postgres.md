# ADR 0010 — Background jobs in PostgreSQL, run by the API's code

- **Status:** Accepted · Phase 1 · implemented (`apps/api/src/jobs`)
- **Supersedes:** [ADR 0007](0007-background-jobs-bullmq.md) (BullMQ and Redis); amends [ADR 0001](0001-modular-monolith.md) on where the worker's code lives.

## Context

ADR 0007 chose BullMQ on Redis. When the first real jobs were written (daily reminders and checks, clearing unfinished uploads), three things pointed elsewhere:

- **A job must exist only if the change that needs it is saved.** With Redis, the job is queued after the database transaction commits, so a crash in between loses it (or, queued before, it runs for a change that was rolled back). A row in PostgreSQL is written in the same transaction.
- **Failed jobs are shown in the app with a retry button.** In PostgreSQL that is an ordinary table under row-level security, read through the same `TenantDb` as everything else.
- **One less service everywhere.** Local development runs without Docker (embedded PostgreSQL), tests run against a fresh database per suite, and a small agency's server needs only the database. The volume is small — a handful of jobs per agency per day now, a few thousand messages a day later — well within what PostgreSQL queues handle.

The jobs also need the business rules (who to tell, what counts as late), which live in the API's services. A separate worker package would have to copy them.

## Decision

- **A `jobs` table** (`agency_id`, name, payload, business key, status, attempts, next run, last error, result). The key is unique per agency, so the same reminder is never queued twice. Row-level security as for every table; the runner's own short transactions set `app.job_runner`, which reveals the jobs table and the list of agencies — nothing else (`claimJobs`, `releaseStuckJobs`, `scheduleJobs` in `@gm/db`).
- **Queued in the caller's transaction:** `JobsService.enqueue(tx, name, payload, { key, runAt })`.
- **Claimed with `FOR UPDATE SKIP LOCKED`**, so several runners never take the same job. Each job runs inside its own agency (`asSystem`) in one transaction that also marks it done — its work and its "done" are saved together, so a retry never repeats work that was saved.
- **Retries after 1 minute, 5 minutes, 30 minutes and 2 hours**; after the fifth try the job stays as **failed**, the people who may change settings are notified, and Settings → Background jobs lists it with **Try again**. Jobs left running by a stopped runner go back to the queue after 15 minutes.
- **Daily jobs** are queued for every agency each day with the key `<name>:<date>` and run at `JOBS_DAILY_AT` (UTC). Each works on the day it is for, so it can run late or be retried without telling anyone twice.
- **Where they run:** the runner is part of the API's code. `RUN_JOBS=true` runs it inside the API process (one server, local development); `node apps/api/dist/worker.js` runs the same code without the web server, for when the API and the worker scale separately. The `apps/worker` package is removed.
- Quiet hours for client messages (ADR 0007) still apply when WhatsApp and email sending arrive; those senders become jobs here.

## Consequences

- No Redis in any environment for now. The in-memory rate limit still assumes one API process (see Errors, logs and limits in ENGINEERING.md); a shared store comes when the API runs on several.
- Jobs that call outside services (WhatsApp, platforms) must keep their transaction short: call out, then record the result, with a business key so a retry does not send twice.
- If volume grows far beyond this (hundreds of thousands of jobs a day), revisit: the table can be partitioned or a queue service added behind `JobsService` without changing the jobs.
