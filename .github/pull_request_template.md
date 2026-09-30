## What and why

<!-- One or two sentences. Link the story: Closes #123 -->

## How it was tested

- [ ] Unit tests
- [ ] Cross-tenant tests (if the change touches data access)
- [ ] Checked in the browser (screenshots for UI changes)

## Checklist

- [ ] Every new table has `agency_id` and a row-level security policy
- [ ] Permissions checked with CASL on every new endpoint
- [ ] No secrets, personal data or client data in code, logs or fixtures
- [ ] Migrations are backwards compatible (or the rollout is described below)
- [ ] Docs / ADR updated if a decision changed

## Rollout notes

<!-- Feature flags, migrations, anything the reviewer or ops should know -->
