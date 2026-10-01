# Architecture decision records

Short records of decisions that are expensive to change. Add one when a decision affects more than one module, the data model, security or hosting. Supersede rather than edit an accepted ADR.

| #                                          | Decision                                                    | Status                  |
| ------------------------------------------ | ----------------------------------------------------------- | ----------------------- |
| [0001](0001-modular-monolith.md)           | Modular monolith API plus one background worker             | Accepted                |
| [0002](0002-tenancy-row-level-security.md) | `agency_id` everywhere + forced PostgreSQL RLS              | Accepted · implemented  |
| [0003](0003-authentication-better-auth.md) | Better Auth, agency = organization                          | Accepted · spike passed |
| [0004](0004-authorization-casl.md)         | Permissions: the agency's own matrix, shared by API and web | Accepted · implemented  |
| [0005](0005-api-contract-openapi.md)       | REST + OpenAPI generated from shared schemas                | Accepted · started      |
| [0006](0006-shared-zod-schemas.md)         | One set of Zod schemas and enums                            | Accepted · implemented  |
| [0007](0007-background-jobs-bullmq.md)     | BullMQ + Redis; jobs carry `agencyId`                       | Accepted · skeleton     |
| [0008](0008-genie-assistant-ai-adapter.md) | Genie Assistant: rules first, model drafts, human decides   | Accepted · Phase 4      |
| [0009](0009-esm-prisma7-toolchain.md)      | ESM packages, Prisma 7, pinned versions                     | Accepted                |
