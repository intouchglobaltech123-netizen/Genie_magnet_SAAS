"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDemo } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useDemo.persist.rehydrate();
  }, []);

  return (
    <TooltipProvider>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "!rounded-xl !border !border-border !bg-popover !text-foreground !shadow-pop",
        }}
      />
    </TooltipProvider>
  );
}
