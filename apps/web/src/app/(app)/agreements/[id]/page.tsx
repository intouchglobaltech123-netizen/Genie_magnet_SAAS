"use client";

import { useParams } from "next/navigation";
import { AgreementDetail } from "@/features/crm/agreements/agreement-detail";

export default function AgreementDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <AgreementDetail id={id} />;
}
