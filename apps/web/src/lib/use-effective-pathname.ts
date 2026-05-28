"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function useEffectivePathname(): string {
  const nextPath = usePathname() ?? "";
  const [path, setPath] = useState(nextPath);

  useEffect(() => {
    setPath(window.location.pathname || nextPath);
  }, [nextPath]);

  return path;
}
