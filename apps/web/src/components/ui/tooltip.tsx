"use client";
import * as React from "react";
import * as TP from "@radix-ui/react-tooltip";

export const TooltipProvider = TP.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TP.Root delayDuration={150}>
      <TP.Trigger asChild>{children}</TP.Trigger>
      <TP.Portal>
        <TP.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-64 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground shadow-pop"
        >
          {content}
        </TP.Content>
      </TP.Portal>
    </TP.Root>
  );
}
