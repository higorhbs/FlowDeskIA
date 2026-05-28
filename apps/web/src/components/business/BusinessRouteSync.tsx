"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useBusinessId } from "@/lib/use-business-id";
import { fixPlaceholderBusinessPath } from "@/lib/business-route";

export function BusinessRouteSync() {
  const pathname = usePathname() ?? "";
  const businessId = useBusinessId({ required: false });

  useEffect(() => {
    if (!businessId) return;
    const fixed = fixPlaceholderBusinessPath(window.location.pathname, businessId);
    if (!fixed || fixed === window.location.pathname) return;
    window.history.replaceState(null, "", `${fixed}${window.location.search}${window.location.hash}`);
  }, [businessId, pathname]);

  return null;
}
