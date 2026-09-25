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
  id,
  "aria-label": ariaLabel,
  disabled,
}: {
  value?: string;
  onValueChange?: (v: string) => void;
  options: { value: string; label: React.ReactNode }[];
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
  disabled?: boolean;
}) {
  return (
    <SP.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SP.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "flex h-9 w-full min-w-0 cursor-pointer items-center justify-between gap-2 whitespace-nowrap rounded-lg border border-input bg-surface px-3 text-body transition-colors hover:border-secondary/40 focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 data-[placeholder]:text-muted-foreground",
          className,
        )}
      >
        <span className="min-w-0 truncate text-left">
          <SP.Value placeholder={placeholder} />
        </span>
        <SP.Icon>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
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
                className="relative flex cursor-pointer select-none items-center rounded-lg py-1.5 pl-8 pr-3 text-body outline-none data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary"
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
