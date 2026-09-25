import { FileX2 } from "lucide-react";
import type { Expense } from "@/lib/mock/finance";
import { cn, fmtDate, inr, inrCompact } from "@/lib/utils";
import { CATEGORY_STYLE } from "./store";

// Torn-paper bottom edge using a CSS mask (no external images).
const tornEdge: React.CSSProperties = {
  WebkitMaskImage: "linear-gradient(#000 0 0), radial-gradient(circle at 50% 100%, transparent 3px, #000 3.5px)",
  WebkitMaskSize: "100% calc(100% - 4px), 8px 4px",
  WebkitMaskPosition: "top, bottom",
  WebkitMaskRepeat: "no-repeat, repeat-x",
  maskImage: "linear-gradient(#000 0 0), radial-gradient(circle at 50% 100%, transparent 3px, #000 3.5px)",
  maskSize: "100% calc(100% - 4px), 8px 4px",
  maskPosition: "top, bottom",
  maskRepeat: "no-repeat, repeat-x",
};

export function ReceiptTile({ expense, className }: { expense: Pick<Expense, "vendor" | "amount" | "category" | "receipt">; className?: string }) {
  const style = CATEGORY_STYLE[expense.category] ?? CATEGORY_STYLE.Utilities!;
  if (!expense.receipt) {
    return (
      <div className={cn("flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-danger/50 bg-danger-soft text-danger", className)}>
        <FileX2 className="size-4" />
        <span className="text-center text-body font-semibold leading-4">No bill</span>
      </div>
    );
  }
  return (
    <div className={cn("relative h-16 w-14 shrink-0 drop-shadow-sm", className)}>
      <div style={tornEdge} className="flex h-full w-full flex-col overflow-hidden rounded-t-lg border border-border bg-gradient-to-b from-card to-muted">
        <div className={cn("h-1 w-full", style.strip)} />
        <div className="flex min-w-0 flex-1 flex-col items-center px-0.5 pt-1">
          <span className={cn("inline-flex size-5 items-center justify-center rounded-full text-body font-semibold leading-none", style.soft, style.text)}>
            {expense.vendor.charAt(0).toUpperCase()}
          </span>
          <span className="mt-1 h-px w-6 bg-border" />
          <span className="mt-0.5 h-px w-4 bg-border" />
          <span className="mt-auto max-w-full truncate pb-1 text-body font-semibold leading-4 tabular text-foreground" title={inr(expense.amount)}>
            {inrCompact(expense.amount)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ReceiptPreview({ expense }: { expense: Expense }) {
  const style = CATEGORY_STYLE[expense.category] ?? CATEGORY_STYLE.Utilities!;
  if (!expense.receipt) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-danger/40 bg-danger-soft text-danger">
        <FileX2 className="size-7" />
        <div className="text-body font-medium">Receipt not uploaded</div>
        <div className="text-body text-muted-foreground">Requester has been reminded on WhatsApp</div>
      </div>
    );
  }
  const taxable = expense.amount - expense.gst;
  const billNo = `${expense.vendor.replace(/[^A-Z]/g, "").slice(0, 3) || "INV"}/${expense.code.slice(-3)}${expense.date.slice(8, 10)}`;
  return (
    <div className="flex justify-center rounded-xl bg-surface-secondary p-5">
      <div style={tornEdge} className="w-64 bg-gradient-to-b from-card to-card/90 pb-5 font-mono text-body text-foreground shadow-card ring-1 ring-border">
        <div className={cn("h-1.5 w-full", style.strip)} />
        <div className="px-4 pt-3 text-center">
          <div className="text-body font-semibold uppercase tracking-wide">{expense.vendor}</div>
          <div className="text-body text-muted-foreground">Tax invoice · {fmtDate(expense.date, { day: "2-digit", month: "short", year: "numeric" })}</div>
          <div className="text-body text-muted-foreground">Bill no. {billNo}</div>
        </div>
        <div className="mx-4 my-2 border-t border-dashed border-border" />
        <div className="space-y-1 px-4">
          <div className="flex justify-between gap-2">
            <span className="line-clamp-2">{expense.description}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Taxable</span>
            <span className="tabular">{inr(taxable)}</span>
          </div>
          {expense.gst > 0 && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>CGST</span>
                <span className="tabular">{inr(expense.gst / 2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>SGST</span>
                <span className="tabular">{inr(expense.gst - Math.round(expense.gst / 2))}</span>
              </div>
            </>
          )}
        </div>
        <div className="mx-4 my-2 border-t border-dashed border-border" />
        <div className="flex justify-between px-4 text-body font-semibold">
          <span>TOTAL</span>
          <span className="tabular">{inr(expense.amount)}</span>
        </div>
        <div className="mt-2 px-4 text-center text-body text-muted-foreground">Paid by {expense.mode} · Thank you!</div>
        <div className="mx-auto mt-2 flex h-6 w-40 gap-[2px]">
          {Array.from({ length: 34 }).map((_, i) => (
            <span key={i} className="h-full bg-foreground/80" style={{ width: (i * 7) % 3 === 0 ? 2 : 1 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
