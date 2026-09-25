import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { AgreementsList } from "@/features/crm/agreements/agreements-list";

export default function AgreementsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <AgreementsList />
    </Suspense>
  );
}
