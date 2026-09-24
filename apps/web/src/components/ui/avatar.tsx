import { cn, initials } from "@/lib/utils";

const palette = [
  "bg-[#ece9ff] text-[#5a4bd6] dark:bg-[#231f40] dark:text-[#b1a8ff]",
  "bg-[#e3f6f3] text-[#11806f] dark:bg-[#0f2a26] dark:text-[#5fd6c3]",
  "bg-[#fdf0dc] text-[#a86a06] dark:bg-[#2c2110] dark:text-[#f2bf64]",
  "bg-[#fde7ee] text-[#bb3b62] dark:bg-[#2e1420] dark:text-[#f28cab]",
  "bg-[#e5f1fd] text-[#1668b3] dark:bg-[#0f1f30] dark:text-[#72b6f3]",
  "bg-[#eef0f2] text-[#4a4f57] dark:bg-[#1d1f23] dark:text-[#b4b8bf]",
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
    xs: "size-5 text-[9px]",
    sm: "size-6 text-[10px]",
    md: "size-8 text-xs",
    lg: "size-10 text-sm",
    xl: "size-14 text-lg",
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
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-card">
          +{names.length - max}
        </span>
      )}
    </div>
  );
}
