"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import {
  swetrixApiUrl,
  swetrixInitOptions,
  swetrixNoscriptBase,
  swetrixProjectId,
} from "@/lib/swetrix-config";

export function SwetrixScripts() {
  const started = useRef(false);

  useEffect(() => {
    if (!swetrixProjectId || started.current) return;

    const tryInit = () => {
      if (started.current || !window.swetrix) return false;
      window.swetrix.init(swetrixProjectId, swetrixInitOptions());
      void window.swetrix.trackViews();
      started.current = true;
      return true;
    };

    if (tryInit()) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      if (tryInit() || ++attempts > 60) window.clearInterval(timer);
    }, 100);

    return () => window.clearInterval(timer);
  }, []);

  if (!swetrixProjectId) return null;

  return (
    <>
      <Script id="swetrix-kit" src="/flow-kit.js" strategy="afterInteractive" />
      <noscript>
        <img
          src={`${swetrixNoscriptBase()}/noscript?pid=${encodeURIComponent(swetrixProjectId)}`}
          alt=""
          referrerPolicy="no-referrer-when-downgrade"
        />
      </noscript>
    </>
  );
}
