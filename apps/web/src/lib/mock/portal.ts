// Client-facing data for the Kaveri Organics portal. Only what a client should see —
// no internal costs, salaries or internal notes.

export const PORTAL_CLIENT_ID = "c-kaveri";
export const PORTAL_USER = { name: "Ramesh Gounder", title: "Managing Partner", company: "Kaveri Organics" };

export const PORTAL_ACCOUNT_MANAGER = {
  name: "Ashwin",
  title: "Your account manager",
  email: "ashwin@geniemagnet.in",
  phone: "+91 98400 11002",
  hours: "Mon–Sat · 9:30 AM – 7 PM",
};

export interface PortalInvoice {
  no: string;
  period: string;
  amount: number;
  status: "paid" | "due" | "upcoming";
  issuedOn: string;
  dueOn: string;
  paidOn?: string;
}

export const portalInvoices: PortalInvoice[] = [
  { no: "GM/26-27/061", period: "Oct 2026", amount: 85000, status: "due", issuedOn: "2026-09-25", dueOn: "2026-10-01" },
  { no: "GM/26-27/052", period: "Sep 2026", amount: 85000, status: "paid", issuedOn: "2026-08-26", dueOn: "2026-09-01", paidOn: "2026-08-30" },
  { no: "GM/26-27/043", period: "Aug 2026", amount: 85000, status: "paid", issuedOn: "2026-07-27", dueOn: "2026-08-01", paidOn: "2026-07-31" },
];

/** Publish time per video (client calendar). */
export const publishTimes: Record<string, string> = {
  "v-kvr-1": "18:30",
  "v-kvr-2": "19:00",
  "v-kvr-3": "18:30",
  "v-kvr-4": "11:00",
  "v-kvr-5": "20:00",
  "v-kvr-6": "18:30",
  "v-kvr-7": "07:00",
  "v-kvr-8": "19:30",
};

export const requestTypes = [
  { value: "new-video", label: "A new video (not in this month's package)" },
  { value: "extra-edit", label: "An extra edit / cut-down of an existing video" },
  { value: "graphics", label: "Graphics, thumbnails or motion titles" },
  { value: "other", label: "Something else" },
];
