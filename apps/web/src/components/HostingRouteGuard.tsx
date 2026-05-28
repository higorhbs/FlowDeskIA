"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sanitizeHostingPath } from "@/lib/app-navigation";

export function HostingRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const target = sanitizeHostingPath(pathname);
    if (target) window.location.replace(target);
  }, [pathname]);

  return <>{children}</>;
}
