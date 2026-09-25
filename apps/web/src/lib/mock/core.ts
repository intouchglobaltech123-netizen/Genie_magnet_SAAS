import {
  EDIT_STEPS,
  QC_CHECKS,
  type Agreement,
  type Asset,
  type Client,
  type Cycle,
  type EditStep,
  type Lead,
  type Person,
  type Shoot,
  type Urgency,
  type Video,
  type VideoStage,
} from "@/lib/types";

/** The demo runs as if "today" is this date. */
export const TODAY = "2026-09-25";

// ───────────────────────────────── People ─────────────────────────────────

export const people: Person[] = [
  { id: "p-jana", name: "Janarthanan", role: "Founder & MD", department: "Management", type: "employee", email: "jana@geniemagnet.in", phone: "+91 98400 11001", joinedOn: "2021-06-01", skills: ["Strategy", "Sales", "Coaching", "Direction"], hourlyCost: 650, monthlyCtc: 100000, status: "active", utilisation: 0.94 },
  { id: "p-ashwin", name: "Ashwin", role: "Company Manager", department: "Management", type: "employee", email: "ashwin@geniemagnet.in", phone: "+91 98400 11002", joinedOn: "2022-01-10", managerId: "p-jana", skills: ["Operations", "Planning", "Client servicing"], hourlyCost: 210, monthlyCtc: 30000, status: "active", utilisation: 0.88 },
  { id: "p-priya", name: "Priya Venkatesh", role: "Sales & Marketing Lead", department: "Sales & Marketing", type: "employee", email: "priya@geniemagnet.in", phone: "+91 98400 11003", joinedOn: "2023-03-15", managerId: "p-ashwin", skills: ["Sales", "Meta Ads", "Proposals"], hourlyCost: 140, monthlyCtc: 20000, status: "active", utilisation: 0.76 },
  { id: "p-karthik", name: "Karthik Subramanian", role: "Content Director", department: "Production", type: "employee", email: "karthik@geniemagnet.in", phone: "+91 98400 11004", joinedOn: "2022-07-01", managerId: "p-ashwin", skills: ["Scripting", "Direction", "Storyboarding"], hourlyCost: 155, monthlyCtc: 22000, status: "active", utilisation: 0.91 },
  { id: "p-vignesh", name: "Vignesh Kumar", role: "Camera Man", department: "Production", type: "employee", email: "vignesh@geniemagnet.in", phone: "+91 98400 11005", joinedOn: "2023-01-09", managerId: "p-karthik", skills: ["Cinematography", "Lighting", "Dual-cam"], hourlyCost: 115, monthlyCtc: 16000, status: "active", utilisation: 0.82 },
  { id: "p-divya", name: "Divya Lakshmi", role: "Senior Video Editor", department: "Post-Production", type: "employee", email: "divya@geniemagnet.in", phone: "+91 98400 11006", joinedOn: "2022-11-21", managerId: "p-karthik", skills: ["Premiere Pro", "Colour", "Motion text"], hourlyCost: 130, monthlyCtc: 18000, status: "active", utilisation: 1.08 },
  { id: "p-surya", name: "Surya Prakash", role: "Video Editor", department: "Post-Production", type: "employee", email: "surya@geniemagnet.in", phone: "+91 98400 11007", joinedOn: "2024-02-05", managerId: "p-karthik", skills: ["Premiere Pro", "Reels", "Sound"], hourlyCost: 95, monthlyCtc: 13000, status: "active", utilisation: 0.86 },
  { id: "p-meena", name: "Meena Ravi", role: "Social Media Manager", department: "Social Media", type: "employee", email: "meena@geniemagnet.in", phone: "+91 98400 11008", joinedOn: "2023-08-14", managerId: "p-ashwin", skills: ["Instagram", "Scheduling", "Community"], hourlyCost: 105, monthlyCtc: 15000, status: "active", utilisation: 0.79 },
  { id: "p-harini", name: "Harini Selvam", role: "HR & Admin Executive", department: "HR & Admin", type: "employee", email: "harini@geniemagnet.in", phone: "+91 98400 11009", joinedOn: "2024-05-02", managerId: "p-ashwin", skills: ["Recruitment", "Payroll", "Attendance"], hourlyCost: 100, monthlyCtc: 14000, status: "active", utilisation: 0.7 },
  { id: "p-naveen", name: "Naveen Raj", role: "Technical Supporter", department: "Technology", type: "employee", email: "naveen@geniemagnet.in", phone: "+91 98400 11010", joinedOn: "2024-09-16", managerId: "p-ashwin", skills: ["IT support", "Storage", "LMS"], hourlyCost: 85, monthlyCtc: 12000, status: "on-leave", utilisation: 0.41 },
  // Freelancers
  { id: "f-rahul", name: "Rahul Menon", role: "Freelance Editor", department: "Post-Production", type: "freelancer", email: "rahul.edits@gmail.com", phone: "+91 90030 22001", joinedOn: "2024-01-01", skills: ["Long-form", "Podcast"], hourlyCost: 250, status: "active", utilisation: 0.65 },
  { id: "f-sneha", name: "Sneha Iyer", role: "Motion Designer", department: "Post-Production", type: "freelancer", email: "sneha.motion@gmail.com", phone: "+91 90030 22002", joinedOn: "2024-03-01", skills: ["After Effects", "Titles"], hourlyCost: 350, status: "active", utilisation: 0.52 },
  { id: "f-gokul", name: "Gokul Das", role: "Camera Operator", department: "Production", type: "freelancer", email: "gokul.dop@gmail.com", phone: "+91 90030 22003", joinedOn: "2023-10-01", skills: ["Second camera", "Gimbal"], hourlyCost: 220, status: "active", utilisation: 0.44 },
  { id: "f-deepa", name: "Deepa Nair", role: "Voice-over Artist", department: "Production", type: "freelancer", email: "deepa.vo@gmail.com", phone: "+91 90030 22004", joinedOn: "2024-06-01", skills: ["Tamil VO", "English VO"], hourlyCost: 500, status: "active", utilisation: 0.2 },
  { id: "f-ajay", name: "Ajay Krishnan", role: "Colourist", department: "Post-Production", type: "freelancer", email: "ajay.grade@gmail.com", phone: "+91 90030 22005", joinedOn: "2024-02-01", skills: ["DaVinci Resolve"], hourlyCost: 400, status: "active", utilisation: 0.35 },
  { id: "f-keerthana", name: "Keerthana Mohan", role: "Script Writer", department: "Production", type: "freelancer", email: "keerthana.writes@gmail.com", phone: "+91 90030 22006", joinedOn: "2023-12-01", skills: ["Tamil scripts", "Hooks"], hourlyCost: 280, status: "active", utilisation: 0.6 },
  { id: "f-manoj", name: "Manoj Pillai", role: "Drone Operator", department: "Production", type: "freelancer", email: "manoj.aerial@gmail.com", phone: "+91 90030 22007", joinedOn: "2024-04-01", skills: ["DJI Mavic", "Aerials"], hourlyCost: 700, status: "active", utilisation: 0.1 },
  { id: "f-lavanya", name: "Lavanya Suresh", role: "Graphic Designer", department: "Social Media", type: "freelancer", email: "lavanya.design@gmail.com", phone: "+91 90030 22008", joinedOn: "2024-05-01", skills: ["Thumbnails", "Carousels"], hourlyCost: 240, status: "active", utilisation: 0.58 },
  { id: "f-sathish", name: "Sathish Kumar", role: "Sound Engineer", department: "Post-Production", type: "freelancer", email: "sathish.audio@gmail.com", phone: "+91 90030 22009", joinedOn: "2024-07-01", skills: ["Mixing", "Noise cleanup"], hourlyCost: 300, status: "active", utilisation: 0.3 },
];

export const personById = (id: string) => people.find((p) => p.id === id)!;
export const employees = people.filter((p) => p.type === "employee");
export const freelancers = people.filter((p) => p.type === "freelancer");
export const editors = people.filter((p) => ["p-divya", "p-surya", "f-rahul"].includes(p.id));

// ───────────────────────────────── Clients ─────────────────────────────────

export const clients: Client[] = [
  {
    id: "c-kaveri", code: "KVR", name: "Kaveri Organics", industry: "FMCG · Organic foods", city: "Erode", kind: "recurring", category: "Breadwinning",
    accountOwnerId: "p-ashwin", health: 86, since: "2025-04-01", monthlyValue: 85000, outstanding: 0,
    contacts: [
      { name: "Ramesh Gounder", title: "Managing Partner", email: "ramesh@kaveriorganics.in", phone: "+91 94430 55101", approver: true },
      { name: "Nithya R", title: "Marketing Executive", email: "nithya@kaveriorganics.in", phone: "+91 94430 55102", approver: false },
    ],
  },
  {
    id: "c-lakshmi", code: "SLS", name: "Sri Lakshmi Silks", industry: "Retail · Textiles", city: "Kanchipuram", kind: "recurring", category: "Awesome",
    accountOwnerId: "p-priya", health: 92, since: "2025-09-01", monthlyValue: 65000, outstanding: 65000,
    contacts: [
      { name: "Meenakshi Sundaram", title: "Owner", email: "meenakshi@srilakshmisilks.com", phone: "+91 94430 55201", approver: true },
    ],
  },
  {
    id: "c-nova", code: "NVD", name: "Nova Dental Care", industry: "Healthcare · Dental clinics", city: "Coimbatore", kind: "recurring", category: "Convincing",
    accountOwnerId: "p-ashwin", health: 64, since: "2026-02-01", monthlyValue: 48000, outstanding: 96000,
    contacts: [
      { name: "Dr. Arvind Balaji", title: "Chief Dentist", email: "arvind@novadental.in", phone: "+91 94430 55301", approver: true },
      { name: "Kavya M", title: "Clinic Coordinator", email: "kavya@novadental.in", phone: "+91 94430 55302", approver: false },
    ],
  },
  {
    id: "c-bright", code: "BPA", name: "BrightPath Academy", industry: "Education · Coaching", city: "Salem", kind: "partner", category: "Convincing",
    accountOwnerId: "p-priya", health: 74, since: "2026-05-15", monthlyValue: 30000, outstanding: 15000,
    contacts: [{ name: "Suresh Kannan", title: "Director", email: "suresh@brightpath.edu.in", phone: "+91 94430 55401", approver: true }],
  },
  {
    id: "c-urban", code: "UNR", name: "Urban Nest Realty", industry: "Real estate", city: "Tiruppur", kind: "partner", category: "Dangerous",
    accountOwnerId: "p-ashwin", health: 38, since: "2026-06-01", monthlyValue: 40000, outstanding: 120000,
    contacts: [{ name: "Vikram Shetty", title: "Sales Head", email: "vikram@urbannest.in", phone: "+91 94430 55501", approver: true }],
  },
];

export const clientById = (id: string) => clients.find((c) => c.id === id)!;

// ─────────────────────────────── Agreements ───────────────────────────────

export const agreements: Agreement[] = [
  {
    id: "a-kvr-01", clientId: "c-kaveri", title: "Kaveri Organics · Growth Video Retainer", packageName: "Growth Video Pack", service: "Video Production",
    status: "active", startDate: "2026-04-01", endDate: "2027-03-31", monthlyFee: 85000, billing: "Monthly advance",
    units: [{ label: "Reels", perCycle: 8 }, { label: "Long-form videos", perCycle: 2 }, { label: "Ad creatives", perCycle: 2 }],
    revisionsPerDeliverable: 2, turnaroundDays: 4,
    responsibilities: ["Share product samples 3 days before shoot", "Approve scripts within 48 hours", "Provide one approver for all content"],
    exclusions: ["Paid ad spend", "Celebrity / model fees", "Outstation travel beyond 150 km"],
  },
  {
    id: "a-sls-01", clientId: "c-lakshmi", title: "Sri Lakshmi Silks · Festive Content Retainer", packageName: "Social Starter Pack", service: "Social Media Management",
    status: "renewal-due", startDate: "2025-10-01", endDate: "2026-10-31", monthlyFee: 65000, billing: "Monthly advance",
    units: [{ label: "Reels", perCycle: 10 }, { label: "Static posts", perCycle: 12 }, { label: "Stories", perCycle: 20 }],
    revisionsPerDeliverable: 2, turnaroundDays: 3,
    responsibilities: ["Store access for shoot on Tuesdays", "Share new arrivals list weekly"],
    exclusions: ["Influencer fees", "Print design"],
  },
  {
    id: "a-nvd-01", clientId: "c-nova", title: "Nova Dental · Patient Education Series", packageName: "Authority Builder", service: "Personal Branding",
    status: "active", startDate: "2026-02-01", endDate: "2027-01-31", monthlyFee: 48000, billing: "Monthly arrears",
    units: [{ label: "Doctor explainer reels", perCycle: 6 }, { label: "Testimonial videos", perCycle: 2 }],
    revisionsPerDeliverable: 1, turnaroundDays: 5,
    responsibilities: ["Doctor available 2 hours per shoot", "Patient consent forms for testimonials"],
    exclusions: ["Medical claims review", "Ad spend"],
  },
  {
    id: "a-bpa-01", clientId: "c-bright", title: "BrightPath · Admissions Campaign (Partner)", packageName: "Campaign Sprint", service: "Video Production",
    status: "active", startDate: "2026-05-15", endDate: "2026-11-15", monthlyFee: 30000, billing: "50% advance",
    units: [{ label: "Reels", perCycle: 4 }, { label: "Faculty intro videos", perCycle: 1 }],
    revisionsPerDeliverable: 2, turnaroundDays: 5,
    responsibilities: ["Partner agency handles posting"], exclusions: ["Posting & ads"],
  },
  {
    id: "a-unr-01", clientId: "c-urban", title: "Urban Nest · Project Walkthroughs (Partner)", packageName: "Property Showcase", service: "Video Production",
    status: "active", startDate: "2026-06-01", endDate: "2026-12-31", monthlyFee: 40000, billing: "Monthly arrears",
    units: [{ label: "Walkthrough videos", perCycle: 2 }, { label: "Reels", perCycle: 4 }],
    revisionsPerDeliverable: 2, turnaroundDays: 5,
    responsibilities: ["Site access & permissions", "Floor plans shared before shoot"], exclusions: ["Drone permits"],
  },
];

export const agreementById = (id: string) => agreements.find((a) => a.id === id)!;

// ──────────────────────────────── Cycles ────────────────────────────────

export const cycles: Cycle[] = [
  { id: "cy-kvr-09", agreementId: "a-kvr-01", clientId: "c-kaveri", label: "Sep 2026", start: "2026-09-01", end: "2026-09-30", status: "in-progress", promised: 12, delivered: 7, inProgress: 5, revenue: 85000, cost: 51200 },
  { id: "cy-kvr-08", agreementId: "a-kvr-01", clientId: "c-kaveri", label: "Aug 2026", start: "2026-08-01", end: "2026-08-31", status: "closed", promised: 12, delivered: 12, inProgress: 0, revenue: 85000, cost: 58900 },
  { id: "cy-kvr-10", agreementId: "a-kvr-01", clientId: "c-kaveri", label: "Oct 2026", start: "2026-10-01", end: "2026-10-31", status: "upcoming", promised: 12, delivered: 0, inProgress: 0, revenue: 85000, cost: 0 },
  { id: "cy-sls-09", agreementId: "a-sls-01", clientId: "c-lakshmi", label: "Sep 2026", start: "2026-09-01", end: "2026-09-30", status: "in-progress", promised: 10, delivered: 8, inProgress: 2, revenue: 65000, cost: 33400 },
  { id: "cy-sls-08", agreementId: "a-sls-01", clientId: "c-lakshmi", label: "Aug 2026", start: "2026-08-01", end: "2026-08-31", status: "closed", promised: 10, delivered: 10, inProgress: 0, revenue: 65000, cost: 31800 },
  { id: "cy-nvd-09", agreementId: "a-nvd-01", clientId: "c-nova", label: "Sep 2026", start: "2026-09-01", end: "2026-09-30", status: "in-progress", promised: 8, delivered: 3, inProgress: 5, revenue: 48000, cost: 39600 },
  { id: "cy-nvd-08", agreementId: "a-nvd-01", clientId: "c-nova", label: "Aug 2026", start: "2026-08-01", end: "2026-08-31", status: "reconciling", promised: 8, delivered: 7, inProgress: 1, revenue: 48000, cost: 44100 },
  { id: "cy-bpa-09", agreementId: "a-bpa-01", clientId: "c-bright", label: "Sep 2026", start: "2026-09-01", end: "2026-09-30", status: "in-progress", promised: 5, delivered: 4, inProgress: 1, revenue: 30000, cost: 17800 },
  { id: "cy-unr-09", agreementId: "a-unr-01", clientId: "c-urban", label: "Sep 2026", start: "2026-09-01", end: "2026-09-30", status: "in-progress", promised: 6, delivered: 2, inProgress: 4, revenue: 40000, cost: 36500 },
];

// ──────────────────────────────── Videos ────────────────────────────────

const stepsDone = (n: number) =>
  Object.fromEntries(EDIT_STEPS.map((s, i) => [s, i < n])) as Record<EditStep, boolean>;

const qcState = (mode: "pending" | "pass" | "partial" | "fail") =>
  Object.fromEntries(
    QC_CHECKS.map((c, i) => [
      c,
      mode === "pending" ? "pending" : mode === "pass" ? "pass" : mode === "fail" && i === 3 ? "fail" : i < 7 ? "pass" : "pending",
    ]),
  ) as Record<string, "pass" | "fail" | "pending">;

interface VSeed {
  n: number;
  client: string;
  title: string;
  format: Video["format"];
  aspect: Video["aspect"];
  urgency: Urgency;
  stage: VideoStage;
  editor: string;
  due: string;
  clip: string;
  shoot?: string;
  delay?: string;
  logged?: number;
}

const seeds: VSeed[] = [
  // Kaveri Organics — Sep 2026 cycle
  { n: 1, client: "c-kaveri", title: "Cold-pressed groundnut oil — farm to bottle", format: "Reel", aspect: "9:16", urgency: "standard", stage: "Published", editor: "p-divya", due: "2026-09-06", clip: "C0012–C0019", shoot: "sh-01" },
  { n: 2, client: "c-kaveri", title: "Why our turmeric is lab tested", format: "Reel", aspect: "9:16", urgency: "standard", stage: "Published", editor: "p-surya", due: "2026-09-09", clip: "C0020–C0026", shoot: "sh-01" },
  { n: 3, client: "c-kaveri", title: "Millet breakfast in 5 minutes", format: "Reel", aspect: "9:16", urgency: "priority", stage: "Approved", editor: "p-surya", due: "2026-09-14", clip: "C0027–C0033", shoot: "sh-01" },
  { n: 4, client: "c-kaveri", title: "Founder story — 3 generations of farming", format: "Long-form", aspect: "16:9", urgency: "priority", stage: "Client Review", editor: "p-divya", due: "2026-09-24", clip: "A001–A046 / B001–B040", shoot: "sh-02" },
  { n: 5, client: "c-kaveri", title: "Diwali gift hamper ad — 30s", format: "Ad", aspect: "4:5", urgency: "rush", stage: "Editing", editor: "p-divya", due: "2026-09-27", clip: "C0101–C0118", shoot: "sh-03", delay: "Client changed hamper contents after shoot; re-shoot of 2 product shots needed" },
  { n: 6, client: "c-kaveri", title: "Cold-pressed vs refined — myth buster", format: "Reel", aspect: "9:16", urgency: "standard", stage: "Internal QC", editor: "p-surya", due: "2026-09-26", clip: "C0119–C0124", shoot: "sh-03" },
  { n: 7, client: "c-kaveri", title: "Behind the mill — sunrise B-roll reel", format: "Reel", aspect: "9:16", urgency: "standard", stage: "Shot", editor: "f-rahul", due: "2026-09-29", clip: "C0125–C0140", shoot: "sh-03" },
  { n: 8, client: "c-kaveri", title: "Customer testimonial — Chennai homemaker", format: "Testimonial", aspect: "9:16", urgency: "priority", stage: "Shoot Scheduled", editor: "p-surya", due: "2026-09-30", clip: "—", shoot: "sh-04" },
  // Sri Lakshmi Silks
  { n: 1, client: "c-lakshmi", title: "Navaratri collection drop — Kanjivaram", format: "Reel", aspect: "9:16", urgency: "rush", stage: "Revision", editor: "p-divya", due: "2026-09-25", clip: "C0201–C0214", shoot: "sh-05", logged: 420 },
  { n: 2, client: "c-lakshmi", title: "How to identify pure zari", format: "Reel", aspect: "9:16", urgency: "standard", stage: "Published", editor: "p-surya", due: "2026-09-12", clip: "C0215–C0220", shoot: "sh-05" },
  { n: 3, client: "c-lakshmi", title: "Bridal trousseau walkthrough", format: "Long-form", aspect: "16:9", urgency: "priority", stage: "Editing", editor: "f-rahul", due: "2026-09-28", clip: "A101–A160", shoot: "sh-05" },
  { n: 4, client: "c-lakshmi", title: "Weaver spotlight — 40 years at the loom", format: "Reel", aspect: "9:16", urgency: "standard", stage: "Scripting", editor: "p-surya", due: "2026-10-03", clip: "—" },
  // Nova Dental
  { n: 1, client: "c-nova", title: "Is root canal painful? Dr. Arvind explains", format: "Explainer", aspect: "9:16", urgency: "standard", stage: "Client Review", editor: "p-surya", due: "2026-09-23", clip: "C0301–C0306", shoot: "sh-06", delay: "Doctor approval pending for 3 days" },
  { n: 2, client: "c-nova", title: "Aligners vs braces", format: "Explainer", aspect: "9:16", urgency: "standard", stage: "Editing", editor: "f-rahul", due: "2026-09-26", clip: "C0307–C0312", shoot: "sh-06" },
  { n: 3, client: "c-nova", title: "Patient smile makeover testimonial", format: "Testimonial", aspect: "9:16", urgency: "priority", stage: "Planned", editor: "p-divya", due: "2026-10-02", clip: "—" },
  { n: 4, client: "c-nova", title: "Kids' first dental visit — tips", format: "Reel", aspect: "9:16", urgency: "standard", stage: "Scripting", editor: "p-surya", due: "2026-10-04", clip: "—" },
  // BrightPath
  { n: 1, client: "c-bright", title: "NEET 2027 batch — admissions open", format: "Ad", aspect: "9:16", urgency: "rush", stage: "Approved", editor: "p-divya", due: "2026-09-22", clip: "C0401–C0409", shoot: "sh-07" },
  { n: 2, client: "c-bright", title: "Meet our physics faculty", format: "Long-form", aspect: "16:9", urgency: "standard", stage: "Internal QC", editor: "f-rahul", due: "2026-09-27", clip: "A201–A230", shoot: "sh-07" },
  // Urban Nest
  { n: 1, client: "c-urban", title: "Green Meadows 3BHK walkthrough", format: "Long-form", aspect: "16:9", urgency: "priority", stage: "Revision", editor: "f-rahul", due: "2026-09-21", clip: "A301–A355", shoot: "sh-08", delay: "Client requested new floor-plan graphics (out of scope — CR raised)", logged: 610 },
  { n: 2, client: "c-urban", title: "Sunset drone reel — Green Meadows", format: "Reel", aspect: "9:16", urgency: "standard", stage: "Shot", editor: "p-surya", due: "2026-09-30", clip: "DJI_0045–0061", shoot: "sh-08" },
];

const directorFor = () => "p-karthik";
const monthCode = "0926";

const stageIndex: Record<VideoStage, number> = {
  Planned: 0, Scripting: 1, "Shoot Scheduled": 2, Shot: 3, Editing: 4, "Internal QC": 5, "Client Review": 6, Revision: 7, Approved: 8, Published: 9,
};

export const videos: Video[] = seeds.map((s) => {
  const client = clientById(s.client);
  const agreement = agreements.find((a) => a.clientId === s.client)!;
  const cycle = cycles.find((c) => c.clientId === s.client && c.label === "Sep 2026")!;
  const idx = stageIndex[s.stage];
  const planned = s.format === "Long-form" ? 960 : s.format === "Ad" ? 540 : s.format === "Testimonial" ? 420 : 300;
  const logged = s.logged ?? (idx >= 8 ? Math.round(planned * 1.08) : idx >= 5 ? Math.round(planned * 0.92) : idx === 4 ? Math.round(planned * 0.55) : idx === 3 ? 60 : 0);
  const steps = idx >= 5 ? 9 : idx === 4 ? (s.n % 2 ? 5 : 3) : 0;
  const qc = idx >= 6 ? qcState("pass") : idx === 5 ? qcState(s.n === 6 ? "partial" : "pending") : qcState("pending");
  const versions: Video["versions"] = [];
  if (idx >= 6) {
    versions.push({ id: `${client.code}-${s.n}-v1`, label: "v1", createdAt: "2026-09-18T17:30:00", by: personById(s.editor).name, duration: s.format === "Long-form" ? "06:42" : "00:48", notes: "First cut after internal QC", status: idx === 6 ? "sent" : idx === 7 ? "changes-requested" : "approved" });
  }
  if (idx === 7 || (idx >= 8 && s.n % 2 === 0)) {
    versions[0]!.status = "changes-requested";
    versions.push({ id: `${client.code}-${s.n}-v2`, label: "v2", createdAt: "2026-09-22T19:10:00", by: personById(s.editor).name, duration: s.format === "Long-form" ? "06:30" : "00:45", notes: "Addressed client feedback", status: idx === 7 ? "internal" : "approved" });
  }
  const comments: Video["comments"] = [];
  if (versions.length) {
    comments.push({ id: `${client.code}-${s.n}-c1`, versionId: versions[0]!.id, author: client.contacts[0]!.name, at: "2026-09-19T10:12:00", timestamp: "00:07", text: "Can we make the opening hook text bigger? It's hard to read on mobile.", kind: "text", resolved: versions.length > 1 });
    comments.push({ id: `${client.code}-${s.n}-c2`, versionId: versions[0]!.id, author: client.contacts[0]!.name, at: "2026-09-19T10:15:00", timestamp: "00:31", text: "Voice note: prefers the second product shot here instead of the wide shot.", kind: "voice", resolved: versions.length > 1 });
  }
  return {
    id: `v-${client.code.toLowerCase()}-${s.n}`,
    code: `${client.code}-${monthCode}-${String(s.n).padStart(2, "0")}`,
    title: s.title,
    clientId: s.client,
    agreementId: agreement.id,
    cycleId: cycle.id,
    format: s.format,
    aspect: s.aspect,
    urgency: s.urgency,
    stage: s.stage,
    clipNo: s.clip,
    videoProtection: idx >= 3,
    editorId: s.editor,
    directorId: directorFor(),
    cameraId: s.client === "c-urban" ? "f-gokul" : "p-vignesh",
    shootId: s.shoot,
    dueDate: s.due,
    publishDate: s.due,
    plannedMinutes: planned,
    loggedMinutes: logged,
    editSteps: stepsDone(steps),
    qc,
    revisionsUsed: versions.length > 1 ? 1 : 0,
    versions,
    comments,
    delayReason: s.delay,
    platform: s.format === "Long-form" ? ["YouTube"] : ["Instagram", "YouTube Shorts"],
    publishedUrl: s.stage === "Published" ? `https://instagram.com/reel/${client.code}${s.n}demo` : undefined,
  };
});

// ──────────────────────────────── Shoots ────────────────────────────────

export const shoots: Shoot[] = [
  { id: "sh-01", projectName: "Kaveri — Sept batch A", clientId: "c-kaveri", date: "2026-09-03", callTime: "07:00", location: "Kaveri mill, Perundurai", batchNo: "KVR-B17", kit: "dual", cameraId: "p-vignesh", directorId: "p-karthik", videoIds: ["v-kvr-1", "v-kvr-2", "v-kvr-3"], status: "closed", notes: "Golden hour exteriors first" },
  { id: "sh-02", projectName: "Kaveri — Founder story", clientId: "c-kaveri", date: "2026-09-10", callTime: "09:30", location: "Founder's farmhouse, Bhavani", batchNo: "KVR-B18", kit: "dual", cameraId: "p-vignesh", directorId: "p-karthik", videoIds: ["v-kvr-4"], status: "closed", notes: "Interview + archival photos" },
  { id: "sh-03", projectName: "Kaveri — Sept batch B", clientId: "c-kaveri", date: "2026-09-19", callTime: "06:30", location: "Genie Magnet studio, Appakudal", batchNo: "KVR-B19", kit: "single", cameraId: "p-vignesh", directorId: "p-karthik", videoIds: ["v-kvr-5", "v-kvr-6", "v-kvr-7"], status: "returned", notes: "Product table-top + sunrise B-roll" },
  { id: "sh-04", projectName: "Kaveri — Testimonial", clientId: "c-kaveri", date: "2026-09-27", callTime: "10:00", location: "Customer home, Anna Nagar, Chennai", batchNo: "KVR-B20", kit: "single", cameraId: "p-vignesh", directorId: "p-karthik", videoIds: ["v-kvr-8"], status: "planned", notes: "Travel day before; consent form mandatory" },
  { id: "sh-05", projectName: "Sri Lakshmi — Navaratri", clientId: "c-lakshmi", date: "2026-09-15", callTime: "08:00", location: "Sri Lakshmi Silks showroom, Kanchipuram", batchNo: "SLS-B09", kit: "dual", cameraId: "p-vignesh", directorId: "p-karthik", videoIds: ["v-sls-1", "v-sls-2", "v-sls-3"], status: "closed", notes: "Store closed 8–11 AM for shoot" },
  { id: "sh-06", projectName: "Nova Dental — Explainers", clientId: "c-nova", date: "2026-09-17", callTime: "14:00", location: "Nova Dental, RS Puram", batchNo: "NVD-B06", kit: "single", cameraId: "p-vignesh", directorId: "p-karthik", videoIds: ["v-nvd-1", "v-nvd-2"], status: "closed", notes: "Doctor available 2–4 PM only" },
  { id: "sh-07", projectName: "BrightPath — Admissions", clientId: "c-bright", date: "2026-09-12", callTime: "09:00", location: "BrightPath campus, Salem", batchNo: "BPA-B04", kit: "dual", cameraId: "p-vignesh", directorId: "p-karthik", videoIds: ["v-bpa-1", "v-bpa-2"], status: "closed", notes: "" },
  { id: "sh-08", projectName: "Urban Nest — Green Meadows", clientId: "c-urban", date: "2026-09-14", callTime: "06:00", location: "Green Meadows site, Tiruppur", batchNo: "UNR-B03", kit: "dual", cameraId: "f-gokul", directorId: "p-karthik", videoIds: ["v-unr-1", "v-unr-2"], status: "closed", notes: "Drone permit arranged by client" },
  { id: "sh-09", projectName: "Nova Dental — Testimonials", clientId: "c-nova", date: "2026-09-30", callTime: "11:00", location: "Nova Dental, RS Puram", batchNo: "NVD-B07", kit: "single", cameraId: "p-vignesh", directorId: "p-karthik", videoIds: ["v-nvd-3"], status: "planned", notes: "Patient consent pending" },
];

/** Kit lists taken from Genie Magnet's paper equipment checklist. */
export const kitItems: Record<"dual" | "single", string[]> = {
  dual: [
    "Camera (2)", "Camera Stand (2)", "Lights (3)", "Light Stand (3)", "Light Cables (3)", "Soft Box (2)", "Light Reflection Cap (1)",
    "Mic Box", "Mic Cable", "Camera Charger for both cameras", "Batteries (2)", "USB Charger", "USB Cable",
    "50mm 1.8F, 35mm 1.4F, Variable 2.8F lenses", "Camera Stand Base", "Extension Box (2)", "Camera Memory Card — empty (3)",
    "Headset", "Pen", "Paper Pad", "Video Data Sheet",
  ],
  single: [
    "Camera (1)", "Camera Stand (1)", "Lights (3)", "Light Stand (3)", "Light Cables (3)", "Soft Box (2)", "Light Reflection Cap (1)",
    "Mic Box", "Mic Cable", "Camera Charger", "Batteries (2)", "USB Charger", "USB Cable",
    "50mm 1.8F, 35mm 1.4F, Variable 2.8F lenses", "Camera Stand Base", "Extension Box (2)", "Camera Memory Card — empty (3)",
    "Headset", "Pen", "Paper Pad", "Video Data Sheet",
  ],
};

/** Pre-shoot (set readiness) checklist from the paper form. */
export const preShootItems = [
  "AC switched on", "Water bottles (2)", "Chair", "Chair positioning", "Content paper (2)", "Script paper (2)",
  "Camera cap", "Grooming kit", "Refreshment",
];

// ───────────────────────────────── Leads ─────────────────────────────────

export const leads: Lead[] = [
  { id: "l-01", name: "Anand Raj", company: "Anand Sweets & Savouries", phone: "+91 98941 30001", email: "anand@anandsweets.in", source: "Meta Ads", service: "Video Production", stage: "New", value: 60000, ownerId: "p-priya", nextFollowUp: "2026-09-25", score: 62, createdAt: "2026-09-24" },
  { id: "l-02", name: "Fathima Begum", company: "Zaara Boutique", phone: "+91 98941 30002", email: "hello@zaaraboutique.in", source: "Instagram", service: "Social Media Management", stage: "New", value: 35000, ownerId: "p-priya", nextFollowUp: "2026-09-26", score: 48, createdAt: "2026-09-23" },
  { id: "l-03", name: "Dr. Senthil", company: "Senthil Ortho Clinic", phone: "+91 98941 30003", email: "dr.senthil@orthocare.in", source: "Referral", service: "Personal Branding", stage: "Contacted", value: 55000, ownerId: "p-ashwin", nextFollowUp: "2026-09-25", score: 74, createdAt: "2026-09-19", notes: "Referred by Dr. Arvind (Nova Dental)" },
  { id: "l-04", name: "Gowtham", company: "GreenLeaf Hydroponics", phone: "+91 98941 30004", email: "gowtham@greenleaf.farm", source: "Website", service: "Video Production", stage: "Contacted", value: 45000, ownerId: "p-priya", nextFollowUp: "2026-09-27", score: 58, createdAt: "2026-09-18" },
  { id: "l-05", name: "Revathi Shankar", company: "Revathi Jewellers", phone: "+91 98941 30005", email: "revathi@revathijewels.com", source: "BNI", service: "Video Production", stage: "Qualified", value: 120000, ownerId: "p-jana", nextFollowUp: "2026-09-26", score: 86, createdAt: "2026-09-12", notes: "High ticket — wants festive + wedding season content" },
  { id: "l-06", name: "Mohammed Irfan", company: "Irfan Motors", phone: "+91 98941 30006", email: "irfan@irfanmotors.in", source: "Google Ads", service: "Social Media Management", stage: "Discovery", value: 50000, ownerId: "p-priya", nextFollowUp: "2026-09-28", score: 67, createdAt: "2026-09-10" },
  { id: "l-07", name: "Lakshmi Narayanan", company: "LN Constructions", phone: "+91 98941 30007", email: "ln@lnconstructions.in", source: "Referral", service: "Video Production", stage: "Proposal", value: 90000, ownerId: "p-ashwin", nextFollowUp: "2026-09-25", score: 79, createdAt: "2026-09-05", notes: "Proposal v2 sent 22 Sep" },
  { id: "l-08", name: "Shalini Prabhu", company: "Prabhu Yoga Studio", phone: "+91 98941 30008", email: "shalini@prabhuyoga.in", source: "WhatsApp", service: "Personal Branding", stage: "Proposal", value: 30000, ownerId: "p-priya", nextFollowUp: "2026-09-29", score: 61, createdAt: "2026-09-08" },
  { id: "l-09", name: "Balaji Textiles", company: "Balaji Textiles", phone: "+91 98941 30009", email: "info@balajitex.com", source: "Event", service: "Video Production", stage: "Negotiation", value: 75000, ownerId: "p-jana", nextFollowUp: "2026-09-26", score: 82, createdAt: "2026-08-28", notes: "Asking 12% discount — above sales authority (10%)" },
  { id: "l-10", name: "Nirmala", company: "Nirmala Cooking Academy", phone: "+91 98941 30010", email: "nirmala@cookacademy.in", source: "Instagram", service: "Personal Branding", stage: "Won", value: 40000, ownerId: "p-priya", nextFollowUp: "2026-10-01", score: 90, createdAt: "2026-08-20" },
  { id: "l-11", name: "Karan Mehta", company: "FitZone Gyms", phone: "+91 98941 30011", email: "karan@fitzone.in", source: "Meta Ads", service: "Social Media Management", stage: "Lost", value: 45000, ownerId: "p-priya", nextFollowUp: "2026-12-01", score: 40, createdAt: "2026-08-15", notes: "Lost — chose cheaper freelancer. Reopen in Dec." },
  { id: "l-12", name: "Harish Chandran", company: "Chandran Hospitals", phone: "+91 98941 30012", email: "harish@chandranhospitals.in", source: "Referral", service: "Video Production", stage: "Qualified", value: 150000, ownerId: "p-jana", nextFollowUp: "2026-09-30", score: 88, createdAt: "2026-09-16" },
];

// ───────────────────────────────── Assets ─────────────────────────────────

export const assets: Asset[] = [
  { id: "as-01", tag: "GM-CAM-01", name: "Sony A7 IV body", category: "Camera", purchaseValue: 200000, purchaseDate: "2025-06-10", usefulLifeYears: 1, residualValue: 20000, status: "checked-out", custodianId: "p-vignesh", condition: "Good", hoursUsed: 612 },
  { id: "as-02", tag: "GM-CAM-02", name: "Sony A7 III body", category: "Camera", purchaseValue: 145000, purchaseDate: "2024-02-12", usefulLifeYears: 3, residualValue: 25000, status: "available", condition: "Good", hoursUsed: 1480 },
  { id: "as-03", tag: "GM-LEN-01", name: "Sony FE 50mm f/1.8", category: "Lens", purchaseValue: 22000, purchaseDate: "2024-02-12", usefulLifeYears: 4, residualValue: 4000, status: "checked-out", custodianId: "p-vignesh", condition: "Excellent", hoursUsed: 900 },
  { id: "as-04", tag: "GM-LEN-02", name: "Sigma 35mm f/1.4 DG", category: "Lens", purchaseValue: 68000, purchaseDate: "2024-08-01", usefulLifeYears: 4, residualValue: 12000, status: "available", condition: "Excellent", hoursUsed: 540 },
  { id: "as-05", tag: "GM-LEN-03", name: "Tamron 28-75mm f/2.8", category: "Lens", purchaseValue: 72000, purchaseDate: "2025-01-20", usefulLifeYears: 4, residualValue: 15000, status: "reserved", condition: "Good", hoursUsed: 380 },
  { id: "as-06", tag: "GM-LGT-01", name: "Godox SL-60W LED (set of 3)", category: "Lighting", purchaseValue: 36000, purchaseDate: "2024-03-05", usefulLifeYears: 3, residualValue: 3000, status: "available", condition: "Good", hoursUsed: 1100 },
  { id: "as-07", tag: "GM-LGT-02", name: "Softbox 90cm (pair)", category: "Lighting", purchaseValue: 8000, purchaseDate: "2024-03-05", usefulLifeYears: 3, residualValue: 0, status: "available", condition: "Fair", hoursUsed: 1100 },
  { id: "as-08", tag: "GM-AUD-01", name: "Rode Wireless GO II", category: "Audio", purchaseValue: 28000, purchaseDate: "2024-06-18", usefulLifeYears: 3, residualValue: 4000, status: "checked-out", custodianId: "p-vignesh", condition: "Good", hoursUsed: 760 },
  { id: "as-09", tag: "GM-AUD-02", name: "Rode NTG4+ shotgun mic", category: "Audio", purchaseValue: 32000, purchaseDate: "2024-06-18", usefulLifeYears: 4, residualValue: 5000, status: "maintenance", condition: "Needs repair", hoursUsed: 690 },
  { id: "as-10", tag: "GM-SUP-01", name: "DJI RS 3 gimbal", category: "Support", purchaseValue: 42000, purchaseDate: "2025-02-11", usefulLifeYears: 3, residualValue: 6000, status: "available", condition: "Excellent", hoursUsed: 210 },
  { id: "as-11", tag: "GM-SUP-02", name: "Tripod + stand base (x2)", category: "Support", purchaseValue: 14000, purchaseDate: "2023-11-01", usefulLifeYears: 5, residualValue: 1000, status: "available", condition: "Good", hoursUsed: 1900 },
  { id: "as-12", tag: "GM-STO-01", name: "Samsung T7 2TB SSD", category: "Storage", purchaseValue: 16000, purchaseDate: "2025-04-02", usefulLifeYears: 3, residualValue: 0, status: "checked-out", custodianId: "p-divya", condition: "Good", hoursUsed: 0 },
  { id: "as-13", tag: "GM-STO-02", name: "Synology NAS 16TB (backup)", category: "Storage", purchaseValue: 95000, purchaseDate: "2024-01-15", usefulLifeYears: 5, residualValue: 10000, status: "available", condition: "Excellent", hoursUsed: 0 },
  { id: "as-14", tag: "GM-PC-01", name: "Edit workstation — Ryzen 9 / RTX 4070", category: "Computer", purchaseValue: 185000, purchaseDate: "2024-07-20", usefulLifeYears: 4, residualValue: 20000, status: "checked-out", custodianId: "p-divya", condition: "Excellent", hoursUsed: 3200 },
  { id: "as-15", tag: "GM-PC-02", name: "MacBook Pro 14 M3", category: "Computer", purchaseValue: 199000, purchaseDate: "2025-01-08", usefulLifeYears: 4, residualValue: 40000, status: "checked-out", custodianId: "p-surya", condition: "Good", hoursUsed: 1900 },
  { id: "as-16", tag: "GM-PWR-01", name: "NP-FZ100 batteries (x4)", category: "Power", purchaseValue: 18000, purchaseDate: "2025-06-10", usefulLifeYears: 2, residualValue: 0, status: "checked-out", custodianId: "p-vignesh", condition: "Good", hoursUsed: 600 },
  { id: "as-17", tag: "GM-ACC-01", name: "SD cards 128GB V90 (x3)", category: "Accessory", purchaseValue: 21000, purchaseDate: "2025-06-10", usefulLifeYears: 2, residualValue: 0, status: "checked-out", custodianId: "p-vignesh", condition: "Good", hoursUsed: 0 },
];

// ────────────────────────────── Helpers ──────────────────────────────

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export function isOverdue(v: Video) {
  return !["Approved", "Published"].includes(v.stage) && daysBetween(TODAY, v.dueDate) < 0;
}
