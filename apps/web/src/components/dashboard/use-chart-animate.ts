"use client";

import { useEffect, useMemo, useState } from "react";

type ChartPoint = { conversas: number };

export function useRevealedChartData<T extends ChartPoint>(data: T[], delayMs = 120) {
  const [revealed, setRevealed] = useState(false);
  const signature = useMemo(
    () => data.map((d) => d.conversas).join(","),
    [data]
  );

  useEffect(() => {
    setRevealed(false);
    const t = window.setTimeout(() => setRevealed(true), delayMs);
    return () => window.clearTimeout(t);
  }, [signature, delayMs]);

  const zeroed = useMemo(
    () => data.map((d) => ({ ...d, conversas: 0 })),
    [data]
  );

  return { displayData: revealed ? data : zeroed, revealed };
}

export const chartMotion = {
  duration: 1000,
  easing: "ease-out" as const,
  begin: 0,
};
