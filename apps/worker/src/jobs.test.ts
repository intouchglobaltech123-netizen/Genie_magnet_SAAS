import { describe, expect, it } from "vitest";
import { JOB_QUEUE, jobSchemas, parseJob, QUEUES, UnknownJobError } from "./jobs.js";
import { handlers } from "./processors/index.js";

const agencyId = "0190f5a0-0000-7000-8000-00000000000a";

describe("jobs", () => {
  it("routes every job to a known queue and has a handler for it", () => {
    for (const name of Object.keys(jobSchemas) as (keyof typeof jobSchemas)[]) {
      expect(Object.values(QUEUES)).toContain(JOB_QUEUE[name]);
      expect(typeof handlers[name]).toBe("function");
    }
  });

  it("validates payloads before a handler runs", () => {
    expect(parseJob("whatsapp.send", { agencyId, to: "+91 94430 55101", template: "approval_request", variables: { name: "Ramesh" } }).name).toBe(
      "whatsapp.send",
    );
    expect(() => parseJob("whatsapp.send", { to: "+91 94430 55101", template: "x", variables: {} })).toThrow();
    expect(() => parseJob("onboarding.remind", { agencyId, responseId: "not-a-uuid", day: 2 })).toThrow();
  });

  it("rejects unknown jobs", () => {
    expect(() => parseJob("delete.everything", { agencyId })).toThrow(UnknownJobError);
  });
});
