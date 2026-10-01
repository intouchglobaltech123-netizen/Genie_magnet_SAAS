// Importing from Excel or CSV (P1-31). The file is read in the browser; only checked rows reach the API,
// which checks them again with these same rules before saving anything.
import { z } from "zod";
import { clientInput } from "./schemas.js";

export const IMPORT_KINDS = ["clients", "team"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

const fileName = z.string().trim().min(1).max(200);

/** One client from a sheet: the client with one contact, and optionally who looks after it. */
export const clientImportRow = clientInput.extend({
  accountOwnerEmail: z
    .email("Enter a valid email address")
    .transform((e) => e.toLowerCase())
    .optional(),
});
export type ClientImportRow = z.infer<typeof clientImportRow>;

export const clientImport = z.object({
  fileName,
  rows: z.array(clientImportRow).min(1, "There are no rows to import").max(1000, "Import at most 1,000 rows at a time"),
});
export type ClientImport = z.infer<typeof clientImport>;

/** One person to invite: their email and the role key (the importer turns role names into keys). */
export const teamImportRow = z.object({
  email: z.email("Enter a valid email address").transform((e) => e.toLowerCase()),
  role: z.string().min(1, "Choose a role").max(60),
});
export const teamImport = z.object({
  fileName,
  rows: z.array(teamImportRow).min(1, "There are no rows to import").max(500, "Import at most 500 people at a time"),
});
export type TeamImport = z.infer<typeof teamImport>;

/** A template column: the field it fills, its heading, and other headings people use for the same thing. */
export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
  hint?: string;
  example: string;
}

export const CLIENT_IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: "name",
    label: "Client name",
    required: true,
    aliases: ["client", "client name", "company", "company name", "business", "business name", "brand", "brand name", "customer", "customer name", "name"],
    example: "Kaveri Organics",
  },
  {
    key: "code",
    label: "Code",
    aliases: ["code", "client code", "short code", "short name"],
    hint: "2–4 capital letters for video codes; made up from the name when empty",
    example: "KVR",
  },
  { key: "industry", label: "Industry", aliases: ["industry", "sector", "category", "business type", "type of business"], example: "FMCG · Organic foods" },
  { key: "city", label: "City", aliases: ["city", "town", "location", "place", "area"], example: "Erode" },
  {
    key: "contactName",
    label: "Contact name",
    required: true,
    aliases: ["contact", "contact name", "contact person", "person", "approver name", "owner name"],
    example: "Ramesh Gounder",
  },
  {
    key: "contactPhone",
    label: "Contact phone",
    required: true,
    aliases: ["phone", "mobile", "contact phone", "whatsapp", "whatsapp number", "phone number", "mobile number", "contact number", "number"],
    example: "+91 94430 55101",
  },
  { key: "contactEmail", label: "Contact email", aliases: ["email", "contact email", "mail", "email id", "e mail"], example: "ramesh@kaveri.example" },
  { key: "contactTitle", label: "Contact title", aliases: ["title", "designation", "position", "contact title"], example: "Managing Partner" },
  {
    key: "approver",
    label: "Approves work",
    aliases: ["approver", "approves", "approves work", "can approve"],
    hint: "yes or no; yes when empty",
    example: "yes",
  },
  {
    key: "accountOwnerEmail",
    label: "Account owner email",
    aliases: ["account owner", "account owner email", "account manager", "handled by", "owner email", "managed by"],
    hint: "Someone in your team who looks after this client",
    example: "ashwin@youragency.example",
  },
];

export const TEAM_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "email", label: "Email", required: true, aliases: ["email", "email id", "mail", "e mail", "email address"], example: "priya@youragency.example" },
  { key: "role", label: "Role", required: true, aliases: ["role", "position", "designation", "access", "job"], example: "Editor" },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Which sheet column (index) fills each field, or null: first an exact heading, then a heading people often use.
 * Each sheet column is used once.
 */
export function matchColumns(headers: string[], columns: ImportColumn[]): Record<string, number | null> {
  const used = new Set<number>();
  const result: Record<string, number | null> = Object.fromEntries(columns.map((c) => [c.key, null]));
  const take = (key: string, test: (h: string) => boolean) => {
    const i = headers.findIndex((h, idx) => !used.has(idx) && test(norm(h)));
    if (i !== -1) {
      result[key] = i;
      used.add(i);
    }
  };
  for (const c of columns) take(c.key, (h) => h === norm(c.label));
  for (const c of columns) if (result[c.key] === null) take(c.key, (h) => c.aliases.some((a) => norm(a) === h));
  return result;
}

/** "yes" / "no" in the ways people write it; undefined when empty or unclear. */
export function parseYesNo(v: string): boolean | undefined {
  const s = norm(v);
  if (["yes", "y", "true", "1", "approver", "ok"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return undefined;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** A 2–4 letter client code made from the name and not already taken: "Kaveri Organics" → KO, then KOA, KOB… */
export function suggestCode(name: string, taken: Set<string>): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  let base =
    words.length >= 2
      ? words
          .slice(0, 3)
          .map((w) => w[0])
          .join("")
      : (words[0] ?? "").slice(0, 3);
  if (base.length < 2) base = `${base}CL`.slice(0, 2);
  if (!taken.has(base)) return base;
  const stem = base.slice(0, 3);
  for (const c of words.join("").slice(1) + LETTERS) if (!taken.has(stem + c)) return stem + c;
  for (const a of LETTERS) for (const b of LETTERS) if (!taken.has(base.slice(0, 2) + a + b)) return base.slice(0, 2) + a + b;
  return base;
}
