"use client";
import * as React from "react";
import * as SP from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
}: {
  value?: string;
  onValueChange?: (v: string) => void;
  options: { value: string; label: React.ReactNode }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <SP.Root value={value} onValueChange={onValueChange}>
      <SP.Trigger
        className={cn(
          "flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 data-[placeholder]:text-muted-foreground",
          className,
        )}
      >
        <SP.Value placeholder={placeholder} />
        <SP.Icon>
          <ChevronDown className="size-4 opacity-60" />
        </SP.Icon>
      </SP.Trigger>
      <SP.Portal>
        <SP.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-pop"
        >
          <SP.Viewport>
            {options.map((o) => (
              <SP.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer select-none items-center rounded-lg py-1.5 pl-8 pr-3 text-body outline-none data-[highlighted]:bg-muted"
              >
                <SP.ItemIndicator className="absolute left-2.5">
                  <Check className="size-3.5" />
                </SP.ItemIndicator>
                <SP.ItemText>{o.label}</SP.ItemText>
              </SP.Item>
            ))}
          </SP.Viewport>
        </SP.Content>
      </SP.Portal>
    </SP.Root>
  );
}
