import { Suspense } from "react";
import { LiveSales } from "@/live/sales";

export default function Page() {
  return (
    <Suspense>
      <LiveSales />
    </Suspense>
  );
}
