# Genie Magnet OS

The operating system for Genie Magnet's content agency — built by InTouch Global Tech for Genie Magnet first, and designed from day one to become a multi-tenant SaaS for digital-marketing agencies.

## Repo layout

| Path              | What                                                              | Status                                   |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| `apps/web`        | Next.js + React web app                                           | Clickable demo with sample data (hosted) |
| `apps/api`        | NestJS API — modular monolith, tenant context, OpenAPI at `/docs` | Phase 0 skeleton, tested                 |
| `apps/worker`     | BullMQ worker — reminders, WhatsApp, Genie Assistant, publishing  | Phase 0 skeleton, tested                 |
| `packages/shared` | Domain enums and Zod schemas shared by every app                  | Phase 0                                  |
| `packages/db`     | Prisma 7 schema v0, migrations with row-level security            | Phase 0, cross-tenant suite passing      |
| `packages/config` | Shared TypeScript settings                                        | Phase 0                                  |
| `infra`           | Local PostgreSQL, Redis, MinIO and Mailpit (Docker Compose)       | Phase 0                                  |
| `apps/mobile`     | React Native + Expo field app                                     | Phase 7                                  |

## Run the demo

```bash
npm install
npm run dev
```

Open http://localhost:3000. Use the avatar menu (top right) to switch roles or reset demo data.

## Build the product

See **[docs/ENGINEERING.md](docs/ENGINEERING.md)** for setup, commands and the rules every change follows, **[docs/adr](docs/adr/README.md)** for architecture decisions, and **[docs/database/erd-v0.md](docs/database/erd-v0.md)** for the database design.

```bash
npm test            # every suite, including the cross-tenant isolation tests
npm run typecheck
```
