import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-lg border border-input bg-surface text-body text-text-primary placeholder:text-text-muted/70 transition-colors hover:border-secondary/40 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:text-text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/15 read-only:bg-surface-secondary";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldBase, "flex h-9 px-3", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, "flex min-h-20 px-3 py-2", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-body font-medium text-text-secondary", className)} {...props} />;
}

/** Label + control + helper/error text. Every form field in the product uses this layout. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p className="text-body text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-body text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Groups related fields in long forms under a clear section heading. */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4 border-t border-border-subtle pt-5 first:border-t-0 first:pt-0", className)}>
      <div>
        <h4 className="text-body font-semibold text-text-primary">{title}</h4>
        {description && <p className="text-body text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
