import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Depth } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** A page's explanation longer than this sits behind an ⓘ next to the title, so the page opens on its work. */
const SHORT = 100;

function AboutThisPage({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="About this page"
          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 data-[state=open]:bg-muted data-[state=open]:text-primary print:hidden"
        >
          <Info className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-body text-text-secondary">
        {text}
      </PopoverContent>
    </Popover>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  depth,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  depth?: Depth;
  actions?: React.ReactNode;
  className?: string;
}) {
  const long = typeof description === "string" && description.length > SHORT;
  return (
    <div className={cn("mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {(eyebrow || depth) && (
          <div className="mb-2 flex items-center gap-2 text-body font-medium text-muted-foreground">
            {eyebrow}
            {depth === "preview" && <Badge tone="info">Preview · sample data</Badge>}
            {depth === "planned" && <Badge tone="neutral">Planned · later phase</Badge>}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <h1 className="text-heading font-semibold text-text-primary">{title}</h1>
          {long && <AboutThisPage text={description} />}
        </div>
        {description && !long && <p className="mt-1 max-w-3xl text-body text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
