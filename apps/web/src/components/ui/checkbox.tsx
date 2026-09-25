"use client";
import * as React from "react";
import * as CB from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CB.Root>) {
  return (
    <CB.Root
      className={cn(
        "peer size-[18px] shrink-0 cursor-pointer rounded-[5px] border border-input bg-card transition data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CB.Indicator className="flex items-center justify-center">
        <Check className="size-3.5" strokeWidth={3} />
      </CB.Indicator>
    </CB.Root>
  );
}
