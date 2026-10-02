import { LivePayroll } from "@/live/payroll";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <LivePayroll initialTab={tab} />;
}
