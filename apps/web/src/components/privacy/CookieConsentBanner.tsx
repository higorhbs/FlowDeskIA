"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SwetrixScripts } from "@/components/analytics/SwetrixScripts";
import { MetaPixelScripts } from "@/components/analytics/MetaPixelScripts";
import { hasGoogleAdsTag } from "@/lib/google-ads-config";
import { hasMetaPixel } from "@/lib/meta-pixel-config";
import { hasSwetrix } from "@/lib/swetrix-config";

const CONSENT_KEY = "flowdesk_cookie_consent_v1";

type ConsentState = "accepted" | "rejected" | null;

function grantGoogleAdsConsent() {
  if (!hasGoogleAdsTag()) return;
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (!gtag) return;
  gtag("consent", "update", {
    ad_storage: "granted",
    analytics_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });
}

function denyGoogleAdsConsent() {
  if (!hasGoogleAdsTag()) return;
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (!gtag) return;
  gtag("consent", "update", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

export function CookieConsentBanner() {
  const hasAnalytics = useMemo(() => hasSwetrix() || hasGoogleAdsTag() || hasMetaPixel(), []);
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
    if (!ready || !hasGoogleAdsTag()) return;
    if (consent === "accepted") grantGoogleAdsConsent();
    else if (consent === "rejected") denyGoogleAdsConsent();
  }, [consent, ready]);

  const showBanner = ready && hasAnalytics && consent === null;

  return (
    <>
      {consent === "accepted" && (
        <>
          <SwetrixScripts />
          <MetaPixelScripts />
        </>
      )}
      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-gray-200 bg-white/95 p-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-700">
              Usamos cookies de medicao (Swetrix), conversao (Google Ads) e Meta Pixel para melhorar o produto.
              Aceite para registrar visitas e campanhas.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  window.localStorage.setItem(CONSENT_KEY, "rejected");
                  denyGoogleAdsConsent();
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
                  grantGoogleAdsConsent();
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
