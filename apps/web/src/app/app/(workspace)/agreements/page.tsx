import { LiveAgreements } from "@/live/agreements";

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <LiveAgreements view={view} />;
}
