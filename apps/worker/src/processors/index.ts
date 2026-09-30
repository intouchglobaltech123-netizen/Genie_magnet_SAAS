import type { JobData, JobName } from "../jobs.js";

export type Handler<N extends JobName> = (data: JobData<N>) => Promise<{ status: string }>;

// Phase 0 stubs: each handler is replaced by the real implementation in the phase noted.
export const handlers: { [N in JobName]: Handler<N> } = {
  // Phase 3 — WhatsApp Business provider (approved templates only).
  "whatsapp.send": async (d) => ({ status: `queued ${d.template} to ${d.to}` }),
  // Phase 1 — onboarding engine.
  "onboarding.remind": async (d) => ({ status: `day ${d.day} reminder for ${d.responseId}` }),
  // Phase 4 — Genie Assistant rules + drafts.
  "genie.rules": async (d) => ({ status: `rules run for ${d.agencyId}` }),
  // Phase 3 — platform connectors.
  "publishing.post": async (d) => ({ status: `post ${d.scheduledPostId} scheduled` }),
};
