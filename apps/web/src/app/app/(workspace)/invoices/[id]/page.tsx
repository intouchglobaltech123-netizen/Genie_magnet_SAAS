import { LiveInvoice } from "@/live/invoices";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveInvoice id={id} />;
}
