import { LiveOnboardingFill } from "@/live/onboarding";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveOnboardingFill id={id} />;
}
