import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Data table primitives. Tables are flat (no per-row cards): light surface, subtle separators,
 * sticky header inside scrollable containers, right-aligned numbers via `numeric`.
 */
export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="scrollbar-thin relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom border-collapse text-body", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-[1] bg-surface-secondary [&_tr]:border-b [&_tr]:border-border [&_tr:hover]:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-border-subtle transition-colors hover:bg-primary-soft/40", className)} {...props} />;
}

export function TH({
  className,
  numeric,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        "h-10 whitespace-nowrap px-3 text-left align-middle text-body font-medium text-text-muted",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, numeric, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn("px-3 py-2.5 align-middle text-text-primary", numeric && "text-right tabular", className)} {...props} />;
}

/** Sortable header cell with a direction indicator. */
export function SortableTH({
  children,
  direction,
  onSort,
  numeric,
  className,
}: {
  children: React.ReactNode;
  direction?: "asc" | "desc" | null;
  onSort: () => void;
  numeric?: boolean;
  className?: string;
}) {
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <TH numeric={numeric} className={className} aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}>
      <button
        onClick={onSort}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          direction && "text-primary",
        )}
      >
        {children}
        <Icon className="size-3.5 opacity-70" />
      </button>
    </TH>
  );
}

/** Compact pagination footer for tables. */
export function TablePagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const btn =
    "inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md border border-border px-2 text-body transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-3 py-2.5 text-body text-muted-foreground">
      <span className="tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          ‹
        </button>
        <span className="px-2 tabular text-text-secondary">
          {page} / {pages}
        </span>
        <button className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          ›
        </button>
      </div>
    </div>
  );
}
