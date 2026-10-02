# Phase 5 backlog — Add-on suites

**Goal:** an agency runs the whole business on the system: money and costing, people and payroll, and management.
**Exit gate (P5-23):** attendance is imported from the agency's own attendance export, leave is approved, and a month's payroll runs with payslips; expenses are allocated and the true cost per video is shown for a client; a 45-day strategic review is held in the system with the Round Table and its results released; goals and the revenue cascade come from the agency questionnaire, and the business diagnostic and road map are published.

**Self-service, like everything else.** Payroll rules and salary structures, the attendance file's columns, review agendas, and the health and diagnostic formulas are settings each agency fills in itself, starting from Growth OS defaults where there are any. Nothing is asked of Genie Magnet; statutory amounts (PF, ESI, professional tax, TDS) are entered by the agency as its own rules, never assumed by the app.

| ID    | Story                                                                                                                                                         | Size |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| P5-01 | **Finance** · Cost rates: each person's cost per hour (restricted, like salaries), equipment kits' day rates, the month's overheads                           | M    |
| P5-02 | Expenses and vendors: anyone submits with a receipt, finance approves, each allocated to a video, a client or overheads                                       | M    |
| P5-03 | True costing: labour, shoots and kit, expenses and overheads per video, client and package, with rework shown apart; margin against what the client pays      | L    |
| P5-04 | Collections: invoice drafts made by themselves from each agreement's billing terms, an ageing view, reminders                                                 | M    |
| P5-05 | Financial reports: contracted, invoiced, earned and collected each month, with margins; closing a month                                                       | M    |
| P5-06 | **People** · Employees and departments: profile, documents (restricted), bank details (encrypted)                                                             | M    |
| P5-07 | Attendance: imported from the agency's attendance export (any device or Excel), its own rules, corrections with approval                                      | M    |
| P5-08 | Leave: policies, requests, approvals, and clashes with shoots and due videos                                                                                  | M    |
| P5-09 | Payroll: salary structures, the agency's own deductions, the monthly run from attendance and leave, payslips, locking                                         | L    |
| P5-10 | Hiring: openings with the role's task document, candidates, interview scorecards, offer, joining (which invites them to the workspace)                        | M    |
| P5-11 | Performance and learning: KRAs and monthly scorecards, A/B player rating, leaderboard; learning paths and skill matrix                                        | M    |
| P5-12 | Daily data sheet: role templates, entries with manager and HR sign-off                                                                                        | S    |
| P5-13 | **Management** · Goals from company to department to person, and the revenue cascade from the agency's own ratios                                             | M    |
| P5-14 | STOP reviews: daily, 7-day, 14-day and 45-day, with the agency's agendas and a snapshot of the figures reviewed                                               | M    |
| P5-15 | Round Table: timed rounds in real time, moderation and release                                                                                                | M    |
| P5-16 | Decisions and commitments with owners and due dates, carried forward until done                                                                               | S    |
| P5-17 | SOPs and checklists with versions and doer / checker / approver, linked to PSS and KRAs                                                                       | M    |
| P5-18 | Business diagnostic (BFA scores, founder dependency) from the agency questionnaire, Strategic Road Map, scenario planner, client fitment map and health score | L    |
| P5-19 | Financial planner (Way To Fortune), for the owner only                                                                                                        | M    |
| P5-20 | **Operations** · Equipment and assets: register, custody, check-out and return against shoots, maintenance, depreciation                                      | M    |
| P5-21 | Projects and tasks                                                                                                                                            | M    |
| P5-22 | LinkedIn and X connections (our own apps, switched on in the last step; posted by hand meanwhile)                                                             | M    |
| P5-23 | Exit-gate scenario test                                                                                                                                       | M    |

## Progress

**P5-01 to P5-03 · Cost rates, expenses and true costing** — **Done.** Settings → Costing: each kit's cost for a shoot day and the month's overheads (finance), and each person's monthly cost and working hours from a given day (restricted like salaries — the owner by default; the audit log records that a rate changed, never the amount). Expenses: anyone adds what they spent with a category, vendor (added the first time), GST and what it counts towards (a video, a client, or overheads), then attaches the receipt; they see and change only their own while it waits; finance sees all, approves, or rejects with a reason, and the person is told. The finance role now approves expenses by default. Costing (finance): for a month, each client's month — what it pays (its running agreements' fees) against labour (time logged at each person's rate on that day), shoots (crew time and the kit's day rate once its day has come), approved expenses and a share of overheads by hours — with the margin; and each video's whole cost so far, with time logged while it was in revision shown as rework, against its share of the agreement's fee. People whose time has no rate are flagged. `/expenses`, `/vendors`, `/costing/rates|settings|videos|clients|summary`.
