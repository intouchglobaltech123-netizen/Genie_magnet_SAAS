import { LiveGoals } from "@/live/goals";

export default async function Page({ searchParams }: { searchParams: Promise<{ goal?: string }> }) {
  const { goal } = await searchParams;
  return <LiveGoals goalId={goal} />;
}
