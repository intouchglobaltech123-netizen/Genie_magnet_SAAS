# ADR 0008 — Genie Assistant: rules first, the model drafts, a person approves

- **Status:** Accepted · Phase 0 · built in Phase 4 (demo behaviour in `apps/web/src/features/genie`)

## Context

Genie Assistant finds what has slipped (approvals waiting, overloaded editors, overdue invoices, open onboarding sections), drafts the message or task, and answers questions about the agency ("Ask Genie"). Clients and agency owners must be able to trust every number, and nothing may be sent without a person.

## Decision

1. **Rules produce findings and numbers.** Each rule is plain code over our data (e.g. "client approval waiting > 2 days"), stores an `Insight` with its evidence and a `dedupeKey`, and never calls a model.
2. **The model only writes drafts** (WhatsApp reminder, renewal email, monthly report summary, content ideas) from the rule's evidence and the client's brand voice from onboarding.
3. **A person approves, edits or dismisses** every draft. Approvals and edits are written to the audit log.
4. **Ask Genie** answers through read-only tools (e.g. `list_videos_due`, `client_summary`) that run under the asking user's agency and CASL permissions, and every answer cites its sources.
5. **Provider adapter.** A small interface (`draft()`, `answer()`) with one implementation: **Claude through the official Anthropic SDK** (`@anthropic-ai/sdk`), model `claude-opus-5-5`, thinking on and effort set per task (low for short reminders, higher for reports and Ask Genie), structured outputs for drafts, prompt caching for the brand-voice context, the Message Batches API for the nightly report drafts.
6. **Safeguards.** Refusals and failures fall back to a plain template — the rule's finding is still shown. Token usage is metered per agency (plan limits in the SaaS). Client data is not used for training; the data-processing terms are signed before Phase 4.
7. **Off switch.** An agency can turn drafting off; rules and reminders keep working with templates.

## Consequences

- Genie Assistant stays useful without the model and cheap to run — most value comes from the rules.
- Prompts and tool definitions live in the repo with evals (Phase 4) so model upgrades are measured, not guessed.
