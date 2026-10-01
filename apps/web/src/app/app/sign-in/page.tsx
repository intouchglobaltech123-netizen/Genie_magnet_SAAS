import { Suspense } from "react";
import { SignInPage } from "@/live/auth-pages";

export default function Page() {
  return (
    <Suspense>
      <SignInPage />
    </Suspense>
  );
}
