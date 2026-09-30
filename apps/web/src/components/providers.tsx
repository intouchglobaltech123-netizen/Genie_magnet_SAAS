"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDemo } from "@/lib/store";
import { useRT } from "@/features/round-table/store";
import { useOnboarding } from "@/features/onboarding/store";
import { useContent } from "@/features/content/store";
import { useGenie } from "@/features/genie/store";
import { useIntegrations } from "@/features/integrations/platforms";
import { FeedbackButton } from "@/features/feedback/feedback-button";
import { WelcomeDialog } from "@/features/feedback/welcome-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useDemo.persist.rehydrate();
    useRT.persist.rehydrate();
    useOnboarding.persist.rehydrate();
    useContent.persist.rehydrate();
    useGenie.persist.rehydrate();
    useIntegrations.persist.rehydrate();
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
