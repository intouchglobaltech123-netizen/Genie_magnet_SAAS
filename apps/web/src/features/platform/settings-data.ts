export const ROLES = ["Founder", "Manager", "Sales", "Production", "Editor", "HR", "Finance", "Freelancer", "Client"] as const;
export type SettingsRole = (typeof ROLES)[number];

export const ACTIONS = ["view", "create", "edit", "approve", "export", "delete"] as const;
export type PermAction = (typeof ACTIONS)[number];

export const RECORDS = [
  "Leads & CRM",
  "Agreements & packages",
  "Clients",
  "Videos & tasks",
  "Shoots & kit",
  "SOPs & checklists",
  "Client reviews",
  "Daily data sheet",
  "Employees & HR",
  "Attendance & leave",
  "Payroll",
  "Invoices & collections",
  "Expenses",
  "Equipment & assets",
  "Company financial reports",
  "Personal finance planner",
  "Settings",
] as const;
export type RecordType = (typeof RECORDS)[number];

type Matrix = Record<RecordType, PermAction[]>;

const all: PermAction[] = [...ACTIONS];
const vce: PermAction[] = ["view", "create", "edit"];
const v: PermAction[] = ["view"];
const none: PermAction[] = [];

function build(defaults: Partial<Matrix>, fallback: PermAction[] = none): Matrix {
  return Object.fromEntries(RECORDS.map((r) => [r, defaults[r] ?? fallback])) as Matrix;
}

/** "Personal finance planner" is own-records-only for everyone — nobody can view another employee's entries. */
export const defaultMatrix: Record<SettingsRole, Matrix> = {
  Founder: build({ "Personal finance planner": ["view", "create", "edit", "delete"] }, all),
  Manager: build({
    "Leads & CRM": [...vce, "approve", "export"],
    "Agreements & packages": ["view", "create", "edit", "export"],
    Clients: [...vce, "export"],
    "Videos & tasks": [...vce, "approve", "export", "delete"],
    "Shoots & kit": [...vce, "approve"],
    "SOPs & checklists": [...vce, "approve"],
    "Client reviews": [...vce, "approve"],
    "Daily data sheet": ["view", "approve"],
    "Employees & HR": v,
    "Attendance & leave": ["view", "approve"],
    Expenses: ["view", "create", "approve"],
    "Equipment & assets": [...vce, "approve"],
    "Personal finance planner": ["view", "create", "edit", "delete"],
  }),
  Sales: build({
    "Leads & CRM": [...vce, "export"],
    "Agreements & packages": ["view", "create"],
    Clients: vce,
    "Daily data sheet": ["view", "create"],
    "Attendance & leave": ["view", "create"],
    Expenses: ["view", "create"],
    "Personal finance planner": ["view", "create", "edit", "delete"],
  }),
  Production: build({
    "Videos & tasks": vce,
    "Shoots & kit": vce,
    "SOPs & checklists": v,
    "Daily data sheet": ["view", "create"],
    "Attendance & leave": ["view", "create"],
    "Equipment & assets": ["view", "edit"],
    Expenses: ["view", "create"],
    "Personal finance planner": ["view", "create", "edit", "delete"],
  }),
  Editor: build({
    "Videos & tasks": ["view", "edit"],
    "SOPs & checklists": v,
    "Client reviews": ["view", "create"],
    "Daily data sheet": ["view", "create"],
    "Attendance & leave": ["view", "create"],
    "Personal finance planner": ["view", "create", "edit", "delete"],
  }),
  HR: build({
    "Employees & HR": [...vce, "export"],
    "Attendance & leave": [...vce, "approve", "export"],
    Payroll: [...vce, "export"],
    "Daily data sheet": ["view", "approve", "export"],
    "SOPs & checklists": v,
    "Personal finance planner": ["view", "create", "edit", "delete"],
  }),
  Finance: build({
    "Agreements & packages": v,
    Clients: v,
    "Invoices & collections": [...vce, "approve", "export"],
    Expenses: [...vce, "approve", "export"],
    Payroll: ["view", "approve", "export"],
    "Equipment & assets": ["view", "edit", "export"],
    "Company financial reports": ["view", "export"],
    "Personal finance planner": ["view", "create", "edit", "delete"],
  }),
  Freelancer: build({
    "Videos & tasks": ["view", "edit"],
    "Shoots & kit": v,
    "SOPs & checklists": v,
    "Client reviews": v,
  }),
  Client: build({
    "Videos & tasks": v,
    "Client reviews": ["view", "create", "approve"],
    "Invoices & collections": v,
    "Agreements & packages": v,
  }),
};

export const packages = [
  { name: "Growth Video Pack", service: "Video Production", fee: 85000, units: "8 reels · 2 long-form · 2 ad creatives", revisions: 2, turnaround: 4, clients: 1 },
  { name: "Social Starter Pack", service: "Social Media Management", fee: 65000, units: "10 reels · 12 posts · 20 stories", revisions: 2, turnaround: 3, clients: 1 },
  { name: "Authority Builder", service: "Personal Branding", fee: 48000, units: "6 explainer reels · 2 testimonials", revisions: 1, turnaround: 5, clients: 1 },
  { name: "Campaign Sprint", service: "Video Production", fee: 30000, units: "4 reels · 1 faculty intro", revisions: 2, turnaround: 5, clients: 1 },
  { name: "Property Showcase", service: "Video Production", fee: 40000, units: "2 walkthroughs · 4 reels", revisions: 2, turnaround: 5, clients: 1 },
  { name: "Reels Starter", service: "Video Production", fee: 35000, units: "8 reels", revisions: 2, turnaround: 3, clients: 0 },
];

export const stageGates: { from: string; to: string; gate: string; enforced: boolean }[] = [
  { from: "Planned", to: "Scripting", gate: "Onboarding gate passed for the client", enforced: true },
  { from: "Scripting", to: "Shoot Scheduled", gate: "Script approved by client approver", enforced: true },
  { from: "Shoot Scheduled", to: "Shot", gate: "Kit & pre-shoot checklist complete", enforced: true },
  { from: "Shot", to: "Editing", gate: "Video Protection (VP) verified", enforced: true },
  { from: "Editing", to: "Internal QC", gate: "All 9 edit steps ticked", enforced: true },
  { from: "Internal QC", to: "Client Review", gate: "QC pass on all 12 checks", enforced: true },
  { from: "Client Review", to: "Revision", gate: "Feedback classified (correction / included / out-of-scope)", enforced: true },
  { from: "Client Review", to: "Approved", gate: "Approval proof captured", enforced: true },
  { from: "Approved", to: "Published", gate: "Published URL + timestamp recorded", enforced: false },
];

export const notificationEvents = [
  { group: "Delivery", event: "Video overdue", inApp: true, email: true, whatsapp: true },
  { group: "Delivery", event: "Client left feedback", inApp: true, email: false, whatsapp: true },
  { group: "Delivery", event: "QC failed", inApp: true, email: false, whatsapp: false },
  { group: "Sales", event: "Discount above authority", inApp: true, email: true, whatsapp: true },
  { group: "Sales", event: "Lead follow-up due", inApp: true, email: false, whatsapp: false },
  { group: "People", event: "Leave conflicts with a shoot", inApp: true, email: true, whatsapp: false },
  { group: "People", event: "Daily data sheet not submitted", inApp: true, email: false, whatsapp: true },
  { group: "Assets", event: "Kit not returned in time", inApp: true, email: false, whatsapp: true },
  { group: "Finance", event: "Invoice overdue", inApp: true, email: true, whatsapp: false },
  { group: "Finance", event: "Payment received", inApp: true, email: true, whatsapp: false },
];
