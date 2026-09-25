"use client";

import { useParams } from "next/navigation";
import { SessionView } from "@/features/round-table/session-view";

export default function RoundTableSessionPage() {
  const params = useParams<{ id: string }>();
  return <SessionView id={params.id} />;
}
