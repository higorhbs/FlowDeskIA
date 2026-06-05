"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { captureAdAttribution, readAdVisitor } from "@/lib/ad-attribution";

export function useAdLanding() {
  const pathname = usePathname() ?? "/";
  const [adMode, setAdMode] = useState(() => readAdVisitor(pathname));

  useEffect(() => {
    captureAdAttribution(window.location.search, pathname);
    setAdMode(readAdVisitor(pathname));
  }, [pathname]);

  return adMode;
}
