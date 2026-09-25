# Agency OS — Demo Script (≈15 minutes)

Before the meeting:

1. `npm run dev` from the repo root, open http://localhost:3000 in **one** browser tab (tabs share demo state).
2. Avatar menu (top-right) → **Reset demo data**. Pick light or dark with the moon/sun icon.
3. Zoom the browser to ~90% if the screen is small.

## Storyline

| # | Where | What to show | Say |
|---|---|---|---|
| 1 | **Dashboard** `/` | Revenue (contracted / invoiced / collected), delivery, margin, "Needs your attention" — approve the Balaji Textiles 12% discount | "One screen for the founder: exceptions only." |
| 2 | **CRM** `/crm` | Drag a lead to **Won** → *Convert to agreement* preview (client, agreement, onboarding, cycle, billing auto-created) | "A sale automatically sets up delivery." |
| 3 | **Agreements** `/agreements/a-kvr-01` | Package units, revision allowance, cycles, billing schedule, change history | "Original commitments are never overwritten." |
| 4 | **Video Production** `/production` | Board → Calendar tab (video calendar) → Sheet tab (digital version of the paper video list: code, urgency, clip no., **VP**, editor) | "Your paper sheet, live." |
| 5 | **Video detail** `/production/v-kvr-5` | Tick the 9 editing steps; try **Advance** early to show the gate; QC tab fail → stage held | "Nothing moves forward without the checks." |
| 6 | **Shoot sheet** `/shoots/sh-04` | Dual/single cam kit: Packed / Shooted / Received, giver/receiver sign, pre-shoot checklist, client signature | "Replaces the equipment paper form; works offline later." |
| 7 | **Client portal** (avatar → *Client*) → review "Founder story" | Comment at a timestamp, voice note, **Request changes** | "Client reviews the exact version." |
| 8 | **Revisions** `/revisions` | Classify: agency correction vs included revision vs out-of-scope; **Send v2 to client** | "Agency mistakes don't eat the client's revisions." |
| 9 | Back to portal → **Approve v2** | Approval tied to the version | "Silence is never approval." |
| 10 | **True Costing** `/costing` | Cost waterfall for a video; ₹2L camera → ₹150/hr example | "True cost and margin per video." |
| 11 | **Daily Data Sheet** `/daily-sheet` | Editor / SMM / Tech / HR sheets, counters, GM → HR sign-off, team overview | "Replaces the daily paper data sheets." |
| 12 | **Goals** `/goals` & **Reviews** `/reviews/rv-s7` | Goal tree + 45-day strategic review workspace (BT/BD, numbers, decisions → commitments, lock) | "Placeholder of your review system — we'll adapt it to your exact method." |
| 12b | **Round Table** `/round-table/rt-7` (or *Start Round Table* in the 45-day review) | Lobby fills up → **Start** → answer the 3 questions for your own round → set **Demo speed 10×** → buzzer + next person → **Manager review** (author names visible, hide the flagged comment on Surya) → **Release** → **My feedback**: anonymous answers, "You said" vs team, themes, commit to one improvement | "Everyone reviews everyone in timed rounds; the team sees feedback anonymously, only after the manager releases it." |
| 13 | **Financial Planner** `/planner` | Way To Fortune: setup, daily log, reports, money diagnostic → profile score | "Your WTF tool, built in, private per person." |
| 14 | **Module Map** `/modules` | Walk the 47 modules; mark **Approve / Change needed / Remove** live with Janarthanan; **Export** copies the feedback | "Tell us what to change." |

## Things to ask Janarthanan during the demo

- Exact 45 / 14 / 7-day and daily review structure (agenda, participants, numbers).
- Urgency icons: meaning of the three levels (we used Rush / Priority / Standard).
- Video code format (we used `CLIENT-MMYY-NN`, e.g. `KVR-0926-05`).
- VP (Video Protection) — confirm it means raw footage backed up & verified.
- Way To Fortune sheet quirks: intensity bands & profile bands in the formulas differ from the Score Guide text (we reproduced the formulas).
- Customer category thresholds (Awesome / Breadwinning / Convincing / Dangerous).

## Legend

Sidebar dots: **violet = Demo** (fully clickable) · **teal = Preview** (sample data) · **grey = Planned** (Phase 2 overview).
