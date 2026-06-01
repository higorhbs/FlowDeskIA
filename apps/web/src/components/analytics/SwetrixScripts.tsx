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
      <script src="/flow-kit.js" defer />
      <script
        dangerouslySetInnerHTML={{
          __html: `document.addEventListener("DOMContentLoaded",function(){if(!window.swetrix)return;window.swetrix.init(${projectIdJson},${initOptions});window.swetrix.trackViews();});`,
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
