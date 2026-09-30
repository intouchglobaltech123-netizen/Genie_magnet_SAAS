// Content module (Growth OS flow): idea → client topic selection → research → script → script approval → production.
// "Today" is 25 Sep 2026; the team is planning October content.
import type { Video } from "@/lib/types";

export type ContentStage = "idea" | "topic" | "research" | "script" | "approval" | "ready";

export const CONTENT_STAGES: { id: ContentStage; label: string; hint: string }[] = [
  { id: "idea", label: "Ideas", hint: "Idea bank — not yet shown to the client" },
  { id: "topic", label: "Topic selection", hint: "On the client's topic list" },
  { id: "research", label: "Research", hint: "Facts, references and hooks" },
  { id: "script", label: "Scripting", hint: "Writing and internal review" },
  { id: "approval", label: "Script approval", hint: "Sent to the client" },
  { id: "ready", label: "Ready for shoot", hint: "Approved — handed to production" },
];

export interface ScriptVersion {
  id: string;
  label: string; // v1, v2
  at: string;
  by: string;
  hook: string;
  body: string;
  cta: string;
  onScreen: string;
  status: "draft" | "sent" | "changes" | "approved";
  clientNote?: string;
}

export interface ContentItem {
  id: string;
  clientId: string;
  title: string;
  pillar: string;
  format: Video["format"];
  source: "Genie Assistant" | "Team" | "Client";
  stage: ContentStage;
  ownerId: string;
  month: string;
  due: string;
  /** Client's choice on the monthly topic list. */
  pick?: "picked" | "skipped";
  notes: string;
  links: { label: string; url: string }[];
  versions: ScriptVersion[];
  sentOn?: string;
  videoCode?: string;
}

export const pillarsByClient: Record<string, string[]> = {
  "c-kaveri": ["Farm to pack", "Healthy swaps", "Recipes in 60 seconds", "Founder & family"],
  "c-lakshmi": ["Silk know-how", "Festive looks", "Behind the loom", "Customer stories"],
  "c-nova": ["Myth vs fact", "Treatments explained", "Kids' dental care", "Patient stories"],
  "c-bright": ["Exam tips", "Faculty", "Results"],
  "c-urban": ["Site progress", "Buyer education", "Life at Urban Nest", "Locality guide"],
};

/** Monthly topic lists sent to clients to pick from (package units = how many they pick). */
export interface TopicList {
  id: string;
  clientId: string;
  month: string;
  needed: number;
  status: "draft" | "sent" | "confirmed";
  sentOn?: string;
}

export const seedTopicLists: TopicList[] = [
  { id: "tl-kvr-oct", clientId: "c-kaveri", month: "Oct 2026", needed: 12, status: "sent", sentOn: "2026-09-22" },
  { id: "tl-sls-oct", clientId: "c-lakshmi", month: "Oct 2026", needed: 10, status: "sent", sentOn: "2026-09-24" },
  { id: "tl-nvd-oct", clientId: "c-nova", month: "Oct 2026", needed: 8, status: "draft" },
];

const empty = { notes: "", links: [], versions: [] as ScriptVersion[] };

function v(label: string, at: string, by: string, status: ScriptVersion["status"], s: Pick<ScriptVersion, "hook" | "body" | "cta" | "onScreen">, clientNote?: string): ScriptVersion {
  return { id: `${label}-${at}`, label, at, by, status, clientNote, ...s };
}

const kvrTopics: [string, string, Video["format"], ContentItem["pick"]][] = [
  ["Millet pongal mix — a 5-minute breakfast", "Recipes in 60 seconds", "Reel", "picked"],
  ["Wood-pressed sesame oil — for cooking and hair", "Healthy swaps", "Reel", "picked"],
  ["Why our jaggery is darker (and why that's good)", "Farm to pack", "Reel", "picked"],
  ["Ragi malt for kids — Amma's recipe", "Recipes in 60 seconds", "Reel", "picked"],
  ["A day at the Erode packing unit", "Farm to pack", "Long-form", "picked"],
  ["Deepavali hamper — unboxing with the family", "Founder & family", "Ad", "picked"],
  ["Sugar vs palm sugar — the honest comparison", "Healthy swaps", "Reel", "picked"],
  ["Meet the farmers of Kodumudi", "Farm to pack", "Long-form", "picked"],
  ["3 snacks for the school box", "Recipes in 60 seconds", "Reel", "picked"],
  ["Customer review — Chennai family switches to chekku oil", "Founder & family", "Testimonial", "picked"],
  ["Is organic worth the price? Ramesh answers", "Founder & family", "Reel", undefined],
  ["Festive combo offer — 20% off", "Healthy swaps", "Ad", undefined],
  ["Coconut oil for hair — a weekly ritual", "Healthy swaps", "Reel", "skipped"],
  ["Our certification journey", "Farm to pack", "Reel", undefined],
];

const slsTopics: [string, string, Video["format"]][] = [
  ["Kanchipuram vs Banarasi — how to tell real silk", "Silk know-how", "Reel"],
  ["Deepavali saree drape in 60 seconds", "Festive looks", "Reel"],
  ["Behind the loom: 18 days for one saree", "Behind the loom", "Long-form"],
  ["Temple borders — what each motif means", "Silk know-how", "Reel"],
  ["Mother-daughter festive picks", "Festive looks", "Reel"],
  ["Bridal consultation — what to bring", "Customer stories", "Reel"],
  ["New arrivals: soft silks under ₹15,000", "Festive looks", "Reel"],
  ["How to store silk sarees for 20 years", "Silk know-how", "Reel"],
  ["Silk sarees for first-time buyers", "Silk know-how", "Reel"],
  ["Customer story — Chennai wedding shopping trip", "Customer stories", "Testimonial"],
  ["Festive colour guide 2026", "Festive looks", "Reel"],
  ["Silk cotton for office wear", "Silk know-how", "Reel"],
];

const nvdIdeas: [string, string, Video["format"]][] = [
  ["Is teeth whitening safe? 3 myths busted", "Myth vs fact", "Reel"],
  ["Milk-teeth cavities — do they matter?", "Kids' dental care", "Reel"],
  ["Dental crowns — metal vs ceramic", "Treatments explained", "Reel"],
  ["Bleeding gums — when to worry", "Myth vs fact", "Reel"],
  ["Dental implant in one day? Dr. Arvind explains", "Treatments explained", "Long-form"],
  ["Thumb sucking — how to help your child stop", "Kids' dental care", "Reel"],
  ["Patient story — implants after 10 years of dentures", "Patient stories", "Testimonial"],
  ["Night-time brushing — the 2-minute rule", "Myth vs fact", "Reel"],
];

export const seedContent: ContentItem[] = [
  // ── Kaveri: October topic list (with the client) ──
  ...kvrTopics.map(([title, pillar, format, pick], i): ContentItem => ({
    id: `ct-kvr-${i + 1}`,
    clientId: "c-kaveri",
    title,
    pillar,
    format,
    source: i % 3 === 0 ? "Genie Assistant" : "Team",
    stage: "topic",
    ownerId: "f-keerthana",
    month: "Oct 2026",
    due: "2026-10-03",
    pick,
    ...empty,
  })),
  // ── Sri Lakshmi: October topic list sent yesterday ──
  ...slsTopics.map(([title, pillar, format], i): ContentItem => ({
    id: `ct-sls-${i + 1}`,
    clientId: "c-lakshmi",
    title,
    pillar,
    format,
    source: i % 4 === 1 ? "Genie Assistant" : "Team",
    stage: "topic",
    ownerId: "p-karthik",
    month: "Oct 2026",
    due: "2026-10-01",
    ...empty,
  })),
  // ── Nova: October ideas, topic list still a draft ──
  ...nvdIdeas.map(([title, pillar, format], i): ContentItem => ({
    id: `ct-nvd-${i + 1}`,
    clientId: "c-nova",
    title,
    pillar,
    format,
    source: i % 2 === 0 ? "Genie Assistant" : "Team",
    stage: "idea",
    ownerId: "f-keerthana",
    month: "Oct 2026",
    due: "2026-10-06",
    ...empty,
  })),
  // ── Work in progress: September deliverables still in the content stages ──
  {
    id: "ct-kvr-farm",
    clientId: "c-kaveri",
    title: "Farm to pack: the Erode story",
    pillar: "Farm to pack",
    format: "Long-form",
    source: "Team",
    stage: "research",
    ownerId: "p-karthik",
    month: "Sep 2026",
    due: "2026-09-29",
    notes:
      "Ramesh's grandfather started with 4 acres in 1961. Today 38 partner farmers, 11 villages. Key numbers to confirm with Nithya: litres pressed per day (≈900 L), wooden chekku count (6).\n\nAngle: patience — oil pressed slowly at under 45°C. Avoid saying 'chemical-free' (claims rule) — use 'no refining, no bleaching'.",
    links: [
      { label: "Brand guide — tone and claims", url: "https://drive.google.com/brand-guide" },
      { label: "2025 farmer meet photos", url: "https://drive.google.com/farmer-meet" },
      { label: "FSSAI labelling rules for cold-pressed oils", url: "https://www.fssai.gov.in" },
    ],
    versions: [],
  },
  {
    id: "ct-nvd-smile",
    clientId: "c-nova",
    title: "Patient smile makeover testimonial",
    pillar: "Patient stories",
    format: "Testimonial",
    source: "Client",
    stage: "research",
    ownerId: "f-keerthana",
    month: "Sep 2026",
    due: "2026-09-30",
    videoCode: "NVD-0926-03",
    notes: "Patient: Mrs. Revathi, 34 — veneers before her sister's wedding. Consent form signed 20 Sep. Before/after photos only with written consent.",
    links: [{ label: "Consent form (signed)", url: "https://drive.google.com/nova-consent" }],
    versions: [],
  },
  {
    id: "ct-kvr-palm",
    clientId: "c-kaveri",
    title: "Palm sugar filter coffee — a healthy swap",
    pillar: "Healthy swaps",
    format: "Reel",
    source: "Genie Assistant",
    stage: "script",
    ownerId: "f-keerthana",
    month: "Sep 2026",
    due: "2026-09-28",
    notes: "Nithya will send the new 500 g pack before the shoot. Close-up of the pour; no health claims beyond 'less refined'.",
    links: [],
    versions: [
      v("v1", "2026-09-24T17:10", "Keerthana Mohan", "draft", {
        hook: "Same filter coffee. One small swap.",
        body: "Brew your decoction as usual.\nInstead of white sugar, stir in Kaveri palm sugar — it melts in 5 seconds.\nSame taste you love, from a less refined sweetener.",
        cta: "Order on kaveriorganics.in — link in bio.",
        onScreen: "1 SWAP • SAME TASTE",
      }),
    ],
  },
  {
    id: "ct-sls-weaver",
    clientId: "c-lakshmi",
    title: "Weaver spotlight — 40 years at the loom",
    pillar: "Behind the loom",
    format: "Reel",
    source: "Team",
    stage: "script",
    ownerId: "p-karthik",
    month: "Sep 2026",
    due: "2026-09-30",
    videoCode: "SLS-0926-04",
    notes: "Weaver: Murugan (62). Shoot at his home loom in Pillaiyarpalayam; Tamil voice, English subtitles.",
    links: [],
    versions: [
      v("v1", "2026-09-24T12:00", "Karthik Subramanian", "draft", {
        hook: "Forty years. One loom. Every saree still takes 18 days.",
        body: "Murugan anna learnt from his father at 22.\nToday his hands still count every thread of the temple border.\nWhen you wear a Sri Lakshmi silk, you wear his 18 days.",
        cta: "Visit Sri Lakshmi Silks, Gandhi Road, Kanchipuram.",
        onScreen: "40 YEARS · 18 DAYS · 1 SAREE",
      }),
    ],
  },
  {
    id: "ct-urb-rera",
    clientId: "c-urban",
    title: "DTCP vs RERA — what to check before you book",
    pillar: "Buyer education",
    format: "Reel",
    source: "Genie Assistant",
    stage: "script",
    ownerId: "p-karthik",
    month: "Oct 2026",
    due: "2026-10-05",
    notes: "Vikram on camera at the Avinashi Road site office. Show the RERA number on the hoarding.",
    links: [{ label: "TNRERA project search", url: "https://rera.tn.gov.in" }],
    versions: [
      v("v1", "2026-09-23T12:00", "Karthik Subramanian", "draft", {
        hook: "Two approvals every flat buyer in Tamil Nadu must check.",
        body: "DTCP approves the layout. RERA registers the project and protects your money.\nAsk for both numbers — and check them online in 2 minutes.\nAt Urban Nest, both are on every brochure.",
        cta: "Book a site visit — WhatsApp 94430 55501.",
        onScreen: "DTCP ✓  RERA ✓",
      }),
    ],
  },
  {
    id: "ct-nvd-kids",
    clientId: "c-nova",
    title: "Kids' first dental visit — tips",
    pillar: "Kids' dental care",
    format: "Reel",
    source: "Genie Assistant",
    stage: "approval",
    ownerId: "f-keerthana",
    month: "Sep 2026",
    due: "2026-09-26",
    sentOn: "2026-09-23",
    videoCode: "NVD-0926-04",
    notes: "Dr. Arvind with a 5-year-old patient (parent consent). Keep it playful.",
    links: [],
    versions: [
      v("v1", "2026-09-23T11:00", "Keerthana Mohan", "sent", {
        hook: "Scared of the dentist? Your child doesn't have to be.",
        body: "Tip 1: visit by the first birthday — just to say hello.\nTip 2: never use the dentist as a threat.\nTip 3: let them sit in the chair and 'count teeth' with us.",
        cta: "Book a happy first visit — Nova Dental Care, Coimbatore.",
        onScreen: "3 TIPS FOR A HAPPY FIRST VISIT",
      }),
    ],
  },
  {
    id: "ct-sls-launch",
    clientId: "c-lakshmi",
    title: "Deepavali collection launch",
    pillar: "Festive looks",
    format: "Reel",
    source: "Team",
    stage: "approval",
    ownerId: "p-karthik",
    month: "Oct 2026",
    due: "2026-09-27",
    sentOn: "2026-09-23",
    notes: "Store shoot Tuesday 29 Sep. 6 sarees, 3 models. Meenakshi prefers traditional music.",
    links: [],
    versions: [
      v("v1", "2026-09-23T16:00", "Karthik Subramanian", "sent", {
        hook: "This Deepavali, wear a story — not just a saree.",
        body: "Six new Kanchipuram designs, woven over 18 days each.\nPeacock, temple and rudraksha borders in festive reds and golds.\nIn store from 1 October.",
        cta: "Visit Sri Lakshmi Silks, Gandhi Road, Kanchipuram.",
        onScreen: "DEEPAVALI 2026 · FROM 1 OCT",
      }),
    ],
  },
  {
    id: "ct-kvr-oilstore",
    clientId: "c-kaveri",
    title: "Cold-pressed oil — how to store it right",
    pillar: "Healthy swaps",
    format: "Reel",
    source: "Genie Assistant",
    stage: "approval",
    ownerId: "f-keerthana",
    month: "Sep 2026",
    due: "2026-09-27",
    sentOn: "2026-09-24",
    notes: "Kitchen set at Nithya's home. Show the tin vs plastic comparison.",
    links: [],
    versions: [
      v("v1", "2026-09-24T09:40", "Keerthana Mohan", "sent", {
        hook: "Your good oil can go bad in 3 weeks. Here's why.",
        body: "Heat, light and air are the enemies.\nKeep it in a dark glass bottle or tin, away from the stove.\nUse within 6 months of opening.",
        cta: "Kaveri oils come in tins — kaveriorganics.in",
        onScreen: "DARK • COOL • CLOSED",
      }),
    ],
  },
  {
    id: "ct-kvr-testimonial",
    clientId: "c-kaveri",
    title: "Customer testimonial — Chennai homemaker",
    pillar: "Founder & family",
    format: "Testimonial",
    source: "Client",
    stage: "ready",
    ownerId: "f-keerthana",
    month: "Sep 2026",
    due: "2026-09-22",
    sentOn: "2026-09-19",
    videoCode: "KVR-0926-08",
    notes: "",
    links: [],
    versions: [
      v("v1", "2026-09-18T15:00", "Keerthana Mohan", "approved", {
        hook: "“My mother-in-law noticed the difference first.”",
        body: "Lakshmi from Anna Nagar switched to Kaveri groundnut oil last year.\nShe talks about taste, smell and her family's Sunday lunch.",
        cta: "Shop at kaveriorganics.in",
        onScreen: "REAL CUSTOMER · CHENNAI",
      }),
    ],
  },
  {
    id: "ct-kvr-founder",
    clientId: "c-kaveri",
    title: "Founder story — 3 generations of farming",
    pillar: "Founder & family",
    format: "Long-form",
    source: "Team",
    stage: "ready",
    ownerId: "p-karthik",
    month: "Sep 2026",
    due: "2026-09-08",
    sentOn: "2026-09-02",
    videoCode: "KVR-0926-04",
    notes: "Interview Ramesh + his father at the farm. Old family photos from Nithya.",
    links: [{ label: "Family photo archive", url: "https://drive.google.com/family-archive" }],
    versions: [
      v(
        "v1",
        "2026-09-02T11:00",
        "Karthik Subramanian",
        "changes",
        {
          hook: "In 1961, my grandfather pressed his first litre of groundnut oil.",
          body: "Scene 1: sunrise at the farm, wooden chekku turning.\nScene 2: Ramesh on how the family kept the slow method.\nScene 3: today — 38 farmers, one promise.",
          cta: "Taste the difference — kaveriorganics.in",
          onScreen: "SINCE 1961",
        },
        "Please add my father speaking — he started the Erode unit. Less about the machines.",
      ),
      v("v2", "2026-09-04T10:30", "Karthik Subramanian", "approved", {
        hook: "In 1961, my grandfather pressed his first litre of groundnut oil. My father refused to change the method.",
        body: "Scene 1: sunrise at the farm, wooden chekku turning.\nScene 2: Appa on starting the Erode unit in 1994.\nScene 3: Ramesh — why slow pressing still matters.\nScene 4: today — 38 farmers, one promise.",
        cta: "Taste the difference — kaveriorganics.in",
        onScreen: "SINCE 1961 · THREE GENERATIONS",
      }),
    ],
  },
];
