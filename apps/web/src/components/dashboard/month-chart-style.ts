export const monthChartStyle = {
  curve: "monotone" as const,
  stroke: "var(--color-conversas)",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fillGradient: {
    topOpacity: 0.4,
    bottomOpacity: 0.03,
  },
  dot: false as const,
  activeDot: {
    r: 4,
    stroke: "hsl(var(--background))",
    strokeWidth: 2,
  },
  tooltipCursor: {
    stroke: "var(--color-conversas)",
    strokeWidth: 1,
    strokeDasharray: "4 4",
  },
};

export type MonthChartCurve =
  | "monotone"
  | "natural"
  | "linear"
  | "step"
  | "stepBefore"
  | "stepAfter"
  | "basis"
  | "bump"
  | "linearClosed";
