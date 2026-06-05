"use client";

import { useEffect, useState } from "react";

export function useStableBoolean(
  value: boolean,
  falseDelayMs = 1800,
  immediateFalse = false,
): boolean {
  const [stable, setStable] = useState(value);

  useEffect(() => {
    if (value) {
      setStable(true);
      return;
    }
    if (immediateFalse) {
      setStable(false);
      return;
    }
    const t = setTimeout(() => setStable(false), falseDelayMs);
    return () => clearTimeout(t);
  }, [value, falseDelayMs, immediateFalse]);

  return stable;
}
