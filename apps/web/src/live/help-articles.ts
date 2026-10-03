// The help centre (P6-15): short guides to each part of the app, in plain words, opened from Help in the top bar —
// the guide for the page you are on first. Menu names here must match the side menu.

export interface HelpSection {
  heading?: string;
  text?: string;
  /** Numbered steps. */
  steps?: string[];
  /** Points worth knowing. */
  notes?: string[];
}

export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  /** The pages it explains; the guide for a page is the first whose path starts it. */
  paths: string[];
  sections: HelpSection[];
}

export const HELP: HelpArticle[] = [
  {
    slug: "getting-started",
    title: "Setting up your workspace",
    summary: "The first hour: your agency questionnaire, packages, goals, team and the rest of the set-up guide.",
    paths: ["/app/setup", "/app/onboarding/agency"],
    sections: [
      {
        text: "Set up your workspace (from Home's set-up guide) takes you through the first steps. Each one ticks itself once it is done, so you can stop and come back.",
      },
      {
        heading: "In order",
        steps: [
          "Answer the essentials of your agency questionnaire: about the agency, what you sell and your packages, your main goal, and your team. The deeper sections can wait.",
          "Make the packages in your answers your packages. Proposals, agreements, monthly quotas and invoices start from them.",
          "Set this year's goals from your revenue target. They appear in Goals with a goal for each quarter you gave.",
          "See which suites your answers point to, and compare them with your plan in Settings → Plan.",
          "Invite your team from Settings → Team, each with the role that fits.",
        ],
      },
      {
        heading: "Trying things first",
        text: "Add sample data to try the app with three sample clients, four leads and four videos, all marked “(sample)”. Remove it in one go when your own clients are in; anything you made for those sample clients goes with it, except invoices you issued.",
      },
      {
        heading: "Then, from Home",
        text: "Home's set-up guide lists the rest: your profile and logo, invoice settings, clients (or import them from Excel), your sales pipeline, the onboarding questions, production settings, your clients' platforms, WhatsApp and the client portal.",
      },
    ],
  },
  {
    slug: "team-and-roles",
    title: "Your team, roles and permissions",
    summary: "Inviting people, choosing what each role may see and do, and keeping an owner.",
    paths: ["/app/settings/team", "/app/settings/roles"],
    sections: [
      {
        heading: "Inviting someone",
        steps: [
          "Open Settings → Team and choose Invite.",
          "Enter their email and pick a role. They get a link, set their own password and join.",
          "Or import a list of people from Excel in Import from Excel.",
        ],
      },
      {
        heading: "Roles",
        text: "Each role is a set of permissions per area — see, change, approve — and, for some areas, only their own records. Change the starting roles or copy one in Settings → Roles and permissions; a change applies from the person's next click.",
        notes: [
          "Nobody can give more access than they have themselves.",
          "There is always at least one owner, and a role in use cannot be deleted.",
          "Salaries, payroll and personal financial planners stay with the owner unless you give access on purpose.",
        ],
      },
    ],
  },
  {
    slug: "clients-and-portal",
    title: "Clients, onboarding and the client portal",
    summary: "Adding clients, sending the onboarding questionnaire, and giving each contact their portal link.",
    paths: ["/app/clients", "/app/onboarding", "/app/requests", "/app/settings/onboarding"],
    sections: [
      {
        heading: "Adding a client",
        text: "Add each client in Clients with at least one contact, and mark who approves the work. A short code (two to four capital letters) goes into every video code for that client. Bring a whole list in at once from Import from Excel.",
      },
      {
        heading: "Onboarding",
        steps: [
          "Open the client's onboarding in Onboarding and send the questionnaire link, or fill it in with the client on a call.",
          "The required part comes first; the deeper sections have a window of days, with reminders.",
          "Change, add or translate the questions in Settings → Onboarding questions before your first client gets the link.",
        ],
      },
      {
        heading: "The client portal",
        text: "On a client's page, give a contact their private portal link. There they pick topics, approve scripts and videos, ask for changes, raise requests and pay invoices — with your logo and colour. A new link stops the old one; you can switch a link off at any time.",
        notes: [
          "Requests clients raise in the portal come to Client requests.",
          "To send links on your own address, see Settings → Agency profile → Your portal address.",
        ],
      },
    ],
  },
  {
    slug: "sales",
    title: "Sales pipeline and proposals",
    summary: "Leads, follow-ups, proposals within your discount limit, and winning a deal.",
    paths: ["/app/sales", "/app/settings/pipeline", "/app/agreements"],
    sections: [
      {
        text: "Every lead sits in a stage of your pipeline with its value, owner and next follow-up. Rename the stages to the way you sell in Settings → Pipeline stages.",
      },
      {
        heading: "From lead to client",
        steps: [
          "Log calls, meetings and messages on the lead, and set the next follow-up; it shows in the Calendar.",
          "Make a proposal from a package. A discount above your limit (Settings → Agency profile) waits for approval.",
          "Mark the deal as won: the client and its agreement are set up from the proposal.",
        ],
      },
      {
        heading: "Agreements",
        text: "An agreement holds the client's monthly fee, deliverables and dates, copied from the package so later package changes never alter it. Renew it from Agreements when it is due; it shows as due before it ends.",
      },
    ],
  },
  {
    slug: "production",
    title: "Content, production and shoots",
    summary: "From topic and script to a finished video, with stages, quality checks and shoots.",
    paths: ["/app/content", "/app/production", "/app/shoots", "/app/cycles", "/app/settings/production", "/app/calendar", "/app/projects", "/app/assets"],
    sections: [
      {
        heading: "The flow",
        steps: [
          "Content: plan topics with the client and write scripts; clients approve them in the portal.",
          "Production: each video moves through its stages, with its editor, due date and edit steps.",
          "Quality checks run before a video goes to the client; a revision starts the checks again.",
          "The client approves the video, or asks for changes, in the portal.",
        ],
      },
      {
        heading: "Shoots and equipment",
        text: "Plan shoots in Shoots with the videos they cover, the crew and the kit. Equipment keeps track of who has which camera, reservations and repairs.",
      },
      {
        heading: "Each month",
        text: "Monthly delivery shows each client's quota against what was delivered, and closes the month.",
        notes: ["Video codes, formats and editing time, edit steps, quality checks and kit lists are in Settings → Production."],
      },
    ],
  },
  {
    slug: "publishing",
    title: "Publishing to social platforms",
    summary: "Connecting your clients' accounts and scheduling approved videos.",
    paths: ["/app/publishing"],
    sections: [
      {
        steps: [
          "On the client's page, connect the accounts where their videos go (Instagram, Facebook, YouTube, LinkedIn, X).",
          "Schedule an approved video in Publishing with its caption and time.",
          "It is posted at that time, and its numbers are collected each day for the monthly report.",
        ],
      },
    ],
  },
  {
    slug: "invoices",
    title: "Invoices, GST and payments",
    summary: "Invoice settings, drafting and issuing, payment links and reminders.",
    paths: ["/app/invoices", "/app/settings/invoices", "/app/settings/payments", "/app/expenses", "/app/costing", "/app/finance", "/app/settings/costing"],
    sections: [
      {
        heading: "Before the first invoice",
        steps: [
          "Fill in Settings → Invoice settings: your legal name, GSTIN, state, address, the services with their SAC codes and GST rates, the number format, payment terms and bank details.",
          "Connect your own Razorpay account in Settings → Payments so invoices carry a payment link.",
        ],
      },
      {
        heading: "Each month",
        text: "With automatic drafts on in Invoice settings, invoices are drafted on each agreement's billing day; otherwise make them in Invoices. Check a draft and issue it: it gets its number and can be sent; CGST and SGST or IGST follow the client's state. A paid payment link marks it paid; overdue invoices are listed by age and can be reminded on WhatsApp.",
      },
      {
        heading: "Money",
        text: "Expenses (with receipts) and the team's time give the true cost of each video and client in Costing; Finance shows each month's money and closes it.",
      },
    ],
  },
  {
    slug: "whatsapp",
    title: "WhatsApp messages",
    summary: "Sending approvals, reminders and confirmations from your own WhatsApp Business number.",
    paths: ["/app/messages", "/app/settings/whatsapp"],
    sections: [
      {
        steps: [
          "In Settings → WhatsApp, enter your WhatsApp Business (Cloud API) details from Meta and send a test message.",
          "Messages go only to contacts who agreed to them; their agreement is kept on the contact.",
          "Every message sent, and replies, are in WhatsApp messages.",
        ],
      },
    ],
  },
  {
    slug: "people-and-payroll",
    title: "People, attendance, leave and payroll",
    summary: "Employee records, attendance from your machine's export, leave, and the monthly payroll.",
    paths: [
      "/app/people",
      "/app/attendance",
      "/app/leave",
      "/app/payroll",
      "/app/payslips",
      "/app/daily-sheet",
      "/app/hiring",
      "/app/performance",
      "/app/learning",
      "/app/planner",
    ],
    sections: [
      {
        heading: "Each month",
        steps: [
          "Import last month's attendance from your attendance machine's export in Attendance; correct days where needed.",
          "Approve leave in Leave; nobody approves their own.",
          "Run payroll in Payroll, check each payslip, and lock the month. Locked months cannot change.",
          "Each person sees only their own payslips in My payslips.",
        ],
      },
      {
        text: "Salaries are in parts you define, with your own deductions; the app assumes no statutory amounts, so enter the ones that apply to your agency.",
        notes: [
          "Hiring, performance reviews, learning paths and the daily sheet are in the same People section.",
          "My financial planner is each person's own; nobody else sees it.",
        ],
      },
    ],
  },
  {
    slug: "goals-and-reviews",
    title: "Goals, reviews and the Round Table",
    summary: "This year's goals and the revenue cascade, regular reviews, and the business diagnostic.",
    paths: ["/app/goals", "/app/reviews", "/app/round-table", "/app/sops", "/app/diagnostic"],
    sections: [
      {
        text: "Goals hold the agency's goal for the year and each quarter, set from your agency questionnaire, with goals for teams and people serving them. The revenue cascade works out the clients, deals and leads each target needs.",
      },
      {
        heading: "Keeping on them",
        steps: [
          "Hold reviews at the rhythm you set in Reviews; figures are taken in, decisions and commitments noted, and the meeting locked.",
          "Run a Round Table for open feedback, moderated before anyone reads it.",
          "Write your SOPs and checklists, and check that they are followed.",
          "The business diagnostic shows where each function stands and drafts a road map.",
        ],
      },
    ],
  },
  {
    slug: "genie",
    title: "Genie Assistant",
    summary: "Insights, drafts and Ask Genie — switched on by you, within your own budget.",
    paths: ["/app/genie", "/app/settings/genie"],
    sections: [
      {
        steps: [
          "Switch Genie Assistant on in Settings → Genie Assistant and set your monthly budget.",
          "It points out what needs a look on Home, drafts captions, ideas and reminders for you to edit, and answers questions about your agency's data that your role may see.",
          "Nothing is sent without a person approving it.",
        ],
      },
      { notes: ["Its use is counted each month against your budget and your plan's allowance."] },
    ],
  },
  {
    slug: "plan-and-billing",
    title: "Your plan, trial and billing",
    summary: "The trial, choosing a plan, paying, and what happens if a payment fails.",
    paths: ["/app/settings/plan"],
    sections: [
      {
        steps: [
          "A new workspace starts with a free trial; a banner counts down its last week.",
          "Choose a plan in Settings → Plan and pay in rupees (plus GST) or in US dollars; our invoice for each payment is in Settings → Plan.",
          "Change plans at any time. Anything in a suite you leave stays, and comes back when you add it again.",
        ],
      },
      {
        heading: "If a payment fails",
        text: "You have a few days' grace. After that the workspace turns read-only until it is paid: everyone can still sign in, read everything and export it, but nothing can be changed.",
      },
    ],
  },
  {
    slug: "your-data",
    title: "Your data, privacy and support access",
    summary: "Exporting everything, deleting the workspace, and letting the support team in.",
    paths: ["/app/settings/data", "/app/settings/support", "/app/audit"],
    sections: [
      {
        heading: "Your data is yours",
        text: "The owner can export everything from Settings → Your data: a ZIP with a spreadsheet for each kind of record and all of it in one data file. Passwords, keys, bank and PAN numbers and personal planners are left out.",
      },
      {
        heading: "Deleting the workspace",
        text: "The owner can ask for the workspace to be deleted by typing the agency's name. It is deleted 30 days later, with everything in it; until then a banner shows the date and the owner can stop it.",
      },
      {
        heading: "Support access",
        text: "Our support team cannot see your agency unless you let them in from Settings → Support access, for the hours you choose and only as far as you allow. Everything they do is in your Audit log.",
      },
    ],
  },
];

/** The guide for a page: the first whose path starts the page's. */
export const helpFor = (pathname: string) => HELP.find((a) => a.paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) ?? null;
