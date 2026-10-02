import type { Metadata } from "next";
import { ClientPortal } from "@/live/client-portal";

export const metadata: Metadata = { title: "Your portal", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClientPortal token={token} />;
}
