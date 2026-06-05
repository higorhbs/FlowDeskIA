"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sanitizeHostingPath } from "@/lib/app-navigation";
import { hostingHref, isFirebaseHostingClient } from "@/lib/hosting-href";
import { normalizeHostingBusinessPath } from "@/lib/business-route";

export function HostingRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !isFirebaseHostingClient()) return;

    if (pathname.includes("$") || window.location.pathname.includes("$")) {
      window.location.replace(hostingHref("/dashboard"));
      return;
    }

    const txtFix = sanitizeHostingPath(pathname);
    if (txtFix) {
      window.location.replace(
        `${hostingHref(txtFix)}${window.location.search}${window.location.hash}`
      );
      return;
    }

    const path = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;
    const panelFix = normalizeHostingBusinessPath(path);
    if (panelFix) {
      window.location.replace(`${hostingHref(panelFix)}${search}${hash}`);
      return;
    }

    const current = `${path}${search}${hash}`;
    const canonical = hostingHref(current);
    if (canonical !== current) {
      window.location.replace(canonical);
    }
  }, [pathname]);

  return <>{children}</>;
}
