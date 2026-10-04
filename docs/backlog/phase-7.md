# Phase 7 backlog — Scale

**Goal:** the product grows for many agencies and for the team in the field: a mobile app, more connections, an API for agencies' own tools, shared templates, a smarter Genie Assistant, more currencies and languages, and options for large agencies.
**Exit gate (P7-16), for the first release:** a shooter opens today's shoot on a phone, ticks the kit list with no signal, logs clips against the videos and gets the client's sign-off; everything reaches the office when the phone is back online; their manager approves a leave request and an expense, with its receipt photographed, from the phone; and both get push notifications. Each later release is reviewed with Genie Magnet and the pilot agencies.

**One system, two screens.** The mobile app uses the same API, the same sign-in, the same roles and permissions and the same row-level security as the web app; nothing in it is a second copy of the rules. It is built with Expo and can be tried on phones through Expo Go; publishing it in the App Store and Google Play needs our Apple and Google developer accounts, in the last step.

| ID    | Story                                                                                                                                                 | Size |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| P7-01 | **Mobile** · The app: sign-in (and test sign-in on test servers), switching agency, sessions kept in the phone's secure storage                       | M    |
| P7-02 | **Mobile** · Today: my shoots, my videos due, what waits for my approval, my daily sheet                                                              | S    |
| P7-03 | **Mobile** · Shoots in the field: the shoot's videos and crew, the kit checklist, clip logging against each video, the client's sign-off on the phone | M    |
| P7-04 | **Mobile** · Working offline: the kit checklist, clip logs and sign-off are kept on the phone and sent when it is back online, without double entries | M    |
| P7-05 | **Mobile** · Daily sheet and attendance corrections from the phone                                                                                    | S    |
| P7-06 | **Mobile** · Approvals: leave, attendance corrections, expenses with a receipt photographed on the phone, discounts on proposals                      | M    |
| P7-07 | **Mobile** · Push notifications: the same kinds as the bell, each person's own choices, devices registered and removed                                | M    |
| P7-08 | **Mobile** · Store release: icons and splash screen, builds, TestFlight and Google Play internal testing (our developer accounts, last step)          | S    |
| P7-09 | **API** · A public API for agencies' own tools: keys per agency with scopes, stored only as a hash, rate-limited, documented                          | M    |
| P7-10 | **API** · Webhooks: an agency's own addresses told when things happen (client won, video approved, invoice paid), signed, retried, with a log         | M    |
| P7-11 | **Templates** · A marketplace of packages, SOPs, checklists and questionnaires agencies share; publish, preview, import into one's own workspace      | M    |
| P7-12 | **Connectors** · Threads, Pinterest and Google Business Profile, through our own apps (approvals in the last step)                                    | M    |
| P7-13 | **Genie Assistant** · Performance insights from each client's post numbers, and suggested times to post                                               | M    |
| P7-14 | **Languages and currencies** · The app in more languages; quotes and invoices in other currencies for clients abroad                                  | M    |
| P7-15 | **Enterprise** · Single sign-on for an agency's own identity provider, a dedicated database on request, stronger compliance controls                  | L    |
| P7-16 | Exit-gate scenario test for the first release                                                                                                         | M    |

## Progress
