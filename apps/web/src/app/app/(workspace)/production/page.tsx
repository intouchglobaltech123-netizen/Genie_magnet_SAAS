import { LiveProduction } from "@/live/production";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <LiveProduction tab={tab} />;
}
