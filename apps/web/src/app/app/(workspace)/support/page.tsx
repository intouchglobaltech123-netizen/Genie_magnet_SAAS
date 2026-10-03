import { LiveSupport } from "@/live/support-inbox";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; about?: string }> }) {
  const { page, about } = await searchParams;
  return <LiveSupport from={page?.startsWith("/app") ? page.slice(0, 300) : undefined} about={about} />;
}
