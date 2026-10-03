# Security review against the OWASP Top 10 (2021)

Phase 6, story P6-14. A review of the code as it stands, against each of the OWASP Top 10 categories: what protects
the platform, what this review changed, and what is left for later, with when. It is not a penetration test: an outside
firm tests the hosted platform before launch (last step).

## What this review changed

- **Security headers** on every API answer (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, `Cache-Control: no-store` unless a route sets its own, HSTS over HTTPS) and on every
  web page (`nosniff`, `X-Frame-Options: DENY`, a `Permissions-Policy` switching off camera, microphone and location,
  HSTS in production, no `X-Powered-By`).
- **No referrer from private-link pages.** The client portal and onboarding questionnaires carry their token in the
  address (`/app/c/<token>`, `/app/q/<token>`, and `/c/`, `/q/` on an agency's own address). These pages now send no
  `Referer` at all, so a link a client follows from the portal (a published post, a payment page) never carries the
  token to another site. Other pages send only the origin.
- **A limit for each agency as a whole** (`RATE_LIMIT_AGENCY_PER_MINUTE`, 6,000 a minute by default), on top of each
  person's limit on each route, so one agency's scripts or a runaway screen cannot slow the platform for the others.
- **The interactive API docs are off on servers with real data** (`/docs`; `API_DOCS=true` switches them on). They
  map every route; they stay on locally and on staging.

## A01 Broken access control

- Every table holding an agency's data (115 of them) has row-level security **on and forced**, so the owner role is
  bound too; the API connects as `genie_app` (no superuser, no `BYPASSRLS`) and sets the agency per transaction. A
  query that forgets its agency returns nothing rather than another agency's rows. The restore drill checks this on any
  restored database.
- Every route declares who may call it (`@Can(area, level)`, `@Staff`, `@Platform`, `@Public`): a route without a rule
  fails CI, and the permission guard refuses it anyway. Tests check the main screens against every default role.
- The owner alone exports data or deletes the workspace; nobody approves their own leave, corrections or expenses
  except the owner; salaries and personal planners stay closed even to platform support.
- The platform's support team sees an agency only on its consent, for a time and at a level the agency chose, under a
  sealed cookie bound to the person; everything it does is in the agency's audit log.
- Client portal and questionnaire links are 24 random bytes, stored only as a SHA-256 hash (and, encrypted, so the app
  can resend them); a new link stops the old one. File downloads use short-lived signed tokens.

## A02 Cryptographic failures

- Keys and tokens the platform keeps for agencies (WhatsApp, payments, social accounts) and bank account and PAN
  numbers are sealed with AES-256-GCM, with a key derived from `SECRETS_KEY`; exports never include them.
- Passwords are hashed by Better Auth (scrypt), at least 10 characters.
- HSTS is sent in production; TLS itself is the host's (last step), as are certificates for agencies' own addresses,
  which are issued only for verified addresses (`GET /domains/allowed`).

## A03 Injection

- Queries go through Prisma, parameterised; raw SQL uses tagged templates. The one dynamic statement — the export's
  `SELECT * FROM "<table>"` — takes its table names from the database catalogue, not from a request. Database
  functions build statements with `format('%I')`.
- Every request body and query is checked with the shared Zod schemas before it reaches a service.
- React escapes everything it renders. The only raw HTML is the fixed theme script in the root layout; the agency's
  brand colours are written into a `<style>` only after validation as `#rrggbb`.

## A04 Insecure design

- Tenancy by design (ADR 0002), with grace periods and confirmations for anything that cannot be undone (deleting a
  workspace: the agency's name typed, 30 days to change one's mind; sample data removal keeps invoices issued).
- The audit log cannot be changed by the API's own role.
- Test sign-in (choosing a person without a password) is refused by configuration on any server holding real data.

## A05 Security misconfiguration

- Headers as above; CORS allows only `WEB_ORIGIN`, with credentials; errors answer in one shape and a 500 never shows
  internals, only a request id.
- Configuration is validated at start-up: production refuses the development agency header, test sign-in, a missing
  secret or email confirmation off.
- **Left for later:** a Content Security Policy. Next.js needs per-request nonces for its inline scripts, which comes
  with production hosting; clickjacking is already covered by `X-Frame-Options`.

## A06 Vulnerable and outdated components

`npm audit --omit=dev` reports four high-severity advisories, all in packages the platform never runs:

| Package        | Comes through                                                   | Why it does not apply                                                   |
| -------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `mysql2`       | Better Auth's optional MySQL support, and Prisma's command line | The platform uses PostgreSQL only; the MySQL driver is never loaded     |
| `deepmerge-ts` | Prisma's configuration loader (`@prisma/config`)                | Runs only in Prisma's command-line tools, on our own configuration file |

The only automatic fix moves Prisma back a major version, so they are accepted for now and checked again before
launch. **Before launch:** dependency alerts on the repository, and `npm audit` in CI.

## A07 Identification and authentication failures

- Sessions are Better Auth's HttpOnly cookies (secure over HTTPS), with requests only from trusted origins; sign-in
  and sign-up are rate-limited per IP (100 a minute, and 3 every 10 seconds for sign-in itself).
- **Last step (decided with the user):** email confirmation, two-factor sign-in and Google sign-in.

## A08 Software and data integrity failures

- Webhooks (Razorpay, Stripe, WhatsApp) are accepted only with a valid signature over the exact bytes received, and
  each payment is processed once however often it arrives.
- Database changes are versioned migrations, applied in order; `package-lock.json` pins every dependency.

## A09 Security logging and monitoring failures

- Every request is logged with its request id, person and agency (passwords, tokens, secrets, cookies redacted);
  every change is in the agency's audit log, with support visits marked; failed background jobs are listed for the
  agency and the platform console.
- **With production hosting:** log retention and alerts on error rates and failed jobs.

## A10 Server-side request forgery

- The API calls only fixed providers (Meta, Google, LinkedIn, X, Razorpay, Stripe, Anthropic) at addresses from its
  own configuration, plus upload addresses those providers return. No address typed by a user is ever fetched; an
  agency's own portal address is only looked up in DNS.
