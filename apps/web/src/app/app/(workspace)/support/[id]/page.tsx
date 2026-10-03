import { LiveSupportTicket } from "@/live/support-inbox";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveSupportTicket id={id} />;
}
