"use client";
import * as React from "react";
import * as PP from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PP.Root;
export const PopoverTrigger = PP.Trigger;

export function PopoverContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof PP.Content>) {
  return (
    <PP.Portal>
      <PP.Content
        sideOffset={sideOffset}
        className={cn("z-50 w-72 rounded-xl border border-border bg-popover p-3 shadow-pop outline-none", className)}
        {...props}
      />
    </PP.Portal>
  );
}

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return <div className={cn(vertical ? "w-px self-stretch bg-border" : "h-px w-full bg-border", className)} />;
}
