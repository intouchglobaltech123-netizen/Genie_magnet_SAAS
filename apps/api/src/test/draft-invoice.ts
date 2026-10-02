import { expect } from "vitest";
import type { Agent } from "./seeded-app.js";

/**
 * An agreement's draft invoice for a month: the one drafted by itself on its billing day (P5-04) when the morning jobs
 * have run, or made by hand otherwise.
 */
export async function draftInvoice<T = { id: string }>(as: Agent, agreementId: string, period: string): Promise<T> {
  const made = await as.post(`/agreements/${agreementId}/invoices`).send({ period });
  if (made.status === 201) return made.body as T;
  expect(made.status).toBe(409);
  const drafts = (await as.get("/invoices?status=draft").expect(200)).body as ({ agreement: { id: string } | null; period: string | null } & T)[];
  const found = drafts.find((i) => i.agreement?.id === agreementId && i.period === period);
  expect(found).toBeDefined();
  return found!;
}
