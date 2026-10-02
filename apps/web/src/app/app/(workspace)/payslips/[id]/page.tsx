import { LivePayslip } from "@/live/payroll";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LivePayslip id={id} />;
}
