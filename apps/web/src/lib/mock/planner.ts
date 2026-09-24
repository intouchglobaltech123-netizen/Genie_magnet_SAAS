/**
 * Way To Fortune — sample data.
 * Content (questions, pattern meanings, actions, remedy) is taken from the Way To Fortune workbooks
 * by Venkateswaran R.S. (WayToFortune.in). The user is fictional ("Arun").
 */
import type { DiagnosticGroup, LogEntry, PlannerSetup } from "@/features/planner/calc";

export const WTF_TOOL = {
  name: "Way To Fortune",
  author: "Venkateswaran R.S.",
  site: "WayToFortune.in",
  community: "WTF Community",
  remedy: "5-Day 5AM Finance Detox & System Building Implementation Program",
};

/** Setup values match the workbook sample (age 27, ₹25,000, retire at 45) so the projections reconcile. */
export const sampleSetup: PlannerSetup = {
  name: "Arun",
  age: 27,
  monthlyIncome: 25000,
  retireAge: 45,
  inflation: 7,
  expectedReturn: 12,
  postRetirementReturn: 6,
  monthlySip: 3000,
};

/** Exactly the three rows present in the source workbook. The workbook's SIP input is ₹20,000. */
export const workbookSampleLog: LogEntry[] = [
  { id: "wb-1", day: 1, date: "2026-06-03", item: "Clothes", amount: 15000, kind: "Craving", leakType: "SPRINKLER", emotion: "Peer Pressure", mood: 3, rule48: "NA" },
  { id: "wb-2", day: 1, date: "2026-06-03", item: "Food", amount: 1000, kind: "Need", leakType: "NONE", emotion: "No Emotion-Just Habit", mood: 5, rule48: "NA" },
  { id: "wb-3", day: 1, date: "2026-06-03", item: "Gadget", amount: 5000, kind: "Want", leakType: "NONE", emotion: "Peer Pressure", mood: 3, rule48: "No" },
];
export const WORKBOOK_SAMPLE_SIP = 20000;

type Row = [number, string, number, LogEntry["kind"], LogEntry["leakType"], LogEntry["emotion"], number, LogEntry["rule48"], string?];

const rows: Row[] = [
  [1, "Groceries — Reliance Smart", 1850, "Need", "NONE", "No Emotion-Just Habit", 4, "NA"],
  [1, "Tea & bajji with the team", 60, "Craving", "SPRINKLER", "No Emotion-Just Habit", 4, "NA"],
  [2, "Monthly bus pass (MTC)", 900, "Need", "NONE", "No Emotion-Just Habit", 5, "NA"],
  [3, "Swiggy biryani at 11 pm", 340, "Craving", "CLOUD BURST", "Stress/Frustration", 2, "NA", "Deadline day — skipped dinner"],
  [4, "Jio recharge (84 days)", 859, "Need", "NONE", "No Emotion-Just Habit", 5, "NA"],
  [5, "Wireless earbuds — Amazon flash sale", 1999, "Want", "GEYSER", "Excitement/Celebration", 2, "No", "Already have wired ones"],
  [6, "Filter coffee & snacks", 90, "Craving", "SPRINKLER", "Boredom", 3, "NA"],
  [7, "Movie with friends + popcorn combo", 650, "Want", "MIRAGE", "Peer Pressure", 3, "No"],
  [8, "Pharmacy — Amma's BP tablets", 420, "Need", "NONE", "Anxiety/Fear", 4, "NA"],
  [9, "Tea & puffs", 70, "Craving", "SPRINKLER", "No Emotion-Just Habit", 3, "NA"],
  [10, "Shirt from an Instagram ad", 1299, "Want", "MIRAGE", "FOMO", 4, "Yes", "Waited 48 hrs — still wanted it"],
  [11, "Petrol — Activa", 500, "Need", "NONE", "No Emotion-Just Habit", 5, "NA"],
  [12, "Zomato pizza after a bad review", 480, "Craving", "CLOUD BURST", "Stress/Frustration", 2, "NA"],
  [13, "Netflix renewal (forgot to cancel)", 199, "Want", "OOZER", "No Emotion-Just Habit", 1, "No"],
  [14, "Cousin's wedding gift", 2500, "Want", "MIRAGE", "Peer Pressure", 3, "Yes"],
  [15, "Café with college friends", 420, "Want", "SPRINKLER", "Peer Pressure", 3, "No"],
  [16, "Groceries — local store", 1400, "Need", "NONE", "No Emotion-Just Habit", 4, "NA"],
  [17, "Sneakers — Big Billion Days", 2799, "Craving", "GEYSER", "FOMO", 2, "NA", "Sale countdown timer got me"],
  [18, "Auto fare — missed the bus", 150, "Need", "NONE", "Stress/Frustration", 3, "NA"],
  [19, "Chocolates & chips", 180, "Craving", "SPRINKLER", "Loneliness/Sadness", 2, "NA"],
  [20, "EB bill share", 650, "Need", "NONE", "No Emotion-Just Habit", 5, "NA"],
  [21, "Sunday biryani treat", 380, "Craving", "SPRINKLER", "Self-Reward", 4, "NA"],
  [22, "Phone cover + tempered glass", 450, "Want", "GEYSER", "Boredom", 3, "No"],
  [23, "Online course — Excel basics", 499, "Need", "NONE", "Excitement/Celebration", 5, "NA"],
  [24, "Late-night Swiggy order", 310, "Craving", "CLOUD BURST", "Loneliness/Sadness", 2, "NA"],
  [25, "Tea & vada", 50, "Craving", "SPRINKLER", "No Emotion-Just Habit", 3, "NA"],
];

/** A realistic September for Arun (₹25,000/month, Chennai). */
export const demoLog: LogEntry[] = rows.map(([day, item, amount, kind, leakType, emotion, mood, rule48, notes], i) => ({
  id: `sep-${i + 1}`,
  day,
  date: `2026-09-${String(day).padStart(2, "0")}`,
  item,
  amount,
  kind,
  leakType,
  emotion,
  mood,
  rule48,
  notes,
}));

// ───────────────────────────── Diagnostic ─────────────────────────────

export const SCALE = [
  { value: 1, label: "Never" },
  { value: 2, label: "Rarely" },
  { value: 3, label: "Sometimes" },
  { value: 4, label: "Often" },
  { value: 5, label: "Always" },
] as const;

/** Weights are the hidden multipliers in MY MONEY PROFILE!H (=score × weight). */
export const diagnosticGroups: DiagnosticGroup[] = [
  { key: "GEYSER", label: "Geyser", section: "flow", subtitle: "Sudden burst spender", weight: 3, questions: [1, 2, 3], dayToFix: "Day 1 & 2", meaning: "You act on impulse. Excitement drives spending. The urge hits, you buy.", action: "Track every impulse buy for 7 days. Use the 24-hr delay rule before any purchase." },
  { key: "DRIPPER", label: "Dripper", section: "flow", subtitle: "Slow & low spender", weight: 1, questions: [4, 5, 6], dayToFix: "Day 1 & 5", meaning: "You under-invest and under-spend. Caution kills your growth potential.", action: "Set a minimum monthly SIP today — even ₹500. Start before you feel 'ready'." },
  { key: "RESERVOIR", label: "Reservoir", section: "flow", subtitle: "Safe hoarder, no growth", weight: 2, questions: [7, 8, 9], dayToFix: "Day 5", meaning: "You save but never grow. Money sits idle, inflation eats it silently.", action: "Move idle savings to a Liquid Fund or beginner SIP. Safe ≠ smart." },
  { key: "OOZER", label: "Oozer", section: "flow", subtitle: "Silent leaker, no awareness", weight: 3, questions: [10, 11, 12], dayToFix: "Day 2", meaning: "Money disappears without you noticing. No tracking = no control.", action: "Track EVERY expense for 30 days. Use a free app or a notebook — just track." },
  { key: "PURIFIER", label: "Purifier", section: "flow", subtitle: "Over-analyser, paralysed", weight: 2, questions: [13, 14, 15], dayToFix: "Day 5", meaning: "Analysis paralysis. You know what to do but overthink and never start.", action: "Start with ONE action in the next 24 hours. Perfect plans don't exist." },
  { key: "CLOUD BURST", label: "Cloud Burst", section: "flow", subtitle: "Controlled, then floods", weight: 3, questions: [16, 17, 18], dayToFix: "Day 3 & 4", meaning: "You hold control well, then crash. Stress and boredom break your rules.", action: "Identify your burst triggers. Plan a 'safe spend' budget for emotional days." },
  { key: "THE DAM", label: "The Dam", section: "flow", subtitle: "Avoidance & inaction", weight: 3, questions: [19, 20, 21], dayToFix: "Day 4", meaning: "Avoidance. Bills, investments, and plans pile up due to fear.", action: "Do ONE financial task today — pay a bill, open a statement, start tracking." },
  { key: "SPRINKLER", label: "Sprinkler", section: "flow", subtitle: "Tiny spends everywhere", weight: 2, questions: [22, 23, 24], dayToFix: "Day 2", meaning: "Micro leaks everywhere. Small spends feel harmless but compound into huge losses.", action: "Add up your last 30 days of 'small' spends. Shock yourself into awareness." },
  { key: "MIRAGE", label: "Mirage", section: "flow", subtitle: "Looks wealthy, hollow inside", weight: 2, questions: [25, 26, 27], dayToFix: "Day 1 & 5", meaning: "You look wealthy, but your savings don't match. Lifestyle inflation is real.", action: "Calculate your Net Worth today. Income minus lifestyle = your real financial health." },
  { key: "SELF-WORTH", label: "Self-Worth", section: "belief", subtitle: "I deserve to spend", weight: 2, questions: [28, 29, 30], dayToFix: "Day 3", meaning: "You use spending as a reward. Money is linked to your sense of value.", action: "Find 3 non-spending ways to reward yourself. Separate self-worth from spending." },
  { key: "SCARCITY", label: "Scarcity", section: "belief", subtitle: "There is never enough", weight: 3, questions: [31, 32, 33], dayToFix: "Day 3 & 4", meaning: "Chronic worry about money. You either hoard it or binge-spend from stress.", action: "Write: 'Money is a tool I can grow and direct.' Repeat it daily for 21 days." },
  { key: "GUILT & SHAME", label: "Guilt & Shame", section: "belief", subtitle: "Money is bad", weight: 2, questions: [34, 35, 36], dayToFix: "Day 3", meaning: "Deep guilt around wealth. You may unconsciously sabotage your own growth.", action: "Rewrite: 'Being wealthy allows me to serve better, give more, and live free.'" },
  { key: "FEAR & SAFETY", label: "Fear & Safety", section: "belief", subtitle: "Investing is risky", weight: 2, questions: [37, 38, 39], dayToFix: "Day 5", meaning: "Risk aversion blocks all growth. Saving without investing = slow wealth loss.", action: "Start a ₹500 SIP in a liquid fund. Safety and growth can coexist." },
  { key: "COMPARISON & STATUS", label: "Comparison & Status", section: "belief", subtitle: "I must look successful", weight: 2, questions: [40, 41, 42], dayToFix: "Day 2 & 3", meaning: "Others' spending triggers yours. Your money is funding someone else's ego.", action: "Mute 5 accounts that trigger comparison spending. Curate your digital feed." },
  { key: "DESERVINGNESS", label: "Deservingness", section: "belief", subtitle: "I'm not worthy of wealth", weight: 3, questions: [43, 44, 45], dayToFix: "Day 3", meaning: "You don't feel worthy of wealth. This blocks both earning and keeping money.", action: "Write 5 reasons you deserve financial freedom. Re-read them every morning." },
  { key: "HELPLESSNESS", label: "Helplessness", section: "belief", subtitle: "I can't control money", weight: 3, questions: [46, 47, 48], dayToFix: "Day 1 & 3", meaning: "Learned powerlessness. You feel money just 'happens to you', not for you.", action: "Prove it wrong: control one small thing today — track one expense, do one SIP." },
  { key: "CONTROL & PERFECTION", label: "Control & Perfection", section: "belief", subtitle: "I need the perfect plan", weight: 1, questions: [49, 50, 51], dayToFix: "Day 5", meaning: "Perfectionism = permanent delay. You need the 'perfect plan' that never comes.", action: "Set a 1-week rule: take ONE imperfect financial action before conditions are perfect." },
  { key: "IDENTITY & LOYALTY", label: "Identity & Loyalty", section: "belief", subtitle: "Rich people are greedy", weight: 2, questions: [52, 53, 54], dayToFix: "Day 3", meaning: "Wealth feels like betrayal. Your roots may be blocking your financial rise.", action: "Rewrite: 'Being wealthy helps me lift the people I love. It is not betrayal.'" },
];

export interface DiagnosticQuestion {
  n: number;
  group: string;
  q: string;
  /** Answer in the workbook sample. null = invalid entry in the sheet (Q11 was typed as "2)"), which zeroes OOZER. */
  sample: number | null;
}

export const questions: DiagnosticQuestion[] = [
  { n: 1, group: "GEYSER", q: "Do you buy things the moment you feel a strong urge — like a flash sale or craving?", sample: 5 },
  { n: 2, group: "GEYSER", q: "Do you regret purchases within 24-48 hours of buying them?", sample: 2 },
  { n: 3, group: "GEYSER", q: "When you feel excited or celebratory, does your spending suddenly spike?", sample: 2 },
  { n: 4, group: "DRIPPER", q: "Do you spend so little that you sometimes miss out on genuinely useful things?", sample: 4 },
  { n: 5, group: "DRIPPER", q: "Do you delay purchases so long that opportunities or good deals pass you by?", sample: 4 },
  { n: 6, group: "DRIPPER", q: "Are your investments too small or too slow to create real growth?", sample: 4 },
  { n: 7, group: "RESERVOIR", q: "Do you keep money only in savings accounts or FDs, avoiding any market-linked investment?", sample: 1 },
  { n: 8, group: "RESERVOIR", q: "Does the idea of losing even ₹100 in investments feel terrifying?", sample: 1 },
  { n: 9, group: "RESERVOIR", q: "Has your money been 'safe' but never multiplied over the past 3 years?", sample: 5 },
  { n: 10, group: "OOZER", q: "Do you reach the end of the month not knowing where your money went?", sample: 3 },
  { n: 11, group: "OOZER", q: "Do you have subscriptions or recurring payments you forgot you signed up for?", sample: null },
  { n: 12, group: "OOZER", q: "Is your bank statement full of small spends you cannot explain?", sample: 2 },
  { n: 13, group: "PURIFIER", q: "Do you research a purchase or investment for weeks but still never take action?", sample: 2 },
  { n: 14, group: "PURIFIER", q: "Do you wait for the 'perfect time' to invest or save, and that time never comes?", sample: 2 },
  { n: 15, group: "PURIFIER", q: "Do you feel frustrated because you know the plan but cannot execute it?", sample: 4 },
  { n: 16, group: "CLOUD BURST", q: "Do you stay disciplined for 20-25 days and then spend heavily in one go?", sample: 3 },
  { n: 17, group: "CLOUD BURST", q: "Does stress, boredom, or a festival suddenly trigger a large spending spree?", sample: 4 },
  { n: 18, group: "CLOUD BURST", q: "Do you feel in control — until an emotional moment breaks all your rules?", sample: 2 },
  { n: 19, group: "THE DAM", q: "Do you delay paying bills, filing taxes, or reviewing your finances because it feels overwhelming?", sample: 3 },
  { n: 20, group: "THE DAM", q: "Do you avoid opening bank statements or investment reports out of fear?", sample: 2 },
  { n: 21, group: "THE DAM", q: "Is 'I will start next month' a phrase you have repeated for more than 3 months?", sample: 5 },
  { n: 22, group: "SPRINKLER", q: "Do you spend small amounts constantly — ₹50 here, ₹100 there — and feel it's harmless?", sample: 5 },
  { n: 23, group: "SPRINKLER", q: "Do you buy coffee, snacks, or comfort items daily without tracking the total?", sample: 5 },
  { n: 24, group: "SPRINKLER", q: "Are your daily 'micro spends' adding up to thousands you never notice?", sample: 5 },
  { n: 25, group: "MIRAGE", q: "Do you look financially successful to others but feel anxious about your real savings?", sample: 4 },
  { n: 26, group: "MIRAGE", q: "Do you upgrade your lifestyle every time income increases, leaving savings unchanged?", sample: 3 },
  { n: 27, group: "MIRAGE", q: "Do you spend on appearances (gadgets, clothes, dining) to feel respected or valued?", sample: 4 },
  { n: 28, group: "SELF-WORTH", q: "Do you justify purchases by saying 'I worked hard, I deserve this'?", sample: 3 },
  { n: 29, group: "SELF-WORTH", q: "Do you feel spending on yourself is the only way to reward yourself?", sample: 5 },
  { n: 30, group: "SELF-WORTH", q: "Does spending give you a sense of value or self-worth?", sample: 5 },
  { n: 31, group: "SCARCITY", q: "Do you feel that no matter how much you earn, it will never be enough?", sample: 5 },
  { n: 32, group: "SCARCITY", q: "Do you hoard money out of fear of loss, but also spend in bursts when stressed?", sample: 3 },
  { n: 33, group: "SCARCITY", q: "Does money feel like a constant source of worry rather than a tool?", sample: 1 },
  { n: 34, group: "GUILT & SHAME", q: "Do you feel guilty for wanting to be wealthy or talking about money?", sample: 1 },
  { n: 35, group: "GUILT & SHAME", q: "Were you raised to believe that 'people with money are greedy or selfish'?", sample: 1 },
  { n: 36, group: "GUILT & SHAME", q: "Do you quietly self-sabotage your savings or investments out of guilt?", sample: 1 },
  { n: 37, group: "FEAR & SAFETY", q: "Do you keep money idle in savings instead of investing because 'markets are risky'?", sample: 3 },
  { n: 38, group: "FEAR & SAFETY", q: "Does any form of financial risk — even low-risk SIPs — make you feel unsafe?", sample: 3 },
  { n: 39, group: "FEAR & SAFETY", q: "Do you prioritise 'not losing' over 'growing' your money?", sample: 4 },
  { n: 40, group: "COMPARISON & STATUS", q: "Do you buy things to keep up with friends, colleagues, or social media trends?", sample: 2 },
  { n: 41, group: "COMPARISON & STATUS", q: "Does seeing someone else's purchase make you feel you need the same?", sample: 2 },
  { n: 42, group: "COMPARISON & STATUS", q: "Is 'what people think' a major factor in your financial decisions?", sample: 1 },
  { n: 43, group: "DESERVINGNESS", q: "Deep inside, do you believe wealth is for 'certain people' — not you?", sample: 1 },
  { n: 44, group: "DESERVINGNESS", q: "Do you feel uncomfortable when someone compliments your financial discipline?", sample: 2 },
  { n: 45, group: "DESERVINGNESS", q: "Have you ever avoided an investment opportunity because it felt 'too good for me'?", sample: 2 },
  { n: 46, group: "HELPLESSNESS", q: "Do you feel that no matter what you do, money just slips away?", sample: 1 },
  { n: 47, group: "HELPLESSNESS", q: "Do you believe your financial situation is driven by luck or fate, not your choices?", sample: 1 },
  { n: 48, group: "HELPLESSNESS", q: "Have you given up trying to budget or track money because 'it never works'?", sample: 3 },
  { n: 49, group: "CONTROL & PERFECTION", q: "Do you refuse to start investing until you fully understand every detail?", sample: 3 },
  { n: 50, group: "CONTROL & PERFECTION", q: "Do you delay financial decisions because you fear making a mistake?", sample: 3 },
  { n: 51, group: "CONTROL & PERFECTION", q: "Is 'not starting at all' your default response to financial uncertainty?", sample: 2 },
  { n: 52, group: "IDENTITY & LOYALTY", q: "Do you associate wealth with bad character, dishonesty, or exploitation?", sample: 1 },
  { n: 53, group: "IDENTITY & LOYALTY", q: "Do you resist building wealth because it might change who you are?", sample: 1 },
  { n: 54, group: "IDENTITY & LOYALTY", q: "Do you feel disloyal to your roots or family if you become wealthy?", sample: 1 },
];

export const sampleAnswers: Record<number, number | null> = Object.fromEntries(questions.map((q) => [q.n, q.sample]));

export const detoxDays = [
  { day: "Day 1", title: "Awareness & net worth", focus: "Geyser · Dripper · Mirage · Helplessness" },
  { day: "Day 2", title: "Track every rupee", focus: "Geyser · Oozer · Sprinkler · Comparison" },
  { day: "Day 3", title: "Rewire money beliefs", focus: "Cloud Burst · Self-Worth · Scarcity · Guilt · Deservingness · Identity" },
  { day: "Day 4", title: "Break avoidance", focus: "The Dam · Cloud Burst · Scarcity" },
  { day: "Day 5", title: "Build the investing system", focus: "Dripper · Reservoir · Purifier · Fear & Safety · Control" },
];
