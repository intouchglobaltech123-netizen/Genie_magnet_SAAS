import { LiveInvoices } from "@/live/invoices";

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <LiveInvoices view={view} />;
}
