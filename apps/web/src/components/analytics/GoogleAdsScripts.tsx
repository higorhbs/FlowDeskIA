"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isMarketingRoute } from "@/lib/analytics-surface";
import { hasGoogleAdsTag } from "@/lib/google-ads-config";
import { grantGoogleAdsConsent, loadGoogleAdsTag } from "@/lib/google-ads-loader";

export function GoogleAdsScripts() {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    if (!hasGoogleAdsTag() || !isMarketingRoute(pathname)) return;
    void loadGoogleAdsTag().then(() => grantGoogleAdsConsent());
  }, [pathname]);

  return null;
}
