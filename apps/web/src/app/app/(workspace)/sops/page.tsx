import { LiveSops } from "@/live/sops";

export default async function Page({ searchParams }: { searchParams: Promise<{ sop?: string }> }) {
  const { sop } = await searchParams;
  return <LiveSops sopId={sop} />;
}
