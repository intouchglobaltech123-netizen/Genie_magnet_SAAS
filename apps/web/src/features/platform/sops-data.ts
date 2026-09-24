import { kitItems, preShootItems } from "@/lib/mock/core";
import { EDIT_STEPS } from "@/lib/types";

export type Evidence = "photo" | "file" | "note" | "timestamp" | "signature" | "check";
export type SopStatus = "published" | "draft" | "in-review";

export interface SopStep {
  title: string;
  detail: string;
  role: string;
}

export interface SopCheck {
  item: string;
  evidence: Evidence;
  mandatory: boolean;
  group?: string;
}

export interface Sop {
  id: string;
  code: string;
  title: string;
  area: "Video shooting" | "Editing" | "Client onboarding" | "Client delivery" | "Sales" | "HR" | "Assets" | "Finance";
  owner: string;
  reviewer: string;
  version: string;
  roles: string[];
  status: SopStatus;
  updated: string;
  summary: string;
  doer: string;
  checker: string;
  approver: string;
  steps: SopStep[];
  checklist: SopCheck[];
  history: { version: string; date: string; by: string; note: string }[];
  activeRuns: number;
  runsThisMonth: number;
  failures: number;
}

const kitEvidence = (item: string): Evidence =>
  /Memory Card|Batteries|Camera \(/.test(item) ? "photo" : /Video Data Sheet/.test(item) ? "file" : "check";

export const sops: Sop[] = [
  {
    id: "sop-vid",
    code: "SOP-PRD-01",
    title: "Video shooting — kit, set readiness & footage protection",
    area: "Video shooting",
    owner: "Karthik Subramanian",
    reviewer: "Ashwin",
    version: "v1.3",
    roles: ["Camera Man", "Content Director", "Freelance camera"],
    status: "published",
    updated: "2026-09-12",
    summary: "From shoot sheet to protected footage. Mirrors the paper equipment checklist used on every shoot.",
    doer: "Camera Man",
    checker: "Content Director",
    approver: "Manager",
    steps: [
      { title: "Confirm shoot sheet", detail: "Project, batch no., call time, location and video codes confirmed the evening before.", role: "Content Director" },
      { title: "Pack kit (dual / single cam)", detail: "Tick every item on the kit list; photo of packed kit and empty memory cards.", role: "Camera Man" },
      { title: "Set readiness", detail: "Pre-shoot checklist before the client arrives — AC, water, chair, scripts, grooming kit.", role: "Camera Man" },
      { title: "Shoot & log clips", detail: "Record clip ranges (e.g. C0034–C0041) against each video code on the Video Data Sheet.", role: "Camera Man" },
      { title: "Video Protection (VP)", detail: "Copy footage to two drives, verify file count and size, then mark VP.", role: "Camera Man" },
      { title: "Return & check-in kit", detail: "Every item checked back in; shortages raised as an asset exception.", role: "Content Director" },
    ],
    checklist: [
      ...kitItems.dual.map((item) => ({ item, evidence: kitEvidence(item), mandatory: true, group: "Kit — dual cam" })),
      ...preShootItems.map((item) => ({ item, evidence: "check" as Evidence, mandatory: !/Refreshment|Grooming/.test(item), group: "Pre-shoot" })),
      { item: "Footage copied to 2 drives & verified", evidence: "file", mandatory: true, group: "Video Protection" },
      { item: "Call time met", evidence: "timestamp", mandatory: true, group: "Video Protection" },
      { item: "Kit returned — custodian sign-off", evidence: "signature", mandatory: true, group: "Video Protection" },
    ],
    history: [
      { version: "v1.3", date: "2026-09-12", by: "Karthik Subramanian", note: "Added Video Protection (VP) step and two-drive rule" },
      { version: "v1.2", date: "2026-06-03", by: "Karthik Subramanian", note: "Split kit list into dual-cam and single-cam" },
      { version: "v1.1", date: "2026-02-18", by: "Ashwin", note: "Added pre-shoot set readiness checklist" },
      { version: "v1.0", date: "2025-11-01", by: "Janarthanan", note: "Digitised from the paper equipment checklist" },
    ],
    activeRuns: 4,
    runsThisMonth: 22,
    failures: 3,
  },
  {
    id: "sop-edit",
    code: "SOP-POST-01",
    title: "Editing — 9-step edit workflow",
    area: "Editing",
    owner: "Divya Lakshmi",
    reviewer: "Karthik Subramanian",
    version: "v2.1",
    roles: ["Video Editor", "Senior Video Editor", "Freelance editor"],
    status: "published",
    updated: "2026-08-28",
    summary: "Every edit moves through the same nine steps before Internal QC. Steps are ticked per video code.",
    doer: "Video Editor",
    checker: "Senior Video Editor",
    approver: "Content Director",
    steps: EDIT_STEPS.map((title) => ({
      title,
      role: title === "Final overview" ? "Senior Video Editor" : "Video Editor",
      detail: {
        "Rough cut": "Assemble selects in script order; remove retakes and dead air.",
        "Video analyse": "Watch the full cut against the brief — pacing, hook in first 3 seconds, story clarity.",
        "B-rolls": "Layer product, location and cutaway shots over talking-head sections.",
        Text: "Add titles, lower thirds and captions in the client's brand fonts.",
        "Colour corrections": "Balance exposure and skin tones; apply the client LUT where agreed.",
        Transitions: "Clean, on-beat transitions — no default wipes.",
        BGM: "Licensed background music, ducked under dialogue (−18 dB).",
        Spelling: "Check every on-screen word, names and Tamil/English captions.",
        "Final overview": "Full playback at export resolution before sending to Internal QC.",
      }[title],
    })),
    checklist: [
      ...EDIT_STEPS.map((s) => ({ item: s, evidence: "check" as Evidence, mandatory: true, group: "Edit steps" })),
      { item: "Project file saved to Drive", evidence: "file", mandatory: true, group: "Hand-off" },
      { item: "Time logged against video code", evidence: "timestamp", mandatory: true, group: "Hand-off" },
      { item: "Notes for QC reviewer", evidence: "note", mandatory: false, group: "Hand-off" },
    ],
    history: [
      { version: "v2.1", date: "2026-08-28", by: "Divya Lakshmi", note: "Spelling step now covers Tamil captions" },
      { version: "v2.0", date: "2026-05-10", by: "Karthik Subramanian", note: "Reordered: Video analyse before B-rolls" },
      { version: "v1.0", date: "2025-11-01", by: "Janarthanan", note: "First version from editor whiteboard" },
    ],
    activeRuns: 17,
    runsThisMonth: 64,
    failures: 4,
  },
  {
    id: "sop-onb",
    code: "SOP-CS-01",
    title: "Client onboarding — brief to first shoot",
    area: "Client onboarding",
    owner: "Ashwin",
    reviewer: "Janarthanan",
    version: "v1.0",
    roles: ["Manager", "Sales & Marketing Lead", "Content Director"],
    status: "published",
    updated: "2026-07-15",
    summary: "Nothing is produced until the onboarding gate is passed: signed agreement, advance, brief, brand files and one approver.",
    doer: "Manager",
    checker: "Content Director",
    approver: "Founder",
    steps: [
      { title: "Kick-off call", detail: "Walk through agreement scope, units, revisions and turnaround.", role: "Manager" },
      { title: "Collect brand kit", detail: "Logo, fonts, colours, past content and competitor references.", role: "Manager" },
      { title: "Brief & content pillars", detail: "Audience, offers, tone and 3–4 content pillars signed off by the client.", role: "Content Director" },
      { title: "Name the approver", detail: "One client approver with WhatsApp and email for reviews.", role: "Manager" },
      { title: "Onboarding gate", detail: "Advance received and all items above complete → first cycle is generated.", role: "Founder" },
    ],
    checklist: [
      { item: "Signed agreement uploaded", evidence: "file", mandatory: true },
      { item: "Advance payment received", evidence: "file", mandatory: true },
      { item: "Brand kit received", evidence: "file", mandatory: true },
      { item: "Approver named", evidence: "note", mandatory: true },
      { item: "Kick-off call held", evidence: "timestamp", mandatory: true },
    ],
    history: [{ version: "v1.0", date: "2026-07-15", by: "Ashwin", note: "First version" }],
    activeRuns: 1,
    runsThisMonth: 2,
    failures: 0,
  },
  {
    id: "sop-del",
    code: "SOP-CS-02",
    title: "Client delivery — review, revisions & approval",
    area: "Client delivery",
    owner: "Ashwin",
    reviewer: "Janarthanan",
    version: "v1.2",
    roles: ["Manager", "Social Media Manager", "Senior Video Editor"],
    status: "in-review",
    updated: "2026-09-21",
    summary: "How a version reaches the client, how feedback is classified, and what counts as approval.",
    doer: "Manager",
    checker: "Senior Video Editor",
    approver: "Founder",
    steps: [
      { title: "Send for review", detail: "Share portal link after Internal QC pass; client response window 3 days.", role: "Manager" },
      { title: "Classify feedback", detail: "Agency correction · included revision · out-of-scope change request.", role: "Manager" },
      { title: "Revise & resend", detail: "New version with change notes; revision count updated.", role: "Senior Video Editor" },
      { title: "Record approval", detail: "Approval captured in portal or WhatsApp screenshot attached.", role: "Manager" },
    ],
    checklist: [
      { item: "Internal QC passed", evidence: "check", mandatory: true },
      { item: "Portal link sent", evidence: "timestamp", mandatory: true },
      { item: "Feedback classified", evidence: "note", mandatory: true },
      { item: "Client approval proof", evidence: "file", mandatory: true },
    ],
    history: [
      { version: "v1.2", date: "2026-09-21", by: "Ashwin", note: "Proposed: WhatsApp approval needs screenshot evidence" },
      { version: "v1.1", date: "2026-04-02", by: "Ashwin", note: "Added out-of-scope classification" },
      { version: "v1.0", date: "2025-12-01", by: "Janarthanan", note: "First version" },
    ],
    activeRuns: 9,
    runsThisMonth: 31,
    failures: 1,
  },
  {
    id: "sop-sales",
    code: "SOP-SAL-01",
    title: "Sales — lead to signed agreement",
    area: "Sales",
    owner: "Priya Venkatesh",
    reviewer: "Janarthanan",
    version: "v1.1",
    roles: ["Sales & Marketing Lead", "Founder"],
    status: "published",
    updated: "2026-06-20",
    summary: "Follow-up cadence, discovery questions, proposal format and discount authority (sales up to 10%).",
    doer: "Sales & Marketing Lead",
    checker: "Manager",
    approver: "Founder",
    steps: [
      { title: "Respond within 2 hours", detail: "Every new lead gets a call or WhatsApp within 2 working hours.", role: "Sales & Marketing Lead" },
      { title: "Discovery", detail: "Business, audience, goals, budget, decision maker.", role: "Sales & Marketing Lead" },
      { title: "Proposal", detail: "Package-based proposal from templates; custom scope needs manager review.", role: "Sales & Marketing Lead" },
      { title: "Discount check", detail: "Up to 10% on sales authority; above 10% needs founder approval.", role: "Founder" },
      { title: "Close & hand over", detail: "Agreement signed → onboarding SOP starts automatically.", role: "Manager" },
    ],
    checklist: [
      { item: "Discovery notes", evidence: "note", mandatory: true },
      { item: "Proposal PDF", evidence: "file", mandatory: true },
      { item: "Discount approval (if > 10%)", evidence: "signature", mandatory: true },
    ],
    history: [
      { version: "v1.1", date: "2026-06-20", by: "Priya Venkatesh", note: "Discount authority set at 10%" },
      { version: "v1.0", date: "2026-01-10", by: "Janarthanan", note: "First version" },
    ],
    activeRuns: 11,
    runsThisMonth: 14,
    failures: 1,
  },
  {
    id: "sop-hr",
    code: "SOP-HR-01",
    title: "HR — joining, daily data sheet & leave",
    area: "HR",
    owner: "Harini Selvam",
    reviewer: "Ashwin",
    version: "v0.9",
    roles: ["HR & Admin Executive", "All employees"],
    status: "draft",
    updated: "2026-09-18",
    summary: "Joining documents, daily data sheet sign-off by GM & HR, leave requests and conflict checks.",
    doer: "HR & Admin Executive",
    checker: "Manager",
    approver: "Founder",
    steps: [
      { title: "Joining kit", detail: "ID proof, bank details, signed offer, NDA.", role: "HR & Admin Executive" },
      { title: "Daily data sheet", detail: "Employee fills by 7 pm; GM & HR sign off next morning.", role: "All employees" },
      { title: "Leave request", detail: "Raised 3 days ahead; system flags shoot or deadline conflicts.", role: "All employees" },
    ],
    checklist: [
      { item: "Joining documents", evidence: "file", mandatory: true },
      { item: "Daily sheet signed", evidence: "signature", mandatory: true },
    ],
    history: [{ version: "v0.9", date: "2026-09-18", by: "Harini Selvam", note: "Draft for review" }],
    activeRuns: 0,
    runsThisMonth: 0,
    failures: 0,
  },
  {
    id: "sop-asset",
    code: "SOP-AST-01",
    title: "Assets — custody, check-out & return",
    area: "Assets",
    owner: "Naveen Raj",
    reviewer: "Ashwin",
    version: "v1.0",
    roles: ["Camera Man", "Technical Supporter", "Freelancers"],
    status: "published",
    updated: "2026-05-30",
    summary: "Every camera, lens and light has a custodian. Items not returned within 24 hours escalate.",
    doer: "Technical Supporter",
    checker: "Manager",
    approver: "Manager",
    steps: [
      { title: "Check-out", detail: "Scan tag, condition photo, custodian named.", role: "Technical Supporter" },
      { title: "Return within 24 hrs", detail: "Overdue items trigger a reminder then escalate to the manager.", role: "Camera Man" },
      { title: "Condition check", detail: "Damage or missing items logged with photo and cost.", role: "Technical Supporter" },
    ],
    checklist: [
      { item: "Condition photo at check-out", evidence: "photo", mandatory: true },
      { item: "Return timestamp", evidence: "timestamp", mandatory: true },
      { item: "Custodian signature", evidence: "signature", mandatory: true },
    ],
    history: [{ version: "v1.0", date: "2026-05-30", by: "Naveen Raj", note: "First version" }],
    activeRuns: 6,
    runsThisMonth: 19,
    failures: 2,
  },
  {
    id: "sop-fin",
    code: "SOP-FIN-01",
    title: "Finance — invoicing & collections",
    area: "Finance",
    owner: "Finance Desk",
    reviewer: "Janarthanan",
    version: "v1.4",
    roles: ["Finance", "Founder"],
    status: "published",
    updated: "2026-08-05",
    summary: "Invoices on the 1st for advance billing, reminders at 7/15/30 days, and reconciliation against bank.",
    doer: "Finance",
    checker: "Manager",
    approver: "Founder",
    steps: [
      { title: "Raise invoices", detail: "Advance-billing clients on the 1st; arrears clients after cycle close.", role: "Finance" },
      { title: "Reminders", detail: "Day 7 WhatsApp, day 15 email, day 30 founder call.", role: "Finance" },
      { title: "Reconcile", detail: "Match receipts to invoices weekly; partial payments noted.", role: "Finance" },
    ],
    checklist: [
      { item: "Invoice PDF", evidence: "file", mandatory: true },
      { item: "Bank receipt matched", evidence: "file", mandatory: true },
      { item: "Reminder log", evidence: "note", mandatory: false },
    ],
    history: [
      { version: "v1.4", date: "2026-08-05", by: "Finance Desk", note: "Added day-30 founder call" },
      { version: "v1.3", date: "2026-03-01", by: "Finance Desk", note: "GST invoice format updated" },
    ],
    activeRuns: 5,
    runsThisMonth: 12,
    failures: 0,
  },
];

export const complianceEvents = [
  { date: "2026-09-24", sop: "SOP-PRD-01", kind: "failure" as const, text: "Kit return — 1 memory card missing after Kaveri testimonial shoot", who: "Vignesh Kumar" },
  { date: "2026-09-23", sop: "SOP-POST-01", kind: "failure" as const, text: "Spelling step ticked but caption typo caught at Internal QC (NVD-0926-02)", who: "Surya Prakash" },
  { date: "2026-09-22", sop: "SOP-PRD-01", kind: "exception" as const, text: "Single-cam kit used for dual-cam brief — approved by manager (camera in service)", who: "Ashwin" },
  { date: "2026-09-19", sop: "SOP-AST-01", kind: "failure" as const, text: "Godox light returned 31 hrs late — auto-escalated", who: "Gokul Das" },
  { date: "2026-09-17", sop: "SOP-SAL-01", kind: "exception" as const, text: "12% discount for Balaji Textiles — pending founder approval", who: "Priya Venkatesh" },
  { date: "2026-09-12", sop: "SOP-PRD-01", kind: "failure" as const, text: "VP not marked within 12 hrs of shoot (SLS batch 14)", who: "Vignesh Kumar" },
];

export const evidenceMeta: Record<Evidence, { label: string }> = {
  photo: { label: "Photo" },
  file: { label: "File" },
  note: { label: "Note" },
  timestamp: { label: "Timestamp" },
  signature: { label: "Signature" },
  check: { label: "Tick" },
};
