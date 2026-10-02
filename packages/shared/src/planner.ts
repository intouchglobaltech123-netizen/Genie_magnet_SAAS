// The financial planner (P5-19, "Way To Fortune"): each person's own setup, daily spending log and money behaviour
// answers. It belongs to the person alone — nobody else, the owner included, can open it — and nothing in it feeds
// payroll or reports. Its calculations mirror the source workbooks and run in the browser.
import { z } from "zod";

export const SPEND_KINDS = ["Need", "Want", "Craving"] as const;
export const RULE_USED = ["Yes", "No", "NA"] as const;
export const LEAK_TYPES = ["GEYSER", "DRIPPER", "RESERVOIR", "OOZER", "PURIFIER", "CLOUD BURST", "THE DAM", "SPRINKLER", "MIRAGE", "NONE"] as const;
export const SPEND_EMOTIONS = [
  "Stress/Frustration",
  "Boredom",
  "Excitement/Celebration",
  "Loneliness/Sadness",
  "Peer Pressure",
  "Anger",
  "Anxiety/Fear",
  "Self-Reward",
  "FOMO",
  "No Emotion-Just Habit",
] as const;

const money = z.number().min(0).max(1e10);

export const plannerData = z.object({
  /** The month the daily log is for. */
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  setup: z.object({
    name: z.string().trim().max(120),
    age: z.number().int().min(10).max(100),
    monthlyIncome: money,
    retireAge: z.number().int().min(20).max(100),
    inflation: z.number().min(0).max(50),
    expectedReturn: z.number().min(0).max(50),
    postRetirementReturn: z.number().min(0).max(50),
    monthlySip: money,
  }),
  log: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        day: z.number().int().min(1).max(31),
        date: z.iso.date(),
        item: z.string().trim().max(200),
        amount: money,
        kind: z.enum(SPEND_KINDS),
        leakType: z.enum(LEAK_TYPES),
        emotion: z.enum(SPEND_EMOTIONS),
        mood: z.number().int().min(0).max(5),
        rule48: z.enum(RULE_USED),
        notes: z.string().max(500).optional(),
      }),
    )
    .max(2000),
  /** Money behaviour diagnostic answers, by question number (1 to 54): 1 to 5. */
  answers: z.record(z.string().regex(/^\d{1,2}$/), z.number().int().min(1).max(5).nullable()),
  quizIndex: z.number().int().min(0).max(60).default(0),
  completedAt: z.iso.datetime().optional(),
  detoxJoined: z.boolean().default(false),
});
export type PlannerData = z.output<typeof plannerData>;
