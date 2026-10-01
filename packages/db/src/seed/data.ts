// Sample data for local, test and staging servers — invented, never real client data (P1-02).
// It matches the web demo (apps/web/src/lib/mock) so the demo and the real app show the same agency.
// Every email uses the reserved .test domain, so nothing seeded can ever receive a real email.

export interface SeedPerson {
  name: string;
  email: string;
  /** Role key in the agency — one of the default roles (DEFAULT_ROLES in @gm/shared). */
  role: string;
  title?: string;
}

export interface SeedClient {
  code: string;
  name: string;
  industry: string;
  city: string;
  fitment: "amazing" | "bread_winning" | "convenience" | "dangerous";
  health: number;
  /** Email of the account owner (a seeded person). */
  owner: string;
  contacts: { name: string; title?: string; email?: string; phone: string; approver: boolean }[];
  agreement?: {
    title: string;
    packageName: string;
    status: "active" | "renewal_due";
    startDate: string;
    endDate: string;
    monthlyFee: number;
    billing: string;
    revisionsPerDeliverable: number;
  };
}

export interface SeedPackage {
  name: string;
  description?: string;
  monthlyFee: number;
  deliverables: { name: string; perMonth: number; kind: "video" | "post" | "story" | "other" }[];
  shootDays: number;
  revisionsPerDeliverable: number;
  platforms: string[];
  billing?: string;
}

/** The agency's profile (Settings → Agency profile). */
export interface SeedProfile {
  brandColor?: string;
  businessStage?: "struggle" | "survival" | "stability" | "success" | "scale";
  phone?: string;
  email?: string;
  website?: string;
  city?: string;
  languages?: string[];
}

export interface SeedLead {
  name: string;
  company: string;
  phone: string;
  email: string;
  source: string;
  stage: "new" | "contacted" | "qualified" | "discovery" | "proposal" | "negotiation" | "won" | "lost";
  value: number;
  owner: string;
  nextFollowUp: string;
}

export interface SeedAgency {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "growth" | "pro" | "internal";
  profile?: SeedProfile;
  people: SeedPerson[];
  packages: SeedPackage[];
  clients: SeedClient[];
  leads: SeedLead[];
}

const gm = (local: string) => `${local}@geniemagnet.test`;

/** Tenant #1. */
export const genieMagnet: SeedAgency = {
  id: "019a0000-0000-7000-8000-000000000001",
  name: "Genie Magnet",
  slug: "genie-magnet",
  plan: "internal",
  profile: { brandColor: "#1E3A8A", city: "Appakudal", phone: "+91 98400 11000", email: "hello@geniemagnet.test", languages: ["en", "ta"] },
  people: [
    { name: "Janarthanan", email: gm("jana"), role: "owner", title: "Founder & MD" },
    { name: "Ashwin", email: gm("ashwin"), role: "manager", title: "Company Manager" },
    { name: "Priya Venkatesh", email: gm("priya"), role: "team_leader", title: "Sales & Marketing Lead" },
    { name: "Karthik Subramanian", email: gm("karthik"), role: "team_leader", title: "Content Director" },
    { name: "Vignesh Kumar", email: gm("vignesh"), role: "shooter", title: "Camera Man" },
    { name: "Divya Lakshmi", email: gm("divya"), role: "editor", title: "Senior Video Editor" },
    { name: "Surya Prakash", email: gm("surya"), role: "editor", title: "Video Editor" },
    { name: "Meena Ravi", email: gm("meena"), role: "social_media_manager", title: "Social Media Manager" },
    { name: "Harini Selvam", email: gm("harini"), role: "hr", title: "HR & Admin Executive" },
    // Not in the demo: a sample finance person, so finance permissions can be tried.
    { name: "Anitha Rajan", email: gm("anitha"), role: "finance", title: "Accounts" },
    { name: "Keerthana Mohan", email: "keerthana@freelance.test", role: "script_writer", title: "Script Writer (freelance)" },
    // Rahul also works for Zen Studio, so switching agencies can be tried with a real person.
    { name: "Rahul Menon", email: "rahul@freelance.test", role: "freelancer", title: "Freelance Editor" },
  ],
  packages: [
    {
      name: "Growth Video Pack",
      description: "Reels, long-form videos and ad creatives for growing brands.",
      monthlyFee: 85000,
      deliverables: [
        { name: "Reels", perMonth: 8, kind: "video" },
        { name: "Long-form videos", perMonth: 2, kind: "video" },
        { name: "Ad creatives", perMonth: 2, kind: "video" },
      ],
      shootDays: 2,
      revisionsPerDeliverable: 2,
      platforms: ["instagram", "youtube", "facebook"],
      billing: "Monthly advance",
    },
    {
      name: "Social Starter Pack",
      description: "Content and posting on the client's pages.",
      monthlyFee: 65000,
      deliverables: [
        { name: "Reels", perMonth: 10, kind: "video" },
        { name: "Static posts", perMonth: 12, kind: "post" },
        { name: "Stories", perMonth: 20, kind: "story" },
      ],
      shootDays: 1,
      revisionsPerDeliverable: 2,
      platforms: ["instagram", "facebook"],
      billing: "Monthly advance",
    },
    {
      name: "Authority Builder",
      description: "Personal branding for doctors, coaches and founders.",
      monthlyFee: 48000,
      deliverables: [
        { name: "Explainer reels", perMonth: 6, kind: "video" },
        { name: "Testimonial videos", perMonth: 2, kind: "video" },
      ],
      shootDays: 1,
      revisionsPerDeliverable: 1,
      platforms: ["instagram", "youtube", "linkedin"],
      billing: "Monthly arrears",
    },
    {
      name: "Campaign Sprint",
      monthlyFee: 30000,
      deliverables: [
        { name: "Reels", perMonth: 4, kind: "video" },
        { name: "Intro videos", perMonth: 1, kind: "video" },
      ],
      shootDays: 1,
      revisionsPerDeliverable: 2,
      platforms: ["instagram"],
      billing: "50% advance",
    },
    {
      name: "Property Showcase",
      monthlyFee: 40000,
      deliverables: [
        { name: "Walkthrough videos", perMonth: 2, kind: "video" },
        { name: "Reels", perMonth: 4, kind: "video" },
      ],
      shootDays: 1,
      revisionsPerDeliverable: 2,
      platforms: ["instagram", "youtube"],
      billing: "Monthly arrears",
    },
  ],
  clients: [
    {
      code: "KVR",
      name: "Kaveri Organics",
      industry: "FMCG · Organic foods",
      city: "Erode",
      fitment: "bread_winning",
      health: 86,
      owner: gm("ashwin"),
      contacts: [
        { name: "Ramesh Gounder", title: "Managing Partner", email: "ramesh@kaveriorganics.test", phone: "+91 94430 55101", approver: true },
        { name: "Nithya R", title: "Marketing Executive", email: "nithya@kaveriorganics.test", phone: "+91 94430 55102", approver: false },
      ],
      agreement: {
        title: "Kaveri Organics · Growth Video Retainer",
        packageName: "Growth Video Pack",
        status: "active",
        startDate: "2026-04-01",
        endDate: "2027-03-31",
        monthlyFee: 85000,
        billing: "Monthly advance",
        revisionsPerDeliverable: 2,
      },
    },
    {
      code: "SLS",
      name: "Sri Lakshmi Silks",
      industry: "Retail · Textiles",
      city: "Kanchipuram",
      fitment: "amazing",
      health: 92,
      owner: gm("priya"),
      contacts: [{ name: "Meenakshi Sundaram", title: "Owner", email: "meenakshi@srilakshmisilks.test", phone: "+91 94430 55201", approver: true }],
      agreement: {
        title: "Sri Lakshmi Silks · Festive Content Retainer",
        packageName: "Social Starter Pack",
        status: "renewal_due",
        startDate: "2025-10-01",
        endDate: "2026-10-31",
        monthlyFee: 65000,
        billing: "Monthly advance",
        revisionsPerDeliverable: 2,
      },
    },
    {
      code: "NVD",
      name: "Nova Dental Care",
      industry: "Healthcare · Dental clinics",
      city: "Coimbatore",
      fitment: "convenience",
      health: 64,
      owner: gm("ashwin"),
      contacts: [
        { name: "Dr. Arvind Balaji", title: "Chief Dentist", email: "arvind@novadental.test", phone: "+91 94430 55301", approver: true },
        { name: "Kavya M", title: "Clinic Coordinator", email: "kavya@novadental.test", phone: "+91 94430 55302", approver: false },
      ],
      agreement: {
        title: "Nova Dental · Patient Education Series",
        packageName: "Authority Builder",
        status: "active",
        startDate: "2026-02-01",
        endDate: "2027-01-31",
        monthlyFee: 48000,
        billing: "Monthly arrears",
        revisionsPerDeliverable: 1,
      },
    },
    {
      code: "BPA",
      name: "BrightPath Academy",
      industry: "Education · Coaching",
      city: "Salem",
      fitment: "convenience",
      health: 74,
      owner: gm("priya"),
      contacts: [{ name: "Suresh Kannan", title: "Director", email: "suresh@brightpath.test", phone: "+91 94430 55401", approver: true }],
      agreement: {
        title: "BrightPath · Admissions Campaign (Partner)",
        packageName: "Campaign Sprint",
        status: "active",
        startDate: "2026-05-15",
        endDate: "2026-11-15",
        monthlyFee: 30000,
        billing: "50% advance",
        revisionsPerDeliverable: 2,
      },
    },
    {
      code: "UNR",
      name: "Urban Nest Realty",
      industry: "Real estate",
      city: "Tiruppur",
      fitment: "dangerous",
      health: 38,
      owner: gm("ashwin"),
      contacts: [{ name: "Vikram Shetty", title: "Sales Head", email: "vikram@urbannest.test", phone: "+91 94430 55501", approver: true }],
      agreement: {
        title: "Urban Nest · Project Walkthroughs (Partner)",
        packageName: "Property Showcase",
        status: "active",
        startDate: "2026-06-01",
        endDate: "2026-12-31",
        monthlyFee: 40000,
        billing: "Monthly arrears",
        revisionsPerDeliverable: 2,
      },
    },
  ],
  leads: [
    {
      name: "Anand Raj",
      company: "Anand Sweets & Savouries",
      phone: "+91 98941 30001",
      email: "anand@anandsweets.test",
      source: "Meta Ads",
      stage: "new",
      value: 60000,
      owner: gm("priya"),
      nextFollowUp: "2026-10-05",
    },
    {
      name: "Fathima Begum",
      company: "Zaara Boutique",
      phone: "+91 98941 30002",
      email: "hello@zaaraboutique.test",
      source: "Instagram",
      stage: "new",
      value: 35000,
      owner: gm("priya"),
      nextFollowUp: "2026-10-06",
    },
    {
      name: "Dr. Senthil",
      company: "Senthil Ortho Clinic",
      phone: "+91 98941 30003",
      email: "senthil@orthocare.test",
      source: "Referral",
      stage: "contacted",
      value: 55000,
      owner: gm("ashwin"),
      nextFollowUp: "2026-10-05",
    },
    {
      name: "Gowtham",
      company: "GreenLeaf Hydroponics",
      phone: "+91 98941 30004",
      email: "gowtham@greenleaf.test",
      source: "Website",
      stage: "contacted",
      value: 45000,
      owner: gm("priya"),
      nextFollowUp: "2026-10-07",
    },
    {
      name: "Revathi Shankar",
      company: "Revathi Jewellers",
      phone: "+91 98941 30005",
      email: "revathi@revathijewels.test",
      source: "BNI",
      stage: "qualified",
      value: 120000,
      owner: gm("jana"),
      nextFollowUp: "2026-10-06",
    },
    {
      name: "Mohammed Irfan",
      company: "Irfan Motors",
      phone: "+91 98941 30006",
      email: "irfan@irfanmotors.test",
      source: "Google Ads",
      stage: "discovery",
      value: 50000,
      owner: gm("priya"),
      nextFollowUp: "2026-10-08",
    },
    {
      name: "Lakshmi Narayanan",
      company: "LN Constructions",
      phone: "+91 98941 30007",
      email: "ln@lnconstructions.test",
      source: "Referral",
      stage: "proposal",
      value: 90000,
      owner: gm("ashwin"),
      nextFollowUp: "2026-10-05",
    },
    {
      name: "Shalini Prabhu",
      company: "Prabhu Yoga Studio",
      phone: "+91 98941 30008",
      email: "shalini@prabhuyoga.test",
      source: "WhatsApp",
      stage: "proposal",
      value: 30000,
      owner: gm("priya"),
      nextFollowUp: "2026-10-09",
    },
    {
      name: "Balaji",
      company: "Balaji Textiles",
      phone: "+91 98941 30009",
      email: "info@balajitex.test",
      source: "Event",
      stage: "negotiation",
      value: 75000,
      owner: gm("jana"),
      nextFollowUp: "2026-10-06",
    },
    {
      name: "Nirmala",
      company: "Nirmala Cooking Academy",
      phone: "+91 98941 30010",
      email: "nirmala@cookacademy.test",
      source: "Instagram",
      stage: "won",
      value: 40000,
      owner: gm("priya"),
      nextFollowUp: "2026-10-12",
    },
    {
      name: "Karan Mehta",
      company: "FitZone Gyms",
      phone: "+91 98941 30011",
      email: "karan@fitzone.test",
      source: "Meta Ads",
      stage: "lost",
      value: 45000,
      owner: gm("priya"),
      nextFollowUp: "2026-12-01",
    },
    {
      name: "Harish Chandran",
      company: "Chandran Hospitals",
      phone: "+91 98941 30012",
      email: "harish@chandranhospitals.test",
      source: "Referral",
      stage: "qualified",
      value: 150000,
      owner: gm("jana"),
      nextFollowUp: "2026-10-10",
    },
  ],
};

/** A second agency on every server except production, for cross-agency checks. */
export const zenStudio: SeedAgency = {
  id: "019a0000-0000-7000-8000-000000000002",
  name: "Zen Studio (test agency)",
  slug: "zen-studio",
  plan: "starter",
  people: [
    { name: "Zara Ahmed", email: "zara@zenstudio.test", role: "owner", title: "Founder" },
    { name: "Leo Fernandes", email: "leo@zenstudio.test", role: "editor", title: "Editor" },
    { name: "Rahul Menon", email: "rahul@freelance.test", role: "freelancer", title: "Freelance Editor" },
  ],
  packages: [
    {
      name: "Reels Monthly",
      monthlyFee: 25000,
      deliverables: [
        { name: "Reels", perMonth: 8, kind: "video" },
        { name: "Static posts", perMonth: 4, kind: "post" },
      ],
      shootDays: 1,
      revisionsPerDeliverable: 2,
      platforms: ["instagram"],
      billing: "Monthly advance",
    },
  ],
  clients: [
    {
      // Same code as Genie Magnet's Kaveri Organics on purpose: codes only need to be unique inside one agency.
      code: "KVR",
      name: "Kovai Ventures",
      industry: "Manufacturing",
      city: "Coimbatore",
      fitment: "convenience",
      health: 70,
      owner: "zara@zenstudio.test",
      contacts: [{ name: "Prakash Iyer", title: "Director", email: "prakash@kovaiventures.test", phone: "+91 90000 70001", approver: true }],
      agreement: {
        title: "Kovai Ventures · Reels Monthly",
        packageName: "Reels Monthly",
        status: "active",
        startDate: "2026-07-01",
        endDate: "2027-06-30",
        monthlyFee: 25000,
        billing: "Monthly advance",
        revisionsPerDeliverable: 2,
      },
    },
    {
      code: "MBC",
      name: "Marina Bay Cafe",
      industry: "Food & beverage",
      city: "Chennai",
      fitment: "amazing",
      health: 88,
      owner: "zara@zenstudio.test",
      contacts: [{ name: "Ayesha Khan", title: "Owner", email: "ayesha@marinabay.test", phone: "+91 90000 70002", approver: true }],
    },
  ],
  leads: [
    {
      name: "Ravi",
      company: "Ravi Bakes",
      phone: "+91 90000 70101",
      email: "ravi@ravibakes.test",
      source: "Instagram",
      stage: "new",
      value: 20000,
      owner: "zara@zenstudio.test",
      nextFollowUp: "2026-10-07",
    },
  ],
};

export const sampleAgencies = [genieMagnet, zenStudio];
