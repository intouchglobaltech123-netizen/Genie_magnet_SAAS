import type { CSSProperties } from "react";

export const tooltipStyle: { contentStyle: CSSProperties; labelStyle: CSSProperties; itemStyle: CSSProperties; cursor: { fill: string } } = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    boxShadow: "0 8px 24px -8px rgba(0,0,0,0.18)",
    fontSize: 12,
    padding: "8px 10px",
  },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 4, fontWeight: 500 },
  itemStyle: { color: "var(--foreground)", padding: 0 },
  cursor: { fill: "var(--muted)" },
};

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
} as const;
