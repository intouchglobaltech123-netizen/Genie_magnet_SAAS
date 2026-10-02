import { LiveHiring } from "@/live/hiring";

export default async function Page({ searchParams }: { searchParams: Promise<{ candidate?: string }> }) {
  const { candidate } = await searchParams;
  return <LiveHiring candidateId={candidate} />;
}
