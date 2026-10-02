import { LivePerformance } from "@/live/performance";

export default async function Page({ searchParams }: { searchParams: Promise<{ scorecard?: string }> }) {
  const { scorecard } = await searchParams;
  return <LivePerformance scorecardId={scorecard} />;
}
