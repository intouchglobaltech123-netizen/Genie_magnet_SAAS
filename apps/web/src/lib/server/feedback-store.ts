import { promises as fs } from "fs";
import path from "path";

export type FeedbackType = "change" | "missing" | "bug" | "question" | "good";
export type FeedbackPriority = "must" | "nice";
export type FeedbackStatus = "open" | "planned" | "done" | "wontdo";

export interface FeedbackItem {
  id: string;
  createdAt: string;
  name: string;
  page: string; // pathname
  module: string; // human module title
  role: string; // role the reviewer was viewing as
  type: FeedbackType;
  priority: FeedbackPriority;
  text: string;
  status: FeedbackStatus;
}

// On Railway, mount a volume and set FEEDBACK_DIR to its path (e.g. /data) so
// feedback survives redeploys. Locally it falls back to apps/web/.data.
const dir = process.env.FEEDBACK_DIR || path.join(process.cwd(), ".data");
const file = path.join(dir, "feedback.json");

// Serialise writes so two reviewers submitting at once cannot clobber each other.
let queue: Promise<unknown> = Promise.resolve();

export async function readFeedback(): Promise<FeedbackItem[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as FeedbackItem[];
  } catch {
    return [];
  }
}

export function mutateFeedback<T>(fn: (items: FeedbackItem[]) => T): Promise<T> {
  const run = queue.then(async () => {
    const items = await readFeedback();
    const result = fn(items);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(items, null, 2));
    await fs.rename(tmp, file);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}
