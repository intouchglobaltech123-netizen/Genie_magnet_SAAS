# Phase 2 backlog — Production pipeline (outline)

**Goal:** a video goes from idea to published, with every step recorded.
**Exit gate:** three to five real Genie Magnet videos flow from idea to published on staging.

Stories are refined into full acceptance criteria near the end of Phase 1. Checklists (kit, edit steps, QC) are editable by each agency and start from Growth OS defaults, so nothing waits on Genie Magnet. They import their own videos in progress (P2-16); we never import data for them. The demo screens built in Phase 0 are the reference for each story.

| ID    | Story                                                                                                             | Size |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ---- |
| P2-01 | Monthly cycles generated from agreements; planned vs delivered; carry-forward rules                               | M    |
| P2-02 | Idea bank with content pillars; Genie Assistant suggestions as drafts (rules only until Phase 4)                  | M    |
| P2-03 | Monthly topic list; client picks recorded by the team (portal and WhatsApp picks in Phase 3)                      | M    |
| P2-04 | Research notes and references per content item                                                                    | S    |
| P2-05 | Scripts with versions, comments and the approval record; approval creates the video                               | L    |
| P2-06 | Shoots: schedule, shoot sheet, crew, kit checklist templates (editable), clip logging                             | L    |
| P2-07 | Video codes with a configurable format (KVR-0926-05) and the tracking-sheet view                                  | M    |
| P2-08 | Video stage machine: ten stages, allowed moves, checks on each move, stage history                                | L    |
| P2-09 | Editing: the 9-step checklist, editor self-review, allocation and due dates                                       | M    |
| P2-10 | Edit-step and Internal QC checklists (editable) with pass/fail and notes; failed items return to the editor       | M    |
| P2-11 | Revisions: agency correction / included revision / change request; allowance counters; CR quote                   | L    |
| P2-12 | Publishing (manual): platforms per client, schedule slots, monthly quota, captions, proof link                    | M    |
| P2-13 | Time entries against videos and shoots; calendar events for shoots and deadlines                                  | M    |
| P2-14 | Notifications: assignment, due soon, QC failed, revision requested                                                | S    |
| P2-15 | Screens on the API: Content, Production board/list, video detail, Shoots & Kit, QC, Revisions, Publishing, Cycles | L    |
| P2-16 | Self-service import of videos in progress from their tracking sheet (same importer as P1-31)                      | M    |
| P2-17 | Exit-gate scenario test with 3–5 real videos                                                                      | M    |

## Progress

**P2-01 · Monthly cycles** — **Done.** A month per running agreement (set up when its first video is made, or for every running agreement from Monthly delivery): promised (including anything carried in) against delivered, in the making, planned and not started. A past month is closed by someone who may approve agreements: carry the shortfall to the next month, credit the client (the month's fee per video), or the client gives them up (with a reason). `/cycles`; screen Monthly delivery.

**P2-02 · Idea bank and pillars** — **Done**, without suggestions: each client's content pillars, ideas per pillar and format. Suggested ideas come with the assistant.

**P2-03 · Topic list** — **Done.** The month's list per client from the idea bank, sent, the client's picks recorded by the team; confirming moves the picks to research and the rest back to the bank.

**P2-04 · Research** — **Done.** Notes and reference links per item; "research done" moves it to scripting.

**P2-05 · Scripts** — **Done.** Hook, script, call to action and on-screen text, saved as versions; review, then approved and sent by someone who may approve content; the client's answer recorded (changes with their note go back to the writer). Approval makes the video with the next code.

**P2-06 · Shoots** — **Done.** Schedule with crew, call time, location, batch and kit (videos added move to Shoot scheduled); the kit list packed, used and back; the before-the-shoot list; signatures (kit out, kit back, the client's sign-off, each with who and when) that set the status; clip numbers and footage protected per video; incidents for anything missing.

**P2-07 · Video codes and the sheet** — **Done.** The code format is set in Settings → Production (`{CLIENT}`, `{MM}`, `{YY}`, `{YYYY}`, `{00}`); the Sheet tab is the tracking sheet, with clip number and footage protected edited in place.

**P2-08 · Stage machine** — **Done.** Ten stages; each move is checked (footage protected before leaving Shot, every edit step before the quality check, the check passed and a version before the client, editing time over plan explained, published only from Publishing); the move menu shows why a stage is closed; every move kept in the history. Drag and drop on the board.

**P2-09 · Editing** — **Done.** The edit steps (Settings → Production) ticked with who and when, the editor, director and camera on each video, due and publish dates; editors see only their own videos.

**P2-10 · Quality check** — **Done.** The checks are passed or failed by someone who may approve production; a failure needs a note and goes back to the editor; after a revision the check starts again. Checklists can be ticked quickly or by two people at once without losing a tick.

**P2-11 · Revisions** — **Done.** The client's feedback is classified: our correction (no allowance used), included revision (counted against the agreement's allowance; refused once used up), or change request (estimate and days added, approved by the client before it is done).

**P2-12 · Publishing** — **Done** (by hand). Platforms per client on the client page; posts scheduled per platform with a caption; marked published with the post's link, the time and a screenshot, confirming the approved file was posted unchanged; the video is Published once all its posts are; the month's quota per client. Posting directly comes with the platform connections.

**P2-13 · Time and calendar** — **Done.** Time logged on videos (against the planned editing time per format) and on shoots, each person removing their own (whoever approves production, any); Production → Time shows the week's entries with each person's total. The Calendar shows shoots, videos due (late ones marked) and to publish, scheduled and published posts in India time, and agreements ending, by month, filtered by client; roles limited to their own work see only theirs. `/calendar`, `/time`, `/shoots/:id/time`.

**P2-14 · Notifications** — **Done:** video assigned, ready for the quality check, check failed, revision asked, script to approve and decided; each morning, videos due tomorrow and videos that became late, and on the 1st, last month to close.

**P2-15 · Screens** — **Done.** Content (board, topic lists, idea bank) and the item page; Production (board, sheet, quality check, revisions) and the video page; Shoots and the shoot sheet; Publishing (to publish, quotas, published); Monthly delivery; Settings → Production; videos and platforms on the client page; shortcuts on Home.

**P2-16 · Import of videos in progress** — **Done.** Import from Excel → Videos in progress: the agency's own tracking sheet (template to download), columns matched from the headings people use (Client, Video, Status, Deadline, Editor, VP, Clip no.…), clients by code or name, editors by name or email, stages from the words people write (QC, With client, Posted…), formats from Settings → Production. Their own video codes are kept, the next code is given otherwise; each video goes into its client's month. Work done before the app counts as done (edit steps past editing, the quality check past it), nobody is notified, and the import can be undone for 24 hours while nobody has worked on its videos. `/imports/videos`.

**P2-17 · Exit-gate scenario test** — **Done** as an automated story (`apps/api/src/exit-gate/phase-2.e2e.test.ts`) with three videos: ideas on the month's topic list and the client's three picks, research and scripts the client approves, one shoot for all three with the kit signed out and back and the client's sign-off, backup, edit steps, time and the quality check (one fails first), versions to the client (two approved, one revised as an included revision, checked again and approved as v2), scheduled and marked published with link and screenshot; the month shows 3 of 4 delivered, the calendar the shoot and the three posts, the time adds up, the stage history is complete, and the other agency sees none of it. The live run with real videos is Genie Magnet's own, on staging.
