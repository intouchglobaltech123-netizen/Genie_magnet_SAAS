// Seeded questionnaire responses. "Today" in the demo is 25 Sep 2026.
import type { Answers } from "./templates";

export interface Reminder {
  day: number;
  on: string; // YYYY-MM-DD
  channel: "WhatsApp" | "Email" | "In-app";
}

export interface Respondent {
  id: string;
  template: "client" | "agency";
  name: string;
  contact: string;
  phone: string;
  /** Public link token — /q/<token> */
  token: string;
  packageName?: string;
  sentOn?: string;
  mode?: "link" | "assisted";
  reminders: Reminder[];
  answers: Answers;
  /** Genie Assistant's draft content pillars, shown once the needs section is answered. */
  pillars?: { title: string; example: string }[];
}

const urbanAnswers: Answers = {
  c1: "Urban Nest Realty Pvt Ltd (brand: Urban Nest)",
  c2: "Vikram Shetty · Sales Head · +91 94430 55501 · vikram@urbannest.in\nRajesh Nair · Managing Director · +91 94430 55500 · rajesh@urbannest.in",
  c3: "9",
  c3b: "Private limited",
  c4: "Residential apartments and gated villa communities. Head office in Tiruppur, site offices at Avinashi Road and Perumanallur.",
  c5: "www.urbannest.in · instagram.com/urbannestrealty · youtube.com/@urbannest",
  c6: "Success",
  c26: "3 months: site walkthroughs live for all 3 projects · 6 months: 40 qualified site visits a month from social · 12 months: Urban Nest known as the premium builder in Tiruppur",
  c27: [
    { metric: "Qualified site visits / month", now: "12", target: "40" },
    { metric: "Instagram followers", now: "3200", target: "12000" },
    { metric: "YouTube walkthrough views / month", now: "1500", target: "20000" },
  ],
  c27b: "150000",
  c28: ["More enquiries and leads", "Brand awareness", "Launch a product or branch"],
  c29: ["UrbanNest_logo_pack.zip", "Brand_guide_2025.pdf"],
  c29b: ["Premium", "Expert and trusted"],
  c29c: "Show real site progress only — no renders presented as finished homes. Avoid naming competitor projects.",
  c30: ["Tamil", "English"],
  c30b: "Vikram on camera for walkthroughs. Sites open 9 AM–5 PM; golden-hour shoots at Perumanallur.",
  c31: ["Instagram", "YouTube", "Facebook Page", "Meta Ads account"],
  c32: [{ name: "Vikram Shetty", phone: "+91 94430 55501", approves: "Everything" }],
  c33: "Accounts · Kavitha R · GSTIN 33AABCU4521K1Z6 · 14 Kumaran Road, Tiruppur 641601",
  c7: ["Consumers (B2C)", "Channel partners (B2CH)"],
  c9: "Families aged 30–50, household income ₹12L+, business owners and NRIs from Tiruppur and Coimbatore.",
  c10: "Local property brokers who bring 30% of buyers; paid 1.5% commission.",
  c11: [
    { type: "Families (end users)", count: "140", share: "55", profit: "High" },
    { type: "NRI investors", count: "35", share: "25", profit: "High" },
    { type: "Broker-led buyers", count: "60", share: "20", profit: "Low" },
  ],
  c12: "Young IT couples from Coimbatore looking for weekend homes.",
  c13: "Trust in on-time handover; clear pricing without hidden charges.",
  c14: "A safe gated community close to schools, with good resale value.",
  c15: "Legal clarity (approved plans), transparent payment milestones.",
  c16: "Owning a home the family is proud of; status in the community.",
  c17: "Home-loan guidance and interior packages.",
  c18: [
    { name: "2 BHK apartment", price: "4800000", margin: "18", share: "40", effort: "Low" },
    { name: "3 BHK apartment", price: "6900000", margin: "22", share: "35", effort: "Low" },
    { name: "Gated villa", price: "12500000", margin: "26", share: "20", effort: "High" },
    { name: "Resale support", price: "150000", margin: "8", share: "5", effort: "High" },
  ],
  c19: [
    { name: "Casagrand", how: "Big-brand trust, heavy ad spend" },
    { name: "Local builders", how: "Lower price, slower handover" },
    { name: "Plot developers", how: "Cheaper entry for first-time buyers" },
  ],
  c20: ["Better quality", "Trusted name"],
  c21: "No in-house team. Leads come from brokers, walk-ins and a small Meta ads budget.",
  c22: "Newspaper inserts (weak), Meta lead ads (good volume, low quality), site-visit weekends (best).",
  c23: ["Instagram", "YouTube", "Facebook", "WhatsApp"],
  c24: ["Short videos / Reels", "Long videos", "Testimonials"],
  c25: "Enquiry → call within 1 hour → site visit → second visit with family → booking. Strength: Vikram closes 1 in 4 site visits.",
};

const nirmalaAnswers: Answers = {
  c1: "Nirmala Cooking Academy",
  c2: "Nirmala Devi · Founder & Chef · +91 98421 33017 · nirmala@nirmalacooking.in",
  c3: "6",
  c3b: "Sole proprietorship",
  c4: "Cooking and baking classes, online and at our Madurai studio (KK Nagar). One branch.",
  c5: "instagram.com/nirmalacooks · youtube.com/@nirmalacookingacademy",
  c6: "Stability",
  c26: "3 months: steady weekly reels and 2 course launches · 6 months: 500 paid online students · 12 months: Nirmala known as Madurai's baking teacher",
  c27: [
    { metric: "Instagram followers", now: "18400", target: "40000" },
    { metric: "Course enquiries / month", now: "60", target: "200" },
  ],
  c27b: "60000",
  c28: ["Founder's personal brand", "More enquiries and leads", "Customer education"],
  c29b: ["Warm and friendly", "Expert and trusted"],
  c29c: "Only vegetarian recipes. No brand names of ingredients on screen.",
  c30: ["Tamil", "Tanglish"],
  c30b: "Nirmala on camera; studio kitchen in KK Nagar, mornings 7–11 AM.",
  c31: ["Instagram", "YouTube"],
  c33: "Nirmala Devi · GSTIN 33ABCPN7781M1ZP · 22 KK Nagar Main Road, Madurai 625020",
  c7: ["Consumers (B2C)"],
  c9: "Home-makers and working women aged 25–45 in Tamil Nadu; students planning home bakeries.",
  c11: [{ type: "Online students", count: "320", share: "", profit: "" }],
};

const agencyAnswers: Answers = {
  a1: "Genie Magnet — Janarthanan (Founder & Managing Director), Ashwin (Company Manager) · jana@geniemagnet.in · +91 98400 11001",
  a1b: "5 years · Private limited · Appakudal, Erode",
  a2: "Stability",
  a3: ["Video production", "Social media management", "Personal branding", "Consulting & training", "Courses & community"],
  a4: [
    { name: "Growth Video Pack", price: "85000", videos: "12", posts: "0", shootDays: "2", revisions: "2" },
    { name: "Social Starter Pack", price: "65000", videos: "10", posts: "32", shootDays: "1", revisions: "2" },
    { name: "Authority Builder", price: "48000", videos: "8", posts: "0", shootDays: "1", revisions: "1" },
    { name: "Property Showcase", price: "40000", videos: "6", posts: "0", shootDays: "1", revisions: "2" },
    { name: "Campaign Sprint", price: "30000", videos: "5", posts: "0", shootDays: "1", revisions: "2" },
  ],
  a13: "₹60L revenue in FY 2026-27 with a team that runs delivery without Janarthanan — so he can focus on consulting and the Growth OS community. WHY: build a business that serves 100 local brands a year.",
  a14: "3840000",
  a14b: "6000000",
  a20: [
    { name: "Janarthanan", role: "Founder & MD", approves: "Everything" },
    { name: "Ashwin", role: "Company Manager", approves: "Delivery" },
    { name: "Karthik Subramanian", role: "Content Director", approves: "Content" },
    { name: "Priya Venkatesh", role: "Sales & Marketing Lead", approves: "Nothing" },
    { name: "Harini Selvam", role: "HR & Admin Executive", approves: "HR" },
    { name: "Finance Desk", role: "Accounts", approves: "Finance" },
  ],
  a5: [
    { type: "Recurring video retainers (FMCG, retail)", count: "2", share: "52", billing: "900000", effort: "High", return: "High" },
    { type: "Social media retainers", count: "1", share: "22", billing: "780000", effort: "Low", return: "High" },
    { type: "Doctors & coaches (personal branding)", count: "2", share: "16", billing: "470000", effort: "Low", return: "Low" },
    { type: "Real-estate campaigns", count: "1", share: "10", billing: "480000", effort: "High", return: "Low" },
  ],
  a7: [
    { row: "Marketing", consistent: "No", owner: "Yes", results: "Low", leader: "No", action: "Hire" },
    { row: "Sales", consistent: "No", owner: "Yes", results: "High", leader: "No", action: "Develop" },
    { row: "Operations / delivery", consistent: "Yes", owner: "No", results: "High", leader: "Yes", action: "Delegate" },
    { row: "R&D", consistent: "No", owner: "Yes", results: "Low", leader: "No", action: "Do it yourself" },
    { row: "Accounts & Finance", consistent: "Yes", owner: "Yes", results: "Low", leader: "No", action: "Outsource" },
    { row: "HR", consistent: "Yes", owner: "No", results: "High", leader: "Yes", action: "Develop" },
    { row: "Management", consistent: "No", owner: "Yes", results: "Low", leader: "No", action: "Develop" },
  ],
  a10: "Working: video delivery, editing quality, client relationships. Not working: our own marketing, collections follow-up, and every pricing decision waits for Janarthanan.",
  a15: [
    { row: "Q1 Apr–Jun", revenue: "850000", margin: "12" },
    { row: "Q2 Jul–Sep", revenue: "1050000", margin: "14" },
    { row: "Q3 Oct–Dec", revenue: "1700000", margin: "15" },
    { row: "Q4 Jan–Mar", revenue: "2400000", margin: "17" },
  ],
};

export const respondents: Respondent[] = [
  {
    id: "ob-nirmala",
    template: "client",
    name: "Nirmala Cooking Academy",
    contact: "Nirmala Devi",
    phone: "+91 98421 33017",
    token: "nirmala-7f3k",
    packageName: "Authority Builder",
    sentOn: "2026-09-19",
    mode: "link",
    reminders: [
      { day: 2, on: "2026-09-21", channel: "WhatsApp" },
      { day: 5, on: "2026-09-24", channel: "WhatsApp" },
    ],
    answers: nirmalaAnswers,
    pillars: [
      { title: "Baking basics, done right", example: "Why your sponge cake sinks — 3 fixes in 30 seconds" },
      { title: "Student success stories", example: "From home kitchen to a ₹40K/month home bakery" },
      { title: "Festive specials", example: "Deepavali sweets you can make in one evening" },
      { title: "Behind the studio", example: "A morning batch at KK Nagar, start to finish" },
    ],
  },
  {
    id: "ob-annapoorna",
    template: "client",
    name: "Sree Annapoorna Sweets",
    contact: "Senthil Kumar",
    phone: "+91 97877 40218",
    token: "annapoorna-2m8x",
    packageName: "Social Starter Pack",
    reminders: [],
    answers: {},
  },
  {
    id: "ob-urban",
    template: "client",
    name: "Urban Nest Realty",
    contact: "Vikram Shetty",
    phone: "+91 94430 55501",
    token: "urban-nest-3kq9",
    packageName: "Property Showcase",
    sentOn: "2026-05-22",
    mode: "assisted",
    reminders: [{ day: 2, on: "2026-05-24", channel: "WhatsApp" }],
    answers: urbanAnswers,
    pillars: [
      { title: "Site progress, honestly", example: "Tower B: slab 7 done — walk the floor with Vikram" },
      { title: "Buyer education", example: "DTCP vs RERA approval — what to check before you book" },
      { title: "Life at Urban Nest", example: "A Saturday with the Raghavan family, 6 months after handover" },
      { title: "Locality guide", example: "Schools, hospitals and markets within 10 minutes of Avinashi Road" },
    ],
  },
  {
    id: "agency",
    template: "agency",
    name: "Genie Magnet",
    contact: "Janarthanan",
    phone: "+91 98400 11001",
    token: "genie-magnet",
    sentOn: "2026-09-21",
    mode: "assisted",
    reminders: [],
    answers: agencyAnswers,
  },
];

export const respondentById = (id: string) => respondents.find((r) => r.id === id);
export const respondentByToken = (token: string) => respondents.find((r) => r.token === token);
