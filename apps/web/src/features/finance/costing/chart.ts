import type { CSSProperties } from "react";

export const tooltipStyle: { contentStyle: CSSProperties; labelStyle: CSSProperties; itemStyle: CSSProperties } = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    boxShadow: "var(--shadow-md)",
    fontSize: 13,
    padding: "8px 10px",
  },
  labelStyle: { color: "var(--color-text-muted)", marginBottom: 4, fontWeight: 500 },
  itemStyle: { color: "var(--color-text-primary)", padding: 0 },
};

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--color-text-muted)", fontSize: 12 },
} as const;
