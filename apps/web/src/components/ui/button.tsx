import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * One button system for the whole product.
 * primary   – Royal Blue, the single main action on a surface (`default` and legacy `accent` alias it)
 * secondary – light surface, Royal text, subtle border (`outline` aliases it)
 * ghost     – tertiary / text action
 * soft      – Sapphire tint for supporting actions
 * danger    – destructive only
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-body font-medium transition-colors cursor-pointer select-none disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-1 focus-visible:ring-offset-background [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-secondary active:bg-primary-active",
        accent: "bg-primary text-primary-foreground shadow-sm hover:bg-secondary active:bg-primary-active",
        secondary: "border border-border-strong bg-surface text-primary hover:border-secondary/40 hover:bg-secondary-soft",
        outline: "border border-border-strong bg-surface text-primary hover:border-secondary/40 hover:bg-secondary-soft",
        ghost: "text-text-secondary hover:bg-muted hover:text-primary",
        soft: "bg-secondary-soft text-secondary hover:bg-secondary hover:text-secondary-foreground",
        danger: "bg-danger text-danger-foreground shadow-sm hover:bg-danger/90",
        success: "bg-success text-success-foreground shadow-sm hover:bg-success/90",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3",
        xs: "h-7 px-2.5 rounded-md",
        lg: "h-10 px-5",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
