import type { CSSProperties } from "react";

export const tooltipStyle: { contentStyle: CSSProperties; labelStyle: CSSProperties; itemStyle: CSSProperties } = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    boxShadow: "0 8px 24px -8px rgba(0,0,0,0.18)",
    fontSize: 12,
    padding: "8px 10px",
  },
  labelStyle: { color: "var(--color-muted-foreground)", marginBottom: 4, fontWeight: 500 },
  itemStyle: { color: "var(--color-foreground)", padding: 0 },
};

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--color-muted-foreground)", fontSize: 11 },
} as const;
