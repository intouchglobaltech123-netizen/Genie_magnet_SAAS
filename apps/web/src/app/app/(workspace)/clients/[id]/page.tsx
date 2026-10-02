import { LiveClient } from "@/live/client-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveClient id={id} />;
}
