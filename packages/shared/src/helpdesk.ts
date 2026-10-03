// Support inbox (P6-15): an agency writes to the platform's support team from the app, and the conversation carries on
// there — the agency's people see their own messages (those who keep the settings see all of the agency's), the
// support team sees every agency's in the platform console.
import { z } from "zod";

export const TICKET_CATEGORIES = ["question", "problem", "billing", "idea"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  question: "A question",
  problem: "Something is not working",
  billing: "Plan or billing",
  idea: "An idea",
};

/** open: waiting for support · answered: waiting for the agency · closed */
export const TICKET_STATUSES = ["open", "answered", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** POST /support/tickets */
export const ticketInput = z.object({
  subject: z.string().trim().min(3, "Say in a few words what it is about").max(120),
  category: z.enum(TICKET_CATEGORIES),
  body: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(5000),
  /** The page it was written from. */
  page: z.string().trim().max(300).optional(),
});
export type TicketInput = z.infer<typeof ticketInput>;

/** POST /support/tickets/:id/messages, and the platform's reply. */
export const ticketReply = z.object({ body: z.string().trim().min(1, "Write a reply").max(5000) });

export interface TicketMessage {
  id: string;
  body: string;
  /** Written by the platform's support team, or by someone in the agency. */
  fromSupport: boolean;
  author: string;
  createdAt: string;
}

/** GET /support/tickets (one item), and the platform console's list. */
export interface TicketRow {
  id: string;
  /** A short reference to quote. */
  ref: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  page: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  /** In the platform console only. */
  agency?: { id: string; name: string };
}

/** GET /support/tickets/:id */
export interface TicketDetail extends TicketRow {
  messages: TicketMessage[];
}

export const ticketRef = (id: string) => id.replace(/-/g, "").slice(-6).toUpperCase();
