# ADR 0006 — One set of Zod schemas and enums shared by every app

- **Status:** Accepted · Phase 0 · implemented (`packages/shared`)

## Decision

- `@gm/shared` holds the domain vocabulary (roles, Client Fitment Map quadrants, business stages, content and video stages, review cadences, platforms, question types) and the Zod schemas for inputs (client, package, questionnaire template, answers).
- The web app validates forms with them, the API validates request bodies with them, the worker validates job payloads with them.
- Growth OS names are kept as they are; only the AI is called Genie Assistant. Changing an enum value is a data migration and needs a PR note.
- Money is **whole rupees** (`int`), never floating point; dates without time are `date` columns.

## Consequences

- A rule changes in one place (e.g. video codes are 2–4 capital letters) and every app agrees.
- Zod 4 is used everywhere; JSON Schema for OpenAPI comes from `z.toJSONSchema` (ADR 0005).
