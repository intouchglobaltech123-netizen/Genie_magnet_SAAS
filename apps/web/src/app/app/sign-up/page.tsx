import { Suspense } from "react";
import { SignUpPage } from "@/live/auth-pages";

export default function Page() {
  return (
    <Suspense>
      <SignUpPage />
    </Suspense>
  );
}
