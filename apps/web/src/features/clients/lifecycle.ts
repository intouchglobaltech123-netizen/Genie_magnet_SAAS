// Client lifecycle (Growth OS): Win → Onboard → Plan → Produce → Deliver.
// Win and Onboard happen once; Plan, Produce and Deliver repeat every month.
// Status is derived from the records, so the tracker is never updated by hand.
import { daysBetween, TODAY } from "@/lib/mock/core";
import type { Video } from "@/lib/types";
import type { ContentItem, TopicList } from "@/features/content/data";

export type StepState = "done" | "active" | "waiting" | "upcoming";

export interface LifecycleStep {
  label: string;
  state: StepState;
  gate?: boolean;
  note?: string;
}

export interface LifecyclePhase {
  id: "win" | "onboard" | "plan" | "produce" | "deliver";
  name: string;
  module: string;
  href: string;
  period?: string;
  steps: LifecycleStep[];
  state: StepState;
}

function phaseState(steps: LifecycleStep[]): StepState {
  if (steps.some((s) => s.state === "waiting")) return "waiting";
  if (steps.every((s) => s.state === "done")) return "done";
  if (steps.some((s) => s.state === "active" || s.state === "done")) return "active";
  return "upcoming";
}

export function lifecycleFor(
  clientId: string,
  { videos, content, lists, onboardingOpen, partner }: { videos: Video[]; content: ContentItem[]; lists: TopicList[]; onboardingOpen: boolean; partner: boolean },
): LifecyclePhase[] {
  const sep = videos.filter((v) => v.clientId === clientId && v.cycleId.endsWith("-09"));
  const list = lists.find((l) => l.clientId === clientId && l.month === "Oct 2026");
  const oct = content.filter((i) => i.clientId === clientId && i.month === "Oct 2026");
  const scripts = content.filter((i) => i.clientId === clientId && (i.stage === "script" || i.stage === "approval" || i.stage === "research"));
  const scriptWaiting = content.filter((i) => i.clientId === clientId && i.stage === "approval");
  const inReview = sep.filter((v) => v.stage === "Client Review");
  const producing = sep.filter((v) => !["Approved", "Published", "Client Review"].includes(v.stage));
  const published = sep.filter((v) => v.stage === "Published").length;
  const approved = sep.filter((v) => v.stage === "Approved").length;
  const picked = oct.filter((i) => i.pick === "picked").length;
  const oldestReview = inReview.reduce((m, v) => Math.max(m, daysBetween(v.versions.at(-1)?.createdAt.slice(0, 10) ?? v.dueDate, TODAY)), 0);

  const phases: Omit<LifecyclePhase, "state">[] = [
    {
      id: "win",
      name: "Win",
      module: "Sales & CRM",
      href: "/crm",
      steps: [
        { label: "One-to-one call", state: "done" },
        { label: "Close the deal", state: "done" },
        { label: "Invoice & collect payment", state: "done" },
      ],
    },
    {
      id: "onboard",
      name: "Onboard",
      module: "Onboarding",
      href: "/onboarding",
      steps: [
        { label: "WhatsApp group", state: "done" },
        { label: "Questionnaire & checklist", state: onboardingOpen ? "active" : "done", note: onboardingOpen ? "Deeper sections still open" : undefined },
        { label: "Confirm package & scope", state: "done" },
      ],
    },
    {
      id: "plan",
      name: "Plan",
      module: "Content",
      href: "/content",
      period: "October",
      steps: partner
        ? [{ label: "Brief from partner agency", state: "done" }, { label: "Scripts by partner", state: "done", note: "Partner writes and posts" }]
        : [
            { label: "Analyse needs & plan content", state: list ? "done" : oct.length ? "active" : "upcoming" },
            {
              label: "Client picks topics",
              gate: true,
              state: !list ? "upcoming" : list.status === "confirmed" ? "done" : list.status === "sent" ? "waiting" : "active",
              note: list?.status === "sent" ? `${picked} of ${list.needed} picked` : list?.status === "draft" ? "Topic list in draft" : undefined,
            },
            { label: "Research & scripts", state: scripts.length ? "active" : list?.status === "confirmed" ? "active" : "upcoming", note: scripts.length ? `${scripts.length} in progress` : undefined },
            {
              label: "Client approves scripts",
              gate: true,
              state: scriptWaiting.length ? "waiting" : "upcoming",
              note: scriptWaiting.length ? `${scriptWaiting.length} waiting` : undefined,
            },
          ],
    },
    {
      id: "produce",
      name: "Produce",
      module: "Production & Editing",
      href: "/production",
      period: "September",
      steps: [
        { label: "Shoot & code footage", state: sep.some((v) => ["Planned", "Scripting", "Shoot Scheduled"].includes(v.stage)) ? "active" : "done" },
        { label: "Edit & internal QC", state: producing.length ? "active" : "done", note: producing.length ? `${producing.length} in the making` : undefined },
        {
          label: "Client approves video",
          gate: true,
          state: inReview.length ? "waiting" : "done",
          note: inReview.length ? `${inReview.length} in review · ${oldestReview} day${oldestReview === 1 ? "" : "s"}` : undefined,
        },
      ],
    },
    {
      id: "deliver",
      name: "Deliver",
      module: "Publishing & Reports",
      href: "/publishing",
      period: "September",
      steps: [
        { label: "Post to social", state: partner ? "done" : approved ? "active" : published ? "done" : "upcoming", note: partner ? "Files delivered to partner" : `${published} posted · ${approved} scheduled` },
        { label: "Confirm to client", state: published ? "done" : "upcoming" },
        { label: "Monthly report (25th–30th)", state: "active", note: "Draft ready for review" },
      ],
    },
  ];
  return phases.map((p) => ({ ...p, state: phaseState(p.steps) }));
}

export function currentPhase(phases: LifecyclePhase[]) {
  const waiting = phases.find((p) => p.state === "waiting");
  const active = phases.find((p) => p.state === "active");
  return waiting ?? active ?? phases.at(-1)!;
}
