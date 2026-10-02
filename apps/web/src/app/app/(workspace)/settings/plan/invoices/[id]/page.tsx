import { LivePlanInvoice } from "@/live/plan-invoice";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LivePlanInvoice id={id} />;
}
