"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/** Modal (centered) or drawer (`side="right"`). Both share header/body/footer spacing. */
export function DialogContent({
  className,
  children,
  side,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "center" | "right" }) {
  const isSheet = side === "right";
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-primary/35 backdrop-blur-[1.5px]" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          "fixed z-50 border border-border bg-popover text-card-foreground shadow-lg focus:outline-none",
          isSheet
            ? "scrollbar-thin right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-y-0 border-r-0"
            : "scrollbar-thin left-1/2 top-1/2 max-h-[88vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute right-4 top-4 cursor-pointer rounded-md p-1 text-text-muted transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1 p-6 pb-4 pr-12", className)} {...props} />;
}
export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pb-5", className)} {...props} />;
}
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border-subtle bg-surface-secondary px-6 py-3.5",
        className,
      )}
      {...props}
    />
  );
}
export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-subheading font-semibold text-text-primary", className)} {...props} />;
}
export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-body text-muted-foreground", className)} {...props} />;
}
