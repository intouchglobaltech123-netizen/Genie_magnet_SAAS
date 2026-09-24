"use client";

import { useParams } from "next/navigation";
import { PlannedView } from "@/features/platform/planned-view";

export default function PlannedModulePage() {
  const { slug } = useParams<{ slug: string }>();
  return <PlannedView key={slug} slug={slug} />;
}
