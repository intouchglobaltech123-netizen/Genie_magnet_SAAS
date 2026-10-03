// The Growth OS onboarding question sets (Appendix C), as written for the demo. Every new agency starts from these
// (converted to the onboarding engine's format in onboarding.ts) and then edits its own copy in the question builder.
import { BUSINESS_FUNCTIONS } from "./enums.js";

type QType = "text" | "long" | "number" | "currency" | "choice" | "multi" | "yesno" | "rating" | "table" | "file";

interface TableColumn {
  key: string;
  label: string;
  type?: "text" | "number" | "currency" | "select";
  options?: string[];
  placeholder?: string;
}

interface Question {
  id: string;
  label: string;
  help?: string;
  placeholder?: string;
  type: QType;
  options?: string[];
  optionHelp?: Record<string, string>;
  /** Max selections for `multi`. */
  max?: number;
  columns?: TableColumn[];
  /** Fixed first-column labels (e.g. the seven business functions). */
  fixedRows?: string[];
  /** Where the answer lands in the system — shown to the agency, never to the client. */
  maps: string;
  showIf?: { q: string; includes: string };
}

type SectionWhen = "required" | "7days";

interface Section {
  id: string;
  title: string;
  intro: string;
  when: SectionWhen;
  builds: string;
  questions: Question[];
}

interface QuestionnaireTemplate {
  id: "client" | "agency";
  name: string;
  version: string;
  audience: string;
  sections: Section[];
}

const STAGES = ["Struggle", "Survival", "Stability", "Success", "Scale"];
const STAGE_HELP: Record<string, string> = {
  Struggle: "Not yet making a steady income",
  Survival: "Covering costs, cash is tight",
  Stability: "Steady revenue and a small team",
  Success: "Profitable, systems mostly in place",
  Scale: "Growing branches, teams or new markets",
};
const FUNCTIONS = [...BUSINESS_FUNCTIONS];
const HL = ["High", "Low"];

// ───────────────────────────── Client questionnaire ─────────────────────────────

export const GROWTH_OS_CLIENT_SET: QuestionnaireTemplate = {
  id: "client",
  name: "Client onboarding questionnaire",
  version: "v1.0",
  audience: "Sent to every new client as soon as the sale is confirmed",
  sections: [
    {
      id: "basics",
      title: "Business basics",
      intro: "Tell us who you are, so we set up your profile correctly.",
      when: "required",
      builds: "Client profile",
      questions: [
        {
          id: "c1",
          label: "Business or legal name, and brand name if different",
          type: "text",
          placeholder: "e.g. Sree Annapoorna Sweets (brand: Annapoorna)",
          maps: "Client profile → name",
        },
        {
          id: "c2",
          label: "Owners, partners or directors — with phone number and email",
          type: "long",
          placeholder: "Name · role · phone · email",
          maps: "Client contacts",
        },
        { id: "c3", label: "Years in business", type: "number", placeholder: "e.g. 12", maps: "Client profile → founded" },
        {
          id: "c3b",
          label: "Business type",
          type: "choice",
          options: ["Sole proprietorship", "Partnership", "LLP", "Private limited", "Public limited"],
          maps: "Client profile → legal type",
        },
        {
          id: "c4",
          label: "Nature of the business, head-office location and branches",
          type: "long",
          placeholder: "What you sell, where you are, how many branches",
          maps: "Client profile → industry, city",
        },
        {
          id: "c5",
          label: "Website and social-media handles",
          type: "long",
          placeholder: "www… · instagram.com/… · youtube.com/@…",
          maps: "Connected platforms (to request access)",
        },
        {
          id: "c6",
          label: "Stage of the business",
          type: "choice",
          options: STAGES,
          optionHelp: STAGE_HELP,
          maps: "Client profile → business stage",
        },
      ],
    },
    {
      id: "goals",
      title: "Goals for this engagement",
      intro: "What does success look like? These become the targets in your monthly report.",
      when: "required",
      builds: "Engagement goals and report targets",
      questions: [
        {
          id: "c26",
          label: "What should this engagement achieve in 3, 6 and 12 months?",
          type: "long",
          placeholder: "3 months: … · 6 months: … · 12 months: …",
          maps: "Engagement goals",
        },
        {
          id: "c27",
          label: "Targets for reach, followers, leads or sales",
          type: "table",
          columns: [
            { key: "metric", label: "Metric", placeholder: "Instagram followers" },
            { key: "now", label: "Today", type: "number" },
            { key: "target", label: "In 6 months", type: "number" },
          ],
          maps: "Report targets (Outcomes)",
        },
        { id: "c27b", label: "Monthly marketing budget (content and ads)", type: "currency", placeholder: "50000", maps: "Engagement goals → budget" },
        {
          id: "c28",
          label: "Your top three priorities",
          type: "multi",
          max: 3,
          options: [
            "More enquiries and leads",
            "Brand awareness",
            "Sales from social media",
            "Founder's personal brand",
            "Customer education",
            "Launch a product or branch",
            "Festive campaigns",
            "Hiring and employer brand",
          ],
          maps: "Content priorities",
        },
      ],
    },
    {
      id: "brand",
      title: "Brand, access and approvals",
      intro: "What we need before the first shoot: your brand, your people and who approves.",
      when: "required",
      builds: "Brand kit, Genie Assistant brand voice and the production gate",
      questions: [
        {
          id: "c29",
          label: "Brand files: logo, colours, fonts and brand guide",
          type: "file",
          help: "Upload what you have. Missing files can come later.",
          maps: "Brand kit → files",
        },
        {
          id: "c29b",
          label: "Tone of voice",
          type: "multi",
          max: 3,
          options: ["Warm and friendly", "Premium", "Expert and trusted", "Bold", "Traditional", "Youthful", "Fun"],
          maps: "Genie Assistant brand voice",
        },
        {
          id: "c29c",
          label: "Do's and don'ts, and topics to avoid",
          type: "long",
          placeholder: "e.g. Never compare prices with competitors by name",
          maps: "Brand kit → rules",
        },
        {
          id: "c30",
          label: "Content languages",
          type: "multi",
          options: ["Tamil", "English", "Tanglish", "Hindi", "Malayalam", "Telugu", "Kannada"],
          maps: "Brand kit → languages",
        },
        {
          id: "c30b",
          label: "People who will appear on camera, shoot locations and timings",
          type: "long",
          placeholder: "Who · where · best days and times",
          maps: "Shoot planning defaults",
        },
        {
          id: "c31",
          label: "Which accounts have you shared access to?",
          type: "multi",
          options: ["Instagram", "Facebook Page", "YouTube", "LinkedIn", "Meta Ads account", "Google Business Profile", "Shared Drive folder"],
          maps: "Connected platforms",
        },
        {
          id: "c32",
          label: "Who approves topics, scripts and videos?",
          type: "table",
          columns: [
            { key: "name", label: "Name" },
            { key: "phone", label: "WhatsApp number" },
            { key: "approves", label: "Approves", type: "select", options: ["Topics", "Scripts", "Videos", "Everything"] },
          ],
          maps: "Client approvers and WhatsApp group",
        },
        { id: "c33", label: "Billing contact, GST number and billing address", type: "long", placeholder: "Name · GSTIN · address", maps: "Billing profile" },
      ],
    },
    {
      id: "model",
      title: "Business model and customers",
      intro: "Who buys from you — this shapes who every piece of content speaks to.",
      when: "7days",
      builds: "Personas and target audience",
      questions: [
        {
          id: "c7",
          label: "Who do you sell to?",
          type: "multi",
          options: ["Businesses (B2B)", "Consumers (B2C)", "Channel partners (B2CH)"],
          maps: "Business Canvas → customers",
        },
        {
          id: "c8",
          label: "Your B2B customers: industry, size, location and who decides to buy",
          type: "long",
          showIf: { q: "c7", includes: "Businesses (B2B)" },
          maps: "Personas",
        },
        {
          id: "c9",
          label: "Your B2C customers: age group, income, occupation and location",
          type: "long",
          showIf: { q: "c7", includes: "Consumers (B2C)" },
          maps: "Personas",
        },
        {
          id: "c10",
          label: "Your channel partners: industries, network strength and decision makers",
          type: "long",
          showIf: { q: "c7", includes: "Channel partners (B2CH)" },
          maps: "Personas",
        },
        {
          id: "c11",
          label: "For each customer type: how many you serve, their share of revenue and profitability",
          type: "table",
          columns: [
            { key: "type", label: "Customer type" },
            { key: "count", label: "How many", type: "number" },
            { key: "share", label: "% of revenue", type: "number" },
            { key: "profit", label: "Profitability", type: "select", options: HL },
          ],
          maps: "Business Canvas → customer segments",
        },
        { id: "c12", label: "Which customer segments could you serve but have not explored yet?", type: "long", maps: "Growth opportunities" },
      ],
    },
    {
      id: "needs",
      title: "Needs, problems and desires",
      intro: "Why customers choose you. Content pillars are built from these answers.",
      when: "7days",
      builds: "Content pillars and messaging",
      questions: [
        { id: "c13", label: "Which problems of your customers do your products or services solve?", type: "long", maps: "Content pillars" },
        { id: "c14", label: "Which needs do you fulfil?", type: "long", maps: "Content pillars" },
        { id: "c15", label: "What are their non-negotiable expectations from you?", type: "long", maps: "Messaging" },
        { id: "c16", label: "What deep-rooted desires do they have?", type: "long", maps: "Messaging" },
        { id: "c17", label: "Which needs or problems are you not addressing yet?", type: "long", maps: "Growth opportunities" },
      ],
    },
    {
      id: "products",
      title: "Products and services",
      intro: "What you sell and what each one is worth to you.",
      when: "7days",
      builds: "Customer Product Matrix",
      questions: [
        {
          id: "c18",
          label: "For each product or service: price, margin, share of revenue and effort to deliver",
          type: "table",
          columns: [
            { key: "name", label: "Product or service" },
            { key: "price", label: "Price (₹)", type: "currency" },
            { key: "margin", label: "Margin %", type: "number" },
            { key: "share", label: "% of revenue", type: "number" },
            { key: "effort", label: "Effort", type: "select", options: HL },
          ],
          maps: "Customer Product Matrix",
        },
      ],
    },
    {
      id: "competition",
      title: "Competition and positioning",
      intro: "Who you compete with and why customers should pick you.",
      when: "7days",
      builds: "Positioning in the Business Canvas",
      questions: [
        {
          id: "c19",
          label: "Your top 5 competitors, and how each one competes with you",
          type: "table",
          columns: [
            { key: "name", label: "Competitor" },
            { key: "how", label: "How they compete" },
          ],
          maps: "Business Canvas → competitors",
        },
        {
          id: "c20",
          label: "How are you different?",
          type: "multi",
          options: ["Cheaper", "Faster", "Better quality", "Unique product", "Better service", "Trusted name"],
          maps: "Business Canvas → positioning",
        },
      ],
    },
    {
      id: "marketing",
      title: "Marketing and sales today",
      intro: "Where you are today, so we can measure the change.",
      when: "7days",
      builds: "Channel plan and the results baseline",
      questions: [
        { id: "c21", label: "Do you have a marketing team? How are leads generated today?", type: "long", maps: "Results baseline" },
        { id: "c22", label: "Which marketing strategies have you tried, and which worked?", type: "long", maps: "Channel plan" },
        {
          id: "c23",
          label: "Active channels",
          type: "multi",
          options: ["Instagram", "Facebook", "YouTube", "LinkedIn", "X (Twitter)", "WhatsApp", "Google Business Profile", "Website / SEO"],
          maps: "Channel plan · Publishing platforms",
        },
        {
          id: "c24",
          label: "Content formats that suit you",
          type: "multi",
          options: ["Short videos / Reels", "Long videos", "Carousels", "Infographics", "Blogs", "Case studies", "Testimonials", "Podcasts"],
          maps: "Content formats",
        },
        { id: "c25", label: "Your sales process from lead to close, and your sales strengths", type: "long", maps: "Business Canvas → channels" },
      ],
    },
  ],
};

// ───────────────────────────── Agency questionnaire ─────────────────────────────

export const GROWTH_OS_AGENCY_SET: QuestionnaireTemplate = {
  id: "agency",
  name: "Agency onboarding questionnaire",
  version: "v1.0",
  audience: "Answered by the agency owner at sign-up; repeated at each 45-day strategic review",
  sections: [
    {
      id: "discovery",
      title: "Discovery details",
      intro: "The basics of your agency.",
      when: "required",
      builds: "Agency profile and stage",
      questions: [
        { id: "a1", label: "Agency name, owners and contacts", type: "long", maps: "Workspace → agency profile" },
        { id: "a1b", label: "Years in business, business type and location", type: "text", maps: "Workspace → agency profile" },
        { id: "a2", label: "Stage of the business", type: "choice", options: STAGES, optionHelp: STAGE_HELP, maps: "Business diagnostic → stage" },
      ],
    },
    {
      id: "services",
      title: "Services and packages",
      intro: "What you sell. Packages and posting quotas are set up from this.",
      when: "required",
      builds: "Packages and posting quotas, set up automatically",
      questions: [
        {
          id: "a3",
          label: "Services offered",
          type: "multi",
          options: [
            "Video production",
            "Social media management",
            "Personal branding",
            "Performance ads",
            "Websites",
            "Consulting & training",
            "Courses & community",
          ],
          maps: "Settings → services",
        },
        {
          id: "a4",
          label: "Your packages",
          type: "table",
          columns: [
            { key: "name", label: "Package" },
            { key: "price", label: "₹ / month", type: "currency" },
            { key: "videos", label: "Videos", type: "number" },
            { key: "posts", label: "Posts", type: "number" },
            { key: "shootDays", label: "Shoot days", type: "number" },
            { key: "revisions", label: "Revisions", type: "number" },
          ],
          maps: "Settings → packages · Agreements",
        },
      ],
    },
    {
      id: "goal",
      title: "Main goal (Business Aspiration)",
      intro: "Where you want the agency to be. Seeds your goals and the revenue cascade.",
      when: "required",
      builds: "Goals and the revenue cascade",
      questions: [
        { id: "a13", label: "Aspiration goal, timeline and the WHY behind it", type: "long", maps: "Goals → Business Aspiration" },
        { id: "a14", label: "Revenue this financial year so far (annualised)", type: "currency", maps: "Revenue cascade → current" },
        { id: "a14b", label: "Revenue target for this financial year", type: "currency", maps: "Revenue cascade → target" },
      ],
    },
    {
      id: "team",
      title: "Team and approval roles",
      intro: "Who is on the team and who approves what. Invitations go out from here.",
      when: "required",
      builds: "Roles, permissions and team invitations",
      questions: [
        {
          id: "a20",
          label: "Team members and roles",
          type: "table",
          columns: [
            { key: "name", label: "Name" },
            { key: "role", label: "Role" },
            { key: "approves", label: "Approves", type: "select", options: ["Everything", "Delivery", "Content", "Finance", "HR", "Nothing"] },
          ],
          maps: "Users, roles and permissions",
        },
      ],
    },
    {
      id: "customers",
      title: "Customers: effort vs return",
      intro: "Which customers are worth the effort — this draws your Client Fitment Map.",
      when: "7days",
      builds: "Client Fitment Map and return-to-effort ratio",
      questions: [
        {
          id: "a5",
          label: "Customer types, how many, share of revenue, effort and return",
          type: "table",
          columns: [
            { key: "type", label: "Customer type" },
            { key: "count", label: "How many", type: "number" },
            { key: "share", label: "% of revenue", type: "number" },
            { key: "billing", label: "Avg billing / yr (₹)", type: "currency" },
            { key: "effort", label: "Effort", type: "select", options: HL },
            { key: "return", label: "Return", type: "select", options: HL },
          ],
          maps: "Client Fitment Map",
        },
      ],
    },
    {
      id: "bfa",
      title: "Business Functional Assessment",
      intro: "How each of the seven functions runs today, and who it depends on.",
      when: "7days",
      builds: "BFA scorecard, founder-dependency index, business diagnostic",
      questions: [
        {
          id: "a7",
          label: "For each function",
          type: "table",
          fixedRows: FUNCTIONS,
          columns: [
            { key: "consistent", label: "Done consistently?", type: "select", options: ["Yes", "No"] },
            { key: "owner", label: "Depends on owner?", type: "select", options: ["Yes", "No"] },
            { key: "results", label: "Results", type: "select", options: HL },
            { key: "leader", label: "Second-line leader?", type: "select", options: ["Yes", "No"] },
            { key: "action", label: "Next step", type: "select", options: ["Hire", "Develop", "Delegate", "Outsource", "Do it yourself"] },
          ],
          maps: "BFA scorecard · founder-dependency index",
        },
        { id: "a10", label: "What is working, and what is not?", type: "long", maps: "Business diagnostic" },
      ],
    },
    {
      id: "fullgoals",
      title: "Full goals",
      intro: "The quarterly break-up behind the main goal.",
      when: "7days",
      builds: "Quarterly targets",
      questions: [
        {
          id: "a15",
          label: "Quarterly revenue goal and profitability",
          type: "table",
          fixedRows: ["Q1 Apr–Jun", "Q2 Jul–Sep", "Q3 Oct–Dec", "Q4 Jan–Mar"],
          columns: [
            { key: "revenue", label: "Revenue goal (₹)", type: "currency" },
            { key: "margin", label: "Net margin %", type: "number" },
          ],
          maps: "Goals → quarterly targets",
        },
        { id: "a16", label: "Owner's income: current and aspirational (₹ per month)", type: "text", maps: "Business Aspiration" },
        { id: "a17", label: "Cash flow: collection cycle, payment cycle and working capital needed", type: "long", maps: "Finance baseline" },
      ],
    },
    {
      id: "financials",
      title: "Financials",
      intro: "A baseline for profit and true costing.",
      when: "7days",
      builds: "Finance baseline and overheads for true costing",
      questions: [
        {
          id: "a18",
          label: "Turnover, gross profit and net profit",
          type: "table",
          fixedRows: ["FY 2023-24", "FY 2024-25", "FY 2025-26"],
          columns: [
            { key: "turnover", label: "Turnover (₹)", type: "currency" },
            { key: "gross", label: "Gross profit (₹)", type: "currency" },
            { key: "net", label: "Net profit (₹)", type: "currency" },
          ],
          maps: "Financial reports → history",
        },
        {
          id: "a19",
          label: "Monthly fixed expenses (with break-up), variable expenses, owner's salary and loans",
          type: "long",
          maps: "True costing → overheads",
        },
      ],
    },
    {
      id: "reviews",
      title: "Review practice",
      intro: "How the team is reviewed today.",
      when: "7days",
      builds: "KRA drafts, STOP review calendar",
      questions: [
        {
          id: "a21",
          label: "Do roles have clear daily tasks? How is performance reviewed and feedback given?",
          type: "long",
          maps: "SOPs & checklists (KRA)",
        },
        { id: "a22", label: "Which tools are used for appraisals, career growth and training?", type: "long", maps: "Performance & Learning" },
      ],
    },
    {
      id: "challenges",
      title: "Challenges and priorities",
      intro: "What hurts most today, and what you expect from the system.",
      when: "7days",
      builds: "Strategic Road Map and a first 90-day plan (Genie Assistant draft)",
      questions: [
        {
          id: "a23",
          label: "Main challenge in each function, rated 1–10 (10 = biggest)",
          type: "table",
          fixedRows: FUNCTIONS,
          columns: [
            { key: "challenge", label: "Challenge" },
            { key: "rating", label: "1–10", type: "number" },
          ],
          maps: "Strategic Road Map",
        },
        { id: "a24", label: "What you expect from the system, in priority order", type: "long", maps: "Strategic Road Map" },
        { id: "a25", label: "Tools and spreadsheets used today", type: "long", maps: "Data migration plan" },
      ],
    },
  ],
};

export type { QuestionnaireTemplate as GrowthOsSet };
