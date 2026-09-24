import { Badge } from "@/components/ui/badge";
import type { Depth } from "@/lib/nav";
import { cn } from "@/lib/utils";

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
  return (
    <div className={cn("mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {(eyebrow || depth) && (
          <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
            {eyebrow}
            {depth === "preview" && <Badge tone="info">Preview · sample data</Badge>}
            {depth === "planned" && <Badge tone="neutral">Planned · Phase 2</Badge>}
          </div>
        )}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
