"use client";

import { useParams } from "next/navigation";
import { ShootSheet } from "@/features/production/shoots/shoot-sheet";

export default function ShootSheetPage() {
  const { id } = useParams<{ id: string }>();
  return <ShootSheet key={id} id={id} />;
}
