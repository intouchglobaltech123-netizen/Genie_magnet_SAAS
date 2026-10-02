import type { Metadata } from "next";
import { PublicQuestionnaire } from "@/live/public-questionnaire";

export const metadata: Metadata = { title: "Onboarding questionnaire", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicQuestionnaire token={token} />;
}
