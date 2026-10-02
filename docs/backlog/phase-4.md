# Phase 4 backlog — Genie Assistant

**Goal:** Genie Assistant watches the live data, finds what has slipped, drafts the next step, and a person approves it (ADR 0008: rules find, the model only drafts, a person decides).
**Exit gate (P4-12):** a video idle in editing for 3 days raises an insight for the team leader; the team leader asks for a WhatsApp nudge draft, edits it and sends it; the social media manager asks for a caption draft on an approved video and approves it with small edits; Ask Genie answers "Which Kaveri videos are waiting on the client?" with the right videos and links, and an editor asking the same sees only their own work; the owner's usage view shows the agency's AI usage.

**Self-service, like everything else.** Each agency switches drafting on itself, sets its own monthly AI budget and how long AI conversations are kept, and its own approved captions and scripts are the examples the drafts learn from. Nothing is asked of Genie Magnet. Until the model is switched on for a server (`ANTHROPIC_API_KEY`), drafts come from a stand-in so every screen can be tried; the rules never need the model.

| ID    | Story                                                                                                                                                                          | Size |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| P4-01 | Rules with thresholds each agency sets (Settings → Genie Assistant); evaluated every morning and on request                                                                    | M    |
| P4-02 | Insights: severity, who should act, the record it is about, open / done / dismissed / resolved by itself, one per finding (no repeats); notifications                          | M    |
| P4-03 | Rules: video stuck, revision loop, client waiting, behind quota, report due, invoice overdue, editor load, shoot readiness, client health, onboarding incomplete               | L    |
| P4-04 | Insights inbox (Genie Assistant page) and the Home card, limited to what each person may see                                                                                   | M    |
| P4-05 | Model adapter on the Anthropic SDK (Claude), with a stand-in for development and tests; drafting switched on by each agency                                                    | M    |
| P4-06 | Drafts: WhatsApp nudges from an insight, captions and thumbnail text for an approved video, content ideas, the monthly report summary — approve, edit or reject; edits tracked | L    |
| P4-07 | Context: the client's brand voice from onboarding and their past approved captions and scripts                                                                                 | M    |
| P4-08 | Ask Genie: questions answered with read-only tools over the agency's data, each checked against the asker's permissions; answers link to records                               | L    |
| P4-09 | AI usage metered per agency, feature and person; the agency's monthly budget checked before each call; a usage view for the owner                                              | M    |
| P4-10 | Retention: how long Ask Genie conversations and draft prompts are kept, set by each agency; cleared by the daily job                                                           | S    |
| P4-11 | Evaluation: the agency's own approved captions and scripts as an evaluation set, approval rate of drafts                                                                       | M    |
| P4-12 | Exit-gate scenario test                                                                                                                                                        | M    |

Margin (from the plan's rule list) waits for costs, which arrive with the finance add-on in Phase 5.

## Progress

**P4-01 to P4-04 · Rules and the insights inbox** — **Done.** Settings → Genie Assistant lists the ten rules with what each looks for; each agency switches them on or off and sets each threshold within its range. The rules run every morning (job `genie.rules`, looking at the agency as of that morning) and when someone presses Look again now. Each finding is one insight — never raised twice, kept up to date (and made urgent as it gets worse) while the rule still finds it, cleared by itself when it no longer does, raised again if it comes back; dismissed and done ones stay as the person left them. Whoever should act (the editor, the client's account owner, the shoot's director) and the people the rule names (team leaders for production rules) are notified once. The Genie Assistant page and the Home card show only what each person may see: the rule's access to its area, and only their own when their role sees its own work (an editor sees their stuck videos, not clients' health). `/genie/settings`, `/genie/insights`, `/genie/run`.
