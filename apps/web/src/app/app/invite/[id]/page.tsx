import { InvitePage } from "@/live/auth-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvitePage id={id} />;
}
