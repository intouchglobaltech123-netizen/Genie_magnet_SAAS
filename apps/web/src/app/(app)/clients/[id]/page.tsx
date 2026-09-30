"use client";

import { useParams } from "next/navigation";
import { ClientPage } from "@/features/clients/client-page";

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  return <ClientPage key={id} id={id} />;
}
