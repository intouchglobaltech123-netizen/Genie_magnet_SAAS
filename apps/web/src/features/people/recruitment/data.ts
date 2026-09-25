export const stages = ["Lead", "Screening", "Interview", "Scorecard", "Approval", "Offer", "Joined", "Rejected"] as const;
export type Stage = (typeof stages)[number];

export const stageMeta: Record<Stage, { label: string; tone: "neutral" | "info" | "accent" | "warning" | "gold" | "success" | "danger" }> = {
  Lead: { label: "Lead / Candidate", tone: "neutral" },
  Screening: { label: "Screening", tone: "info" },
  Interview: { label: "Interview", tone: "accent" },
  Scorecard: { label: "Scorecard", tone: "warning" },
  Approval: { label: "Founder approval", tone: "gold" },
  Offer: { label: "Offer", tone: "success" },
  Joined: { label: "Joined", tone: "success" },
  Rejected: { label: "Rejected", tone: "danger" },
};

export const sourcingChannels = [
  "Employee referral",
  "HR consultants",
  "Job portal — Naukri",
  "Job portal — LinkedIn",
  "Social media campaign",
  "Campus recruitment",
  "Train-to-hire",
] as const;

export type Source =
  | "Employee referral"
  | "Naukri"
  | "LinkedIn"
  | "Instagram campaign"
  | "Campus — PSG"
  | "Campus — Kumaraguru"
  | "Train-to-hire"
  | "HR consultant";

export interface RoleDoc {
  id: string;
  name: string;
  department: string;
  openings: number;
  hiringManager: string;
  budget: string;
  postedOn: string;
  definition: string;
  deliverables: string[];
  tasks: string[];
  competence: { Skills: string[]; Knowledge: string[]; "Self Image": string[]; Motives: string[]; Traits: string[] };
  sourcing: string[];
}

export const roles: RoleDoc[] = [
  {
    id: "r-editor",
    name: "Video Editor",
    department: "Post-Production",
    openings: 1,
    hiringManager: "Karthik Subramanian",
    budget: "₹15,000 – ₹21,000 / month",
    postedOn: "2026-09-02",
    definition:
      "Responsible for turning raw footage into on-brand, client-approved videos within the agreed turnaround, while passing internal QC first time.",
    deliverables: [
      "12–16 reels and 2–3 long-form videos per month",
      "QC first-pass rate ≥ 85%",
      "Turnaround within agreement TAT (48–72 hours)",
      "Organised project files on Shared Drive per naming SOP",
    ],
    tasks: [
      "Rough cut → fine cut → colour → sound → motion text → export → upload",
      "Apply client brand kit (fonts, LUTs, logo placement)",
      "Log time against each video in Agency OS",
      "Incorporate client revisions within the included allowance",
      "Maintain music and SFX library licences",
    ],
    competence: {
      Skills: ["Premiere Pro / DaVinci Resolve", "Colour correction", "Sound cleanup", "Reel pacing & hooks"],
      Knowledge: ["Aspect ratios & platform specs", "Codecs & proxy workflow", "Copyright-safe music"],
      "Self Image": ["Sees self as a storyteller, not just an operator", "Owns quality before QC finds it"],
      Motives: ["Craft mastery", "Portfolio growth", "Recognition for client wins"],
      Traits: ["Attention to detail", "Deadline discipline", "Receptive to feedback"],
    },
    sourcing: ["Employee referral", "Job portal — Naukri", "Social media campaign", "Campus recruitment", "Train-to-hire"],
  },
  {
    id: "r-sales",
    name: "Sales Executive",
    department: "Sales & Marketing",
    openings: 1,
    hiringManager: "Priya Venkatesh",
    budget: "₹13,000 – ₹18,000 / month + incentive",
    postedOn: "2026-09-10",
    definition: "Responsible for closing orders at customer end",
    deliverables: ["Inquiry generation", "Sales & service", "Product development & marketing"],
    tasks: [
      "Generate 40 qualified inquiries a month from Erode, Tiruppur and Coimbatore",
      "Run discovery calls and on-site visits with founders & marketing heads",
      "Prepare proposals from package templates; route discounts > 10% to founder",
      "Hand over won clients to onboarding with brief and approver captured",
      "Collect feedback to shape new packages (Personal Branding, Website)",
    ],
    competence: {
      Skills: ["Consultative selling", "Tamil & English communication", "CRM discipline", "Negotiation"],
      Knowledge: ["Social media & video marketing basics", "Local SME landscape (textiles, real estate, FMCG)", "GST invoicing basics"],
      "Self Image": ["Sees self as a growth partner to clients", "Comfortable with rejection"],
      Motives: ["Achievement & incentives", "Building relationships"],
      Traits: ["Persistence", "Integrity", "Energy & follow-through"],
    },
    sourcing: ["Employee referral", "HR consultants", "Job portal — LinkedIn", "Social media campaign"],
  },
];

export interface Scorecard {
  params: { Skills: number; Knowledge: number; "Self image": number; Traits: number; Motives: number };
  star: { Situation: string; Task: string; Action: string; Result: string };
  taskScore: number;
  psychometric: boolean;
  psychometricScore: number;
  remarks: string;
  submitted: boolean;
}

export interface Candidate {
  id: string;
  roleId: string;
  name: string;
  city: string;
  source: Source;
  experience: string;
  currentCtc?: number;
  expectedCtc: number;
  stage: Stage;
  appliedOn: string;
  highlight: string;
  scorecard?: Scorecard;
}

const sc = (p: [number, number, number, number, number], task: number, remarks: string, submitted = true): Scorecard => ({
  params: { Skills: p[0], Knowledge: p[1], "Self image": p[2], Traits: p[3], Motives: p[4] },
  star: {
    Situation: "Client rejected a reel 2 hours before the posting slot.",
    Task: "Deliver a revised cut without missing the slot.",
    Action: "Re-cut using alternate B-roll, kept the hook, informed the account manager proactively.",
    Result: "Posted on time; client approved with no further changes.",
  },
  taskScore: task,
  psychometric: false,
  psychometricScore: 0,
  remarks,
  submitted,
});

export const seedCandidates: Candidate[] = [
  // Video Editor
  { id: "c-01", roleId: "r-editor", name: "Aravind Shankar", city: "Coimbatore", source: "Naukri", experience: "3 yrs", currentCtc: 15500, expectedCtc: 19000, stage: "Approval", appliedOn: "2026-09-04", highlight: "Ex-Sun Music promo editor; strong colour", scorecard: sc([5, 4, 4, 4, 5], 9, "Excellent pacing on the test reel. Culture fit strong. Recommend hire.") },
  { id: "c-02", roleId: "r-editor", name: "Kavya Ramesh", city: "Tiruppur", source: "Instagram campaign", experience: "1.5 yrs", currentCtc: 11000, expectedCtc: 14500, stage: "Scorecard", appliedOn: "2026-09-06", highlight: "Reels-first portfolio, 40k IG following", scorecard: sc([4, 3, 4, 4, 4], 7, "Great instincts for hooks; needs colour/sound depth.", false) },
  { id: "c-03", roleId: "r-editor", name: "Pradeep Murugan", city: "Erode", source: "Employee referral", experience: "2 yrs", currentCtc: 12000, expectedCtc: 16000, stage: "Interview", appliedOn: "2026-09-08", highlight: "Referred by Divya Lakshmi" },
  { id: "c-04", roleId: "r-editor", name: "Nithya Sundaram", city: "Salem", source: "Campus — PSG", experience: "Fresher", expectedCtc: 11000, stage: "Screening", appliedOn: "2026-09-15", highlight: "B.Sc Visual Comm, PSG CAS — short film award" },
  { id: "c-05", roleId: "r-editor", name: "Harish Kannan", city: "Coimbatore", source: "LinkedIn", experience: "4 yrs", currentCtc: 19000, expectedCtc: 24000, stage: "Screening", appliedOn: "2026-09-12", highlight: "Corporate films; above budget" },
  { id: "c-06", roleId: "r-editor", name: "Yamini Senthil", city: "Gobichettipalayam", source: "Train-to-hire", experience: "6-week bootcamp", expectedCtc: 9500, stage: "Lead", appliedOn: "2026-09-20", highlight: "Top of Genie Magnet editing bootcamp batch 2" },
  { id: "c-07", roleId: "r-editor", name: "Dinesh Rajkumar", city: "Bhavani", source: "Campus — Kumaraguru", experience: "Fresher", expectedCtc: 10000, stage: "Lead", appliedOn: "2026-09-22", highlight: "KCT media club lead editor" },
  { id: "c-08", roleId: "r-editor", name: "Sanjay Balan", city: "Pollachi", source: "Naukri", experience: "2.5 yrs", currentCtc: 13000, expectedCtc: 18000, stage: "Rejected", appliedOn: "2026-09-03", highlight: "Test task missed deadline by 2 days", scorecard: sc([3, 3, 2, 3, 2], 4, "Could not meet test deadline; low ownership signals.") },
  // Sales Executive
  { id: "c-11", roleId: "r-sales", name: "Lokesh Rajendran", city: "Erode", source: "Employee referral", experience: "3 yrs · textiles B2B", currentCtc: 14500, expectedCtc: 18000, stage: "Offer", appliedOn: "2026-09-11", highlight: "Referred by Priya; knows 60+ Erode textile owners", scorecard: sc([4, 4, 5, 4, 5], 8, "Closed a mock deal convincingly. Founder approved on 22 Sep.") },
  { id: "c-12", roleId: "r-sales", name: "Swetha Paramasivam", city: "Coimbatore", source: "LinkedIn", experience: "2 yrs · ed-tech inside sales", currentCtc: 14000, expectedCtc: 17000, stage: "Interview", appliedOn: "2026-09-13", highlight: "Consistently 120% of quota at previous role" },
  { id: "c-13", roleId: "r-sales", name: "Madhan Gopal", city: "Tiruppur", source: "HR consultant", experience: "5 yrs · print media ads", currentCtc: 18000, expectedCtc: 21500, stage: "Scorecard", appliedOn: "2026-09-12", highlight: "Strong network; salary above band", scorecard: sc([4, 4, 3, 3, 3], 6, "Knows the market well; motivation seems money-only.", false) },
  { id: "c-14", roleId: "r-sales", name: "Revathi Arumugam", city: "Appakudal", source: "Instagram campaign", experience: "1 yr · retail", currentCtc: 9000, expectedCtc: 13000, stage: "Screening", appliedOn: "2026-09-18", highlight: "Local — 10 min from office" },
  { id: "c-15", roleId: "r-sales", name: "Vishnu Prasath", city: "Salem", source: "Naukri", experience: "2 yrs · insurance", currentCtc: 11500, expectedCtc: 15000, stage: "Lead", appliedOn: "2026-09-21", highlight: "Field sales; two-wheeler, travel ready" },
  { id: "c-16", roleId: "r-sales", name: "Janani Elango", city: "Erode", source: "Campus — Kumaraguru", experience: "MBA fresher", expectedCtc: 13000, stage: "Lead", appliedOn: "2026-09-23", highlight: "MBA Marketing, KCT Business School" },
  { id: "c-17", roleId: "r-sales", name: "Barath Chandran", city: "Coimbatore", source: "LinkedIn", experience: "4 yrs · real-estate", currentCtc: 17000, expectedCtc: 20500, stage: "Rejected", appliedOn: "2026-09-10", highlight: "Declined field travel requirement" },
];

export const sourceTone: Record<Source, "accent" | "info" | "gold" | "success" | "neutral" | "warning"> = {
  "Employee referral": "success",
  Naukri: "info",
  LinkedIn: "info",
  "Instagram campaign": "accent",
  "Campus — PSG": "gold",
  "Campus — Kumaraguru": "gold",
  "Train-to-hire": "warning",
  "HR consultant": "neutral",
};

export const starQuestions: Record<string, Record<keyof Scorecard["star"], string>> = {
  "r-editor": {
    Situation: "Tell us about a time a client rejected your edit close to a deadline.",
    Task: "What exactly were you responsible for delivering, and by when?",
    Action: "Walk us through the specific steps you took — tools, decisions, who you informed.",
    Result: "What happened? How did the client and your team respond?",
  },
  "r-sales": {
    Situation: "Describe a deal that was about to be lost to a cheaper competitor.",
    Task: "What was your target and what did you need to protect?",
    Action: "What did you say and do to re-position the value?",
    Result: "What was the outcome — order value, margin, relationship?",
  },
};

export function emptyScorecard(): Scorecard {
  return {
    params: { Skills: 0, Knowledge: 0, "Self image": 0, Traits: 0, Motives: 0 },
    star: { Situation: "", Task: "", Action: "", Result: "" },
    taskScore: 0,
    psychometric: false,
    psychometricScore: 0,
    remarks: "",
    submitted: false,
  };
}

export function evaluate(s: Scorecard) {
  const vals = Object.values(s.params);
  const total = vals.reduce((a, b) => a + b, 0);
  const complete = vals.every((v) => v > 0);
  const pct = Math.round(((total / 25) * 0.7 + (s.taskScore / 10) * 0.3) * 100);
  let rec: "Hire" | "Hold" | "Reject" | "Incomplete" = "Incomplete";
  if (complete) {
    if ((vals.every((v) => v >= 4) || total >= 20) && s.taskScore >= 7) rec = "Hire";
    else if (total >= 15 && s.taskScore >= 5) rec = "Hold";
    else rec = "Reject";
  }
  return { total, pct, rec, complete };
}
