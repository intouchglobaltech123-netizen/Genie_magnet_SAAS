import { Suspense } from "react";
import { AgreementsList } from "@/features/crm/agreements/agreements-list";

export default function AgreementsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <AgreementsList />
    </Suspense>
  );
}
