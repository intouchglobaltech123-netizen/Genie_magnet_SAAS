"use client";

import { useParams } from "next/navigation";
import { AssistedFill } from "@/features/onboarding/fill-views";

export default function QuestionnaireFillPage() {
  const { id } = useParams<{ id: string }>();
  return <AssistedFill key={id} id={id} />;
}
