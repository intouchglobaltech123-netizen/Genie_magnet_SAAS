# Deploying the demo on Railway

The repo is ready to deploy: `railway.json` at the root tells Railway to run `npm run build` and `npm run start`. The health check is `/api/health`.

## One-time setup (about 10 minutes)

1. Sign in at https://railway.com with GitHub.
2. **New Project → Deploy from GitHub repo** → pick `Genie_magnet_SAAS`, branch `main`. Leave the root directory empty (the repo root).
3. Open the service → **Variables** → add:

   | Variable | Value | Why |
   |---|---|---|
   | `DEMO_PASSCODE` | a code you choose, e.g. `genie2026` | Only people with the code can open the demo. Leave it unset to make the link public. |
   | `FEEDBACK_DIR` | `/data` | Where client feedback is saved. |

4. Right-click the service → **Attach volume**, mount path `/data`. Without a volume, feedback is wiped on every redeploy.
5. **Settings → Networking → Generate Domain** to get the public link (for example `agency-os-demo.up.railway.app`).
6. Every push to `main` redeploys automatically.

## What to send the client

- The link and the access code.
- "Sign in with any email plus the access code. Use the **Feedback** button (bottom right) on any screen to tell us what to change. Use the profile menu to switch roles."

## Reading the feedback

Open **Profile menu → Feedback inbox** (`/feedback`). Each comment records the screen, the role and the person. Use **Export CSV** to turn it into the rework list. Mark items **Planned**, **Done** or **Won't do** as the team works through them.

## Notes

- Demo data (videos moved, leads added and so on) is stored in each viewer's own browser. One reviewer's clicks never change what another reviewer sees. **Reset demo data** in the profile menu restores the original state.
- Search engines are told not to index the site.
