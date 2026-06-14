"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GoogleAdsScripts } from "@/components/analytics/GoogleAdsScripts";
import { SwetrixScripts } from "@/components/analytics/SwetrixScripts";
import { MetaPixelScripts } from "@/components/analytics/MetaPixelScripts";
import { isMarketingRoute } from "@/lib/analytics-surface";
import { hasGoogleAdsTag } from "@/lib/google-ads-config";
import { denyGoogleAdsConsent } from "@/lib/google-ads-loader";
import { hasMetaPixel } from "@/lib/meta-pixel-config";
import { hasSwetrix } from "@/lib/swetrix-config";

const CONSENT_KEY = "flowdesk_cookie_consent_v1";

type ConsentState = "accepted" | "rejected" | null;

export function CookieConsentBanner() {
  const pathname = usePathname() ?? "/";
  const marketing = isMarketingRoute(pathname);
  const hasAnalytics = useMemo(
    () => hasSwetrix() || hasGoogleAdsTag() || hasMetaPixel(),
    [],
  );
  const [consent, setConsent] = useState<ConsentState>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasAnalytics) {
      setReady(true);
      return;
    }
    const saved = window.localStorage.getItem(CONSENT_KEY);
    if (saved === "accepted" || saved === "rejected") {
      setConsent(saved);
    }
    setReady(true);
  }, [hasAnalytics]);

  useEffect(() => {
    if (!ready || !hasGoogleAdsTag() || consent !== "rejected") return;
    denyGoogleAdsConsent();
  }, [consent, ready]);

  const showBanner = ready && hasAnalytics && marketing && consent === null;
  const loadAnalytics = consent === "accepted" && marketing;

  return (
    <>
      {loadAnalytics && (
        <>
          <GoogleAdsScripts />
          <SwetrixScripts />
          <MetaPixelScripts />
        </>
      )}
      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-gray-200 bg-white/95 p-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-700">
              Usamos conversao (Google Ads) e Meta Pixel para melhorar o
              produto. Aceite para registrar visitas e campanhas.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  window.localStorage.setItem(CONSENT_KEY, "rejected");
                  setConsent("rejected");
                }}
              >
                Recusar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  window.localStorage.setItem(CONSENT_KEY, "accepted");
                  setConsent("accepted");
                }}
              >
                Aceitar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
