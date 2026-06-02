import Script from "next/script";
import { googleAdsId } from "@/lib/google-ads-config";

export function GoogleAdsTag() {
  if (!googleAdsId) return null;

  const idJson = JSON.stringify(googleAdsId);

  return (
    <>
      <Script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAdsId)}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-ads-gtag"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('consent', 'default', {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500
});
gtag('config', ${idJson});
`,
        }}
      />
    </>
  );
}
