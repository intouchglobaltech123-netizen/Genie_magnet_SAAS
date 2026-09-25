import { cn } from "@/lib/utils";

/** Agency OS mark: a Royal tile with a single Quicksand spark — used in the sidebar, login and portal. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-accent/45 bg-primary-active",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none">
        <path
          d="M12 3.5l1.9 5.1a2 2 0 0 0 1.2 1.2l5.1 1.9-5.1 1.9a2 2 0 0 0-1.2 1.2L12 20.5l-1.9-5.7a2 2 0 0 0-1.2-1.2L3.8 11.7l5.1-1.9a2 2 0 0 0 1.2-1.2L12 3.5z"
          fill="var(--color-accent)"
        />
      </svg>
    </span>
  );
}

export function BrandWordmark({ inverted, sub = "Genie Magnet" }: { inverted?: boolean; sub?: string }) {
  return (
    <div className="min-w-0 leading-tight">
      <div className={cn("text-subheading font-semibold tracking-tight", inverted ? "text-white" : "text-primary")}>Agency OS</div>
      <div className={cn("truncate text-body", inverted ? "text-sidebar-muted" : "text-muted-foreground")}>{sub}</div>
    </div>
  );
}
