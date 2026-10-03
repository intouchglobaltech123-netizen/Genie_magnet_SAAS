# Load test and restore drill

Phase 6, story P6-14. Both are scripts in `scripts/`, run against a server with the sample data — locally, or on
staging — and run again on the production hosting before launch (last step).

## Load test: ten times Genie Magnet's load

`node scripts/load-test.mjs` signs in Genie Magnet's twelve sample people (test sign-in, so never on a server with
real data) and turns each into ten virtual users: 120 people working at once. Each opens the screens their role can see
(Home, notifications, clients, videos, leads, invoices, packages, agreements, team, goals, projects, equipment) at a
person's pace — one every 2 to 6 seconds — for a minute. It prints throughput and response times per route, and fails
if the 95th percentile is over 500 ms or more than 1% of answers are errors.

```
node scripts/load-test.mjs --api https://api.staging.example --origin https://staging.example
node scripts/load-test.mjs --per-person 30 --seconds 40      # thirty times, for headroom
```

### Results on the development laptop

The API built for production on one process, with its PostgreSQL on the same Windows laptop.

| Load                    | Requests | Per minute | p50   | p95   | p99    | Errors |
| ----------------------- | -------- | ---------- | ----- | ----- | ------ | ------ |
| 10× (120 virtual users) | 1,811    | 1,649      | 12 ms | 23 ms | 34 ms  | none   |
| 30× (360 virtual users) | 3,660    | 4,777      | 20 ms | 87 ms | 167 ms | none   |

Both pass with a wide margin. At thirty times, the whole agency is still under its own limit (6,000 requests a
minute) and each person under theirs (300 a minute on each route). The production host's numbers go here when it is
set up.

## Restore drill

Backups are taken by the database host (daily at least, with point-in-time recovery where the host offers it; chosen with production hosting). A backup is only as good as the last time it was
restored, so before launch and then every quarter:

1. Restore the latest backup into a **new** database on the same host (never over the live one). With the host's own
   restore, or by hand:
   ```
   pg_dump --format=custom --no-owner --file=genie.dump "$SOURCE_URL"
   createdb genie_restore && pg_restore --dbname="$RESTORED_URL" --no-owner --role=genie_owner genie.dump
   ```
   The `genie_app` and `genie_auth` roles belong to the server, not the database: create them first on a new server
   (`scripts/db-setup.mjs`).
2. Compare it with the live database, connected as the role backups are taken with (one that reads past row-level
   security):
   ```
   node scripts/verify-restore.mjs "$SOURCE_URL" "$RESTORED_URL"
   ```
   It compares the tables, the rows in each, row-level security (on and forced) and the policies, the grants to the
   API's roles, the functions that run as their owner (deleting a workspace, removing sample data), and the migrations
   applied; and it checks that every table holding agency data has row-level security forced in the restored copy —
   the thing a careless restore loses. Rows written to the live database after the backup show as differences; take
   the drill from a quiet moment or compare against a copy taken at the same time.
3. Point a staging API at the restored database and sign in, as a last look.
4. Drop the restored database, and note the date and the time it took here.

### Drills

| Date (IST) | Where              | What                                                                                                          | Result                                                                                                         |
| ---------- | ------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 3 Oct 2026 | Development laptop | Copy of the development database (122 tables, 706 rows) compared with the original                            | Passed                                                                                                         |
| 3 Oct 2026 | Development laptop | The same copy with forced row-level security switched off on `clients` and a lead deleted, to prove the check | Failed, as it should: the security switched off, and the lead and the proposal that went with it, all reported |
