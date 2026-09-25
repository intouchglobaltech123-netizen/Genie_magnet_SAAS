import { cn, initials } from "@/lib/utils";

// Brand-derived tints only: Royal, Sapphire, Quicksand, Shellstone and two quiet support hues.
const palette = [
  "bg-primary-soft text-primary",
  "bg-secondary-soft text-secondary",
  "bg-accent-soft text-accent-strong",
  "bg-muted text-text-secondary",
  "bg-success-soft text-success",
  "bg-info-soft text-info",
];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const s = {
    xs: "size-5 text-body",
    sm: "size-6 text-body",
    md: "size-8 text-body",
    lg: "size-10 text-body",
    xl: "size-14 text-subheading",
  }[size];
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-card",
        s,
        palette[hash(name) % palette.length],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4, size = "sm" }: { names: string[]; max?: number; size?: "xs" | "sm" | "md" }) {
  const shown = names.slice(0, max);
  return (
    <div className="flex -space-x-1.5">
      {shown.map((n) => (
        <Avatar key={n} name={n} size={size} />
      ))}
      {names.length > max && (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-body font-medium ring-2 ring-card">
          +{names.length - max}
        </span>
      )}
    </div>
  );
}
