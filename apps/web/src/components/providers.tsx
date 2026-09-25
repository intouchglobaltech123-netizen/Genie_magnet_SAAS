"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDemo } from "@/lib/store";
import { useRT } from "@/features/round-table/store";
import { FeedbackButton } from "@/features/feedback/feedback-button";
import { WelcomeDialog } from "@/features/feedback/welcome-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useDemo.persist.rehydrate();
    useRT.persist.rehydrate();
  }, []);

  return (
    <TooltipProvider>
      {children}
      <FeedbackButton />
      <WelcomeDialog />
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "!rounded-xl !border !border-border !bg-popover !text-foreground !shadow-pop",
        }}
      />
    </TooltipProvider>
  );
}
