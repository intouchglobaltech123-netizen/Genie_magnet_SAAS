# Staging — the real app on a shared test server

Staging runs the real app (`/app`) for testing with **sample data only**: the sample agencies, test sign-in on, email confirmation off. It is a separate Railway project from the clickable demo (see [DEPLOY_RAILWAY.md](DEPLOY_RAILWAY.md)), so nothing done there touches the demo.

Three services in one Railway project:

| Service    | What it is                                                                | Config file                |
| ---------- | ------------------------------------------------------------------------- | -------------------------- |
| `Postgres` | Railway's PostgreSQL                                                      | —                          |
| `api`      | The API, with background jobs in the same process, and a volume for files | `apps/api/railway.json`    |
| `web`      | The web app: the demo at `/`, the real app at `/app`, talking to `api`    | `railway.json` (repo root) |

Every push to `main` redeploys both. Before each API deploy, `npm run db:setup` creates the app's own database roles (no way around row-level security), runs the migrations, and loads the sample agencies (`SEED_SAMPLE_DATA=true`). The API's health check is `/health`.

## One-time setup (about 20 minutes)

1. **New project** in Railway → **Deploy PostgreSQL**. Rename the service `Postgres` if Railway named it otherwise. In its **Backups** tab, switch on daily backups.
2. **+ New → GitHub repo** → `Genie_magnet_SAAS`, branch `main`. Rename the service `api`. In **Settings**:
   - Root directory: leave empty (the repo root — the API needs the shared packages).
   - **Config file path**: `/apps/api/railway.json`.
   - **Networking → Generate domain** (uploads go straight to the API, so it needs its own address).
   - Right-click the service → **Attach volume**, mount path `/data`.
3. **+ New → GitHub repo** → the same repo again. Rename it `web`. In **Settings → Networking → Generate domain**. Leave the config file path empty (it uses `railway.json` at the root).
4. Set the variables below (**Variables → Raw editor** pastes them all at once), replacing the two addresses with the domains from steps 2 and 3. `${{…}}` are Railway references: leave them as written.
5. Deploy `api`, then `web`. Open `https://<web domain>/app` and pick a sample person to sign in as.

### `api` variables

```env
NODE_ENV="production"
APP_ENV="staging"
SEED_SAMPLE_DATA="true"
DATABASE_OWNER_URL="${{Postgres.DATABASE_URL}}"
APP_DB_PASSWORD="${{secret(32)}}"
AUTH_DB_PASSWORD="${{secret(32)}}"
DATABASE_URL="postgresql://genie_app:${{APP_DB_PASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}"
AUTH_DATABASE_URL="postgresql://genie_auth:${{AUTH_DB_PASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}"
AUTH_MODE="better-auth"
BETTER_AUTH_SECRET="${{secret(48)}}"
BETTER_AUTH_URL="https://<web domain>"
WEB_ORIGIN="https://<web domain>"
PUBLIC_API_URL="https://<api domain>"
TEST_SIGN_IN="true"
REQUIRE_EMAIL_VERIFICATION="false"
TRUST_PROXY="1"
FILES_DIR="/data/files"
FILES_SECRET="${{secret(48)}}"
RUN_JOBS="true"
```

### `web` variables

```env
API_URL="http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}"
```

The web app forwards `/api/*` to the API over Railway's private network, so sign-in cookies stay on the web app's own address.

## What each setting does

- `APP_ENV="staging"` says this server holds sample data only: it runs like production, but may keep test sign-in on and email confirmation off. On a server marked `production` the API refuses to start with either.
- `DATABASE_OWNER_URL` is used only by `db:setup` (roles and migrations). The API itself connects as `genie_app`, which row-level security always applies to, and sign-in as `genie_auth`, which reaches only the sign-in tables.
- `RUN_JOBS="true"` runs the background jobs (the morning checks and reminders) inside the API. When the API needs more than one copy, turn it off there and add a `worker` service with the same settings and start command `node apps/api/dist/worker.js`.
- `FILES_DIR` keeps uploads on the volume; without the volume they are lost on each deploy.

## Optional

- **Uptime check**: point any uptime monitor at `https://<api domain>/health` (answers 200 when the API and database are up).
- **Errors**: the API writes one JSON line per request and error; Railway's **Logs** tab filters them (for example `level:error`).

## Moving to real data later

Real use is a separate project (or environment) with `APP_ENV="production"`, no `SEED_SAMPLE_DATA`, `TEST_SIGN_IN` off and email confirmation on — which needs the last step (email sending, two-factor, Google sign-in) done first.
