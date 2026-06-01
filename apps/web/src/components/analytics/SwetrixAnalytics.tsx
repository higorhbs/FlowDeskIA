"use client";

import Script from "next/script";

const projectId = process.env.NEXT_PUBLIC_SWETRIX_PROJECT_ID?.trim();
const apiURL = process.env.NEXT_PUBLIC_SWETRIX_API_URL?.trim();

function initSwetrix() {
  if (!projectId || !window.swetrix) return;

  const options: SwetrixInitOptions = {};
  if (apiURL) options.apiURL = apiURL;
  if (process.env.NODE_ENV === "development") options.devMode = true;

  window.swetrix.init(projectId, options);
  void window.swetrix.trackViews();
}

export function SwetrixAnalytics() {
  if (!projectId) return null;

  const noscriptBase = (apiURL || "https://api.swetrix.com/log").replace(/\/$/, "");

  return (
    <>
      <Script
        src="https://swetrix.org/swetrix.js"
        strategy="afterInteractive"
        onLoad={initSwetrix}
      />
      <noscript>
        <img
          src={`${noscriptBase}/noscript?pid=${encodeURIComponent(projectId)}`}
          alt=""
          referrerPolicy="no-referrer-when-downgrade"
        />
      </noscript>
    </>
  );
}
