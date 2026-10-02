import { LiveReport } from "@/live/reports";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveReport id={id} />;
}
