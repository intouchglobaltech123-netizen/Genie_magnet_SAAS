import { LiveContentItem } from "@/live/content";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveContentItem id={id} />;
}
