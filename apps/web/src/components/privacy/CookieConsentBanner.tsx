"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SwetrixScripts } from "@/components/analytics/SwetrixScripts";
import { swetrixProjectId } from "@/lib/swetrix-config";

const CONSENT_KEY = "flowdesk_cookie_consent_v1";

type ConsentState = "accepted" | "rejected" | null;

export function CookieConsentBanner() {
  const hasAnalytics = useMemo(() => Boolean(swetrixProjectId), []);
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

  const showBanner = ready && hasAnalytics && consent === null;

  return (
    <>
      {consent === "accepted" && <SwetrixScripts />}
      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-gray-200 bg-white/95 p-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-700">
              Usamos cookies de medicao para melhorar o produto. Voce pode aceitar ou recusar.
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
