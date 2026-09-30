// Ask Genie (demo): answers the example questions from the same data the screens use,
// always with sources. In the product, Claude answers through read-only tools scoped to the user's permissions.
import { agreementById, clients, cycles, daysBetween, personById, TODAY } from "@/lib/mock/core";
import { BUSINESS_ASPIRATION, ytd } from "@/lib/mock/finance";
import type { Video } from "@/lib/types";
import { inrCompact, pct } from "@/lib/utils";
import type { ContentItem } from "@/features/content/data";

export interface GenieAnswer {
  summary: string;
  lines: string[];
  sources: { label: string; href: string }[];
  next?: string;
}

export interface AskContext {
  videos: Video[];
  content: ContentItem[];
}

export const SUGGESTED = [
  "Which clients are at risk this month?",
  "What is due this week, and who is overloaded?",
  "What are we waiting on clients for?",
  "Are we on track for the revenue goal?",
  "Summarise Kaveri Organics for September",
];

const DONE = new Set(["Approved", "Published"]);

function risk(): GenieAnswer {
  const atRisk = clients.filter((c) => c.category === "Dangerous" || c.health < 70).sort((a, b) => a.health - b.health);
  return {
    summary: `${atRisk.length} clients need attention this month.`,
    lines: atRisk.map(
      (c) => `${c.name} — ${c.category} · health ${c.health}${c.outstanding ? ` · ${inrCompact(c.outstanding)} outstanding` : ""}${c.category === "Dangerous" ? " · high effort for the fee" : " · slow approvals"}`,
    ),
    next: "Suggested: put Urban Nest on the 14 Oct strategic review agenda and send Nova's approval reminder today.",
    sources: [
      { label: "Client Health", href: "/client-health" },
      { label: "Billing & Collections", href: "/billing" },
    ],
  };
}

function dueThisWeek(ctx: AskContext): GenieAnswer {
  const due = ctx.videos.filter((v) => !DONE.has(v.stage) && daysBetween(TODAY, v.dueDate) >= 0 && daysBetween(TODAY, v.dueDate) <= 7);
  const byEditor = new Map<string, Video[]>();
  for (const v of due) byEditor.set(v.editorId, [...(byEditor.get(v.editorId) ?? []), v]);
  const lines = [...byEditor.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([id, vs]) => {
      const p = personById(id);
      return `${p.name}: ${vs.length} video${vs.length > 1 ? "s" : ""} (${vs.map((v) => v.code).join(", ")}) · ${pct(p.utilisation)} of capacity${p.utilisation > 1 ? " — overloaded" : ""}`;
    });
  const over = [...byEditor.keys()].map(personById).filter((p) => p.utilisation > 1);
  return {
    summary: `${due.length} videos are due in the next 7 days${over.length ? `; ${over.map((p) => p.name.split(" ")[0]).join(" and ")} ${over.length > 1 ? "are" : "is"} over capacity` : ""}.`,
    lines,
    next: over.length ? `Suggested: move one of ${over[0]!.name.split(" ")[0]}'s videos to Surya (30.1 h this week, same skills).` : undefined,
    sources: [
      { label: "Video Production", href: "/production" },
      { label: "Planning & Capacity", href: "/planning" },
    ],
  };
}

function waiting(ctx: AskContext): GenieAnswer {
  const reviews = ctx.videos.filter((v) => v.stage === "Client Review");
  const scripts = ctx.content.filter((i) => i.stage === "approval");
  const topics = ctx.content.filter((i) => i.stage === "topic" && !i.pick);
  const lines = [
    ...reviews.map((v) => {
      const sent = v.versions.at(-1)?.createdAt.slice(0, 10) ?? v.dueDate;
      return `Video ${v.code} “${v.title}” — ${clients.find((c) => c.id === v.clientId)!.name}, waiting ${Math.max(0, daysBetween(sent, TODAY))} days`;
    }),
    ...scripts.map((i) => `Script “${i.title}” — ${clients.find((c) => c.id === i.clientId)!.name}, sent ${i.sentOn ? `${Math.max(0, daysBetween(i.sentOn, TODAY))} days ago` : "today"}`),
  ];
  if (topics.length) lines.push(`${topics.length} October topics not picked yet (Kaveri and Sri Lakshmi topic lists)`);
  return {
    summary: `${reviews.length} videos and ${scripts.length} scripts are waiting for client approval.`,
    lines,
    next: "Genie Assistant sends reminders after 2 days automatically; approval is never assumed from silence.",
    sources: [
      { label: "Revisions & reviews", href: "/revisions" },
      { label: "Content · Script approval", href: "/content" },
    ],
  };
}

function revenue(): GenieAnswer {
  const gap = ytd.goal - ytd.revenue;
  const remaining = BUSINESS_ASPIRATION.revenueGoal - ytd.revenue;
  return {
    summary: `Year to date: ${inrCompact(ytd.revenue)} against a plan of ${inrCompact(ytd.goal)} (${pct(ytd.revenue / ytd.goal)}).`,
    lines: [
      gap > 0 ? `${inrCompact(gap)} behind plan after ${ytd.months} months` : `${inrCompact(-gap)} ahead of plan after ${ytd.months} months`,
      `${inrCompact(remaining)} still needed for the ${inrCompact(BUSINESS_ASPIRATION.revenueGoal)} ${BUSINESS_ASPIRATION.fy} goal`,
      `Q3 (Oct–Dec) plan is ${inrCompact(BUSINESS_ASPIRATION.quarters[2]!.goal)} — festive retainers and 2 new clients carry most of it`,
      `Net margin so far: ${pct(ytd.margin)} (goal ${pct(BUSINESS_ASPIRATION.netMarginGoal)})`,
    ],
    next: "Open the revenue cascade in Goals to see how many leads and editors the goal needs.",
    sources: [
      { label: "Goals · revenue cascade", href: "/goals" },
      { label: "Financial Reports", href: "/finance" },
    ],
  };
}

function kaveri(ctx: AskContext): GenieAnswer {
  const cycle = cycles.find((c) => c.clientId === "c-kaveri" && c.label === "Sep 2026")!;
  const a = agreementById(cycle.agreementId);
  const vs = ctx.videos.filter((v) => v.cycleId === cycle.id);
  const done = vs.filter((v) => DONE.has(v.stage)).length;
  const review = vs.filter((v) => v.stage === "Client Review").length;
  const c = clients.find((x) => x.id === "c-kaveri")!;
  return {
    summary: `Kaveri Organics (${a.packageName}, ${inrCompact(a.monthlyFee)}/month): ${done} of ${cycle.promised} September deliverables approved, ${vs.length - done} in progress.`,
    lines: [
      `${review} video${review === 1 ? "" : "s"} waiting for Ramesh's review · revisions used within allowance`,
      `Client Fitment Map: ${c.category} · health ${c.health} · nothing outstanding`,
      `October topic list: ${ctx.content.filter((i) => i.clientId === "c-kaveri" && i.pick === "picked").length} of 12 topics picked`,
      "Best post this month: “Cold-pressed groundnut oil — farm to bottle” (48 K views)",
    ],
    next: `${cycle.promised - vs.length} September units are not started — plan them this week or agree a carry-forward with Ramesh.`,
    sources: [
      { label: "Recurring Cycles", href: "/cycles" },
      { label: "Outcomes & Reports", href: "/outcomes" },
    ],
  };
}

const INTENTS: [RegExp, (ctx: AskContext) => GenieAnswer][] = [
  [/risk|danger|churn|unhappy|lose/i, risk],
  [/due|this week|overload|workload|busy|capacity/i, dueThisWeek],
  [/wait|approv|pending|stuck/i, waiting],
  [/revenue|target|goal|sales|track/i, revenue],
  [/kaveri|summar/i, kaveri],
];

export function askGenie(q: string, ctx: AskContext): GenieAnswer {
  const hit = INTENTS.find(([re]) => re.test(q));
  if (hit) return hit[1](ctx);
  return {
    summary: "In this demo, Ask Genie answers the example questions below.",
    lines: [
      "In the product it answers any question about your agency from live data — clients, videos, money, team and reviews — and always shows where each number came from.",
      "It only reads what your role is allowed to see, and it never changes anything by itself.",
    ],
    sources: [],
  };
}
