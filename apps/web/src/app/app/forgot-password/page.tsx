import { Suspense } from "react";
import { ForgotPasswordPage } from "@/live/auth-pages";

export default function Page() {
  return (
    <Suspense>
      <ForgotPasswordPage />
    </Suspense>
  );
}
