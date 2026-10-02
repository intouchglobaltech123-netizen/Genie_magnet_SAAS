import { LiveReviews } from "@/live/reviews";

export default async function Page({ searchParams }: { searchParams: Promise<{ meeting?: string; tab?: string }> }) {
  const { meeting, tab } = await searchParams;
  return <LiveReviews meetingId={meeting} tab={tab} />;
}
