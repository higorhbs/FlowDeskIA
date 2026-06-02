import Script from "next/script";
import {
  swetrixInitOptionsJson,
  swetrixNoscriptBase,
  swetrixProjectId,
} from "@/lib/swetrix-config";

export function SwetrixScripts() {
  if (!swetrixProjectId) return null;

  const initOptions = swetrixInitOptionsJson();
  const projectIdJson = JSON.stringify(swetrixProjectId);

  return (
    <>
      <Script id="swetrix-kit" src="/flow-kit.js" strategy="afterInteractive" />
      <Script
        id="swetrix-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `if(window.swetrix){window.swetrix.init(${projectIdJson},${initOptions});window.swetrix.trackViews();}`,
        }}
      />
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
