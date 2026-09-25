import { personById } from "@/lib/mock/core";

// Round Table — the peer-review ritual inside every 45-day strategic review.
// Everyone reviews everyone (and themselves) on three questions, one person per timed round.

export type RTStatus = "draft" | "live" | "moderation" | "released";

export interface RTAnswer {
  id: string;
  subjectId: string; // person being reviewed
  authorId: string; // person writing
  answers: [string, string, string];
  self: boolean;
  hidden: boolean; // hidden by manager during moderation
  hiddenReason?: string;
  missed: boolean; // buzzer went before anything was written
}

export interface RTSession {
  id: string;
  name: string;
  reviewTitle: string; // the 45-day review it belongs to
  reviewId?: string;
  date: string;
  facilitatorId: string;
  participantIds: string[];
  questions: [string, string, string];
  secondsPerPerson: number;
  status: RTStatus;
  currentIndex: number;
  answers: RTAnswer[];
  releasedAt?: string;
  commitments: Record<string, string>; // personId → improvement commitment
}

export const DEFAULT_QUESTIONS: [string, string, string] = [
  "What does {name} do best?",
  "Where does {name} fall short?",
  "What can {name} do better in the next 45 days?",
];

export const TEAM = ["p-ashwin", "p-karthik", "p-vignesh", "p-divya", "p-surya", "p-meena", "p-priya"];

export const firstName = (id: string) => personById(id).name.split(" ")[0]!;

export const fillName = (q: string, id: string) => q.replaceAll("{name}", firstName(id));

/** Answer bank used to simulate teammates filling in their sheets live. */
export const BANK: Record<string, { best: string[]; fail: string[]; better: string[]; self: [string, string, string] }> = {
  "p-ashwin": {
    best: [
      "Keeps every client calm even when we are late — nobody handles pressure calls like him.",
      "Knows the status of every video without opening the sheet. Great memory for commitments.",
      "Very fair when two people disagree; listens to both sides before deciding.",
      "Plans the shoot calendar well in advance so we are never scrambling for kit.",
      "Backs the team in front of clients instead of blaming us.",
      "Quick decisions on small things, so work does not get stuck waiting.",
    ],
    fail: [
      "Says yes to client changes on call and tells us later — we find out after the edit is done.",
      "Sometimes assigns the same urgent task to two people.",
      "Feedback comes very late in the day, after 7 PM, which makes us stay back.",
      "Does not always explain why priorities changed.",
      "Too many WhatsApp follow-ups instead of one clear list in the morning.",
      "Takes on too much himself instead of delegating to leads.",
    ],
    better: [
      "Log every client change as a change request before promising a date.",
      "Share one priority list at the 9:30 stand-up and stick to it for the day.",
      "Give feedback before 5 PM so fixes can happen the same day.",
      "Delegate client check-in calls for Nova and BrightPath to Priya.",
      "Explain the 'why' when priorities shift — the team will adjust faster.",
      "Block 30 minutes daily to clear approvals so editors are not waiting.",
    ],
    self: [
      "I keep clients happy and the calendar moving.",
      "I agree to client changes too quickly and the team pays for it.",
      "Route every change through the CR process and protect editor time.",
    ],
  },
  "p-karthik": {
    best: [
      "His scripts have the strongest hooks — the first 3 seconds always land.",
      "Directs talent patiently; even nervous clients relax on camera with him.",
      "Brings fresh reference ideas for every brief.",
      "Very clear shot lists — the camera team knows exactly what to capture.",
      "Takes ownership when a shoot goes wrong instead of blaming others.",
    ],
    fail: [
      "Scripts reach the client late, which squeezes the shoot prep time.",
      "Changes the plan on set without telling the editor what changed.",
      "Sometimes over-shoots — too much footage makes editing slow.",
      "Does not update the video data sheet during the shoot.",
      "Gets defensive when editors question a creative choice.",
    ],
    better: [
      "Send scripts 3 days before every shoot, not the night before.",
      "Fill clip numbers in the data sheet on set so VP and editing are faster.",
      "Brief the editor for 10 minutes after each shoot.",
      "Limit takes per scene; mark the best take on set.",
      "Be open to edit suggestions — we want the same result.",
    ],
    self: [
      "Strong hooks and clear direction on set.",
      "Scripts go late and I don't document on-set changes.",
      "Lock scripts 72 hours before shoots and brief editors every time.",
    ],
  },
  "p-vignesh": {
    best: [
      "Lighting is always clean — the product shots look premium.",
      "Never forgets the kit; the Packed column is always complete.",
      "Reaches the location early and sets up before everyone arrives.",
      "Handles two cameras alone without complaining.",
      "Very careful with equipment — nothing has been damaged under him.",
    ],
    fail: [
      "Backup to NAS is sometimes delayed by a day, so VP gets ticked late.",
      "Audio levels are not checked before rolling on some shoots.",
      "Quiet in meetings — we only hear problems after they happen.",
      "Does not mark clip numbers clearly, editors search a lot.",
      "Returns kit late on Monday after weekend shoots.",
    ],
    better: [
      "Complete footage backup and VP on the same day as the shoot.",
      "Do a 10-second audio test before every take.",
      "Speak up early if kit or time is not enough.",
      "Label cards and clip ranges properly in the data sheet.",
      "Return all kit within 12 hours and sign the Received column.",
    ],
    self: [
      "Clean lighting and I take care of the kit.",
      "My backups are sometimes late.",
      "Same-day backup and VP for every shoot.",
    ],
  },
  "p-divya": {
    best: [
      "The best colour and pacing in the team — her reels feel premium.",
      "Always ready to help juniors with Premiere shortcuts.",
      "Meets rush deadlines even when the brief changes.",
      "Her QC first-pass rate is the highest; very few corrections.",
      "Stays calm when clients send a long list of changes.",
    ],
    fail: [
      "Takes too much work alone and gets overloaded — then everything is late at once.",
      "Does not update the editing data sheet until the end of the day.",
      "Sometimes skips the spelling check when rushing.",
      "Hesitates to push back on unreasonable timelines.",
      "Works late too often, which is not sustainable.",
    ],
    better: [
      "Say no or ask Ashwin to re-prioritise when the queue is over capacity.",
      "Tick the 9 edit steps live so the team can see progress.",
      "Never skip the spelling step on rush jobs — ask someone to proof.",
      "Share her colour presets with Surya and Rahul.",
      "Leave on time at least 4 days a week.",
    ],
    self: [
      "Colour, pacing and meeting rush deadlines.",
      "I overload myself and update my sheet late.",
      "Flag overload early and update the edit steps as I go.",
    ],
  },
  "p-surya": {
    best: [
      "Fastest at turning around reels — very good with trends and music.",
      "Always positive, lifts the mood in the edit room.",
      "Picks up new effects quickly from YouTube tutorials.",
      "Good at sound cleanup; his audio is always clear.",
      "Willing to take last-minute tasks.",
    ],
    fail: [
      "Misses small brand details — logo position, fonts.",
      "QC first-pass rate is low, so reels come back for corrections.",
      "Leaves the delay reason blank in the data sheet.",
      "Sometimes on the phone during focused work time.",
      "Does not ask questions when the brief is unclear.",
    ],
    better: [
      "Keep the client brand guide open while editing.",
      "Run the QC checklist himself before sending to QC.",
      "Always write the delay reason — it helps planning.",
      "Ask Karthik about unclear briefs before starting the edit.",
      "Learn colour correction from Divya this cycle.",
    ],
    self: [
      "Speed and trend awareness.",
      "Small mistakes that fail QC.",
      "Self-QC every video before submitting.",
    ],
  },
  "p-meena": {
    best: [
      "Knows exactly what time each client's audience is active.",
      "Replies to DMs and comments fast — clients notice that.",
      "Great captions in both Tamil and English.",
      "Keeps the content calendar full two weeks ahead.",
      "Very organised with story schedules.",
    ],
    fail: [
      "Posts sometimes go without final approval screenshots saved.",
      "Does not share weekly numbers unless asked.",
      "Gets stressed when multiple clients post on the same day.",
      "Error count on posts (wrong tags) went up this month.",
      "Rarely joins shoot planning, so content ideas don't reach the script.",
    ],
    better: [
      "Save publish proof (URL + screenshot) for every post.",
      "Share a Friday numbers summary with the team.",
      "Use the scheduling tool for batch posting to reduce same-day stress.",
      "Double-check tags and handles before posting.",
      "Join script meetings for 15 minutes to share what's trending.",
    ],
    self: [
      "Timing, captions and quick replies.",
      "I don't share numbers and sometimes miss proof.",
      "Weekly numbers every Friday and proof for every post.",
    ],
  },
  "p-priya": {
    best: [
      "Brings in the best-quality leads — Revathi Jewellers and Chandran Hospitals were her work.",
      "Proposals look professional and are sent on time.",
      "Excellent follow-up discipline in the CRM.",
      "Understands client business before pitching.",
      "Confident in front of senior decision makers.",
    ],
    fail: [
      "Promises delivery dates before checking production capacity.",
      "Offers discounts close to the limit too quickly.",
      "Handover to production after a sale is too brief.",
      "Not always in the office for internal meetings.",
      "Lost-deal reasons are not recorded properly.",
    ],
    better: [
      "Check the capacity screen before committing dates.",
      "Hold discounts until the second meeting.",
      "Do a 20-minute kickoff with production for every new client.",
      "Record a clear lost reason for every closed deal.",
      "Share what clients say about our work with the editors — it motivates them.",
    ],
    self: [
      "Quality leads and strong proposals.",
      "I commit dates without checking capacity.",
      "Capacity check before every commitment and proper kickoffs.",
    ],
  },
};

const pick = <T,>(arr: T[], i: number) => arr[((i % arr.length) + arr.length) % arr.length]!;

/** Deterministic answer a teammate would write about a subject. */
export function bankAnswer(subjectId: string, authorId: string, salt = 0): [string, string, string] {
  const b = BANK[subjectId];
  if (!b) return ["Reliable and supportive.", "Could communicate progress more often.", "Share updates at the daily stand-up."];
  if (subjectId === authorId) return b.self;
  // One deliberately harsh sheet in live sessions so the manager's moderation step has something to catch.
  if (salt === 0 && subjectId === "p-surya" && authorId === "p-vignesh")
    return [pick(b.best, 1), "Honestly lazy with details — I have to redo his exports every week.", pick(b.better, 0)];
  const k = TEAM.indexOf(authorId) + salt;
  return [pick(b.best, k), pick(b.fail, k + 1), pick(b.better, k + 2)];
}

function completeAnswers(ids: string[], salt: number): RTAnswer[] {
  const out: RTAnswer[] = [];
  for (const s of ids)
    for (const a of ids)
      out.push({ id: `seed-${salt}-${s}-${a}`, subjectId: s, authorId: a, answers: bankAnswer(s, a, salt), self: s === a, hidden: false, missed: false });
  return out;
}

export const seedSessions: RTSession[] = [
  {
    id: "rt-6",
    name: "Round Table · Review #6",
    reviewTitle: "45-Day Strategic Review #6",
    reviewId: "rv-s6",
    date: "2026-08-26T15:00:00",
    facilitatorId: "p-ashwin",
    participantIds: TEAM,
    questions: DEFAULT_QUESTIONS,
    secondsPerPerson: 90,
    status: "released",
    currentIndex: TEAM.length,
    answers: completeAnswers(TEAM, 3),
    releasedAt: "2026-08-27T10:00:00",
    commitments: {
      "p-divya": "Flag overload to Ashwin before accepting a 4th rush job in a week.",
      "p-surya": "Run my own QC checklist before sending anything to QC.",
      "p-ashwin": "Log client changes as CRs before promising new dates.",
    },
  },
  {
    id: "rt-7",
    name: "Round Table · Review #7",
    reviewTitle: "45-Day Strategic Review #7",
    reviewId: "rv-s7",
    date: "2026-10-10T15:00:00",
    facilitatorId: "p-ashwin",
    participantIds: TEAM,
    questions: DEFAULT_QUESTIONS,
    secondsPerPerson: 60,
    status: "draft",
    currentIndex: 0,
    answers: [],
    commitments: {},
  },
];

/** Very small theme extractor for the results screen. */
const THEMES: [string, RegExp][] = [
  ["Deadlines", /late|deadline|on time|delay|rush|timeline/i],
  ["Communication", /explain|share|brief|speak|tell|update|feedback|questions/i],
  ["Quality", /qc|mistake|spelling|brand|audio|colour|quality|error/i],
  ["Workload", /overload|too much|alone|late in the day|stay back|sustainable|delegate/i],
  ["Process", /sheet|cr |change request|checklist|vp|backup|proof|capacity|log/i],
  ["Client handling", /client/i],
];

export function themesOf(texts: string[]) {
  const counts = THEMES.map(([name, re]) => ({ name, count: texts.filter((t) => re.test(t)).length }));
  return counts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
}

export const FLAG_WORDS = /useless|lazy|stupid|idiot|worst|hate|never does anything/i;
