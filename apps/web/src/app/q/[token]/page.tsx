"use client";

import { useParams } from "next/navigation";
import { PublicQuestionnaire } from "@/features/onboarding/fill-views";

export default function PublicQuestionnairePage() {
  const { token } = useParams<{ token: string }>();
  return <PublicQuestionnaire key={token} token={token} />;
}
