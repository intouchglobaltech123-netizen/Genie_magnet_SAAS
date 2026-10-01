import { Suspense } from "react";
import { LiveImport } from "@/live/import";

export default function Page() {
  return (
    <Suspense>
      <LiveImport />
    </Suspense>
  );
}
