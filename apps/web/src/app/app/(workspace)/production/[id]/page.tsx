import { LiveVideo } from "@/live/video";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <LiveVideo id={id} tab={tab} />;
}
