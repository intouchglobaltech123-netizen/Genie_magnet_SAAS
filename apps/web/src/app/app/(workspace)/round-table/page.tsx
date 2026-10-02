import { LiveRoundTable } from "@/live/round-table";

export default async function Page({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  return <LiveRoundTable sessionId={session} />;
}
