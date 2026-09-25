import { randomUUID } from "crypto";
import { mutateFeedback, readFeedback, type FeedbackItem } from "@/lib/server/feedback-store";

export const dynamic = "force-dynamic";

const TYPES = ["change", "missing", "bug", "question", "good"];
const PRIORITIES = ["must", "nice"];
const STATUSES = ["open", "planned", "done", "wontdo"];

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET() {
  const items = await readFeedback();
  return Response.json(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = clip(body?.text, 4000);
  if (!text) return Response.json({ error: "Feedback text is required." }, { status: 400 });

  const item: FeedbackItem = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    name: clip(body?.name, 80) || "Anonymous",
    page: clip(body?.page, 200) || "/",
    module: clip(body?.module, 120) || "General",
    role: clip(body?.role, 40),
    type: TYPES.includes(body?.type) ? body.type : "change",
    priority: PRIORITIES.includes(body?.priority) ? body.priority : "nice",
    text,
    status: "open",
  };
  await mutateFeedback((items) => items.push(item));
  return Response.json(item, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id || !STATUSES.includes(body?.status)) return Response.json({ error: "Invalid update." }, { status: 400 });
  const updated = await mutateFeedback((items) => {
    const it = items.find((i) => i.id === body.id);
    if (it) it.status = body.status;
    return it;
  });
  return updated ? Response.json(updated) : Response.json({ error: "Not found." }, { status: 404 });
}
