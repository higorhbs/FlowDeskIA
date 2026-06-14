import { googleAdsId, hasGoogleAdsTag } from "@/lib/google-ads-config";

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

let loadPromise: Promise<void> | null = null;

function injectScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Ads script blocked"));
    document.head.appendChild(script);
  });
}

export function isGoogleAdsLoaded() {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

export function loadGoogleAdsTag() {
  if (typeof window === "undefined" || !hasGoogleAdsTag()) {
    return Promise.resolve();
  }
  if (isGoogleAdsLoaded()) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
    window.gtag("consent", "default", {
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
    window.gtag("js", new Date());
    window.gtag("config", googleAdsId, { send_page_view: false });

    const src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAdsId)}`;
    try {
      await injectScript(src);
    } catch {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export function grantGoogleAdsConsent() {
  if (!isGoogleAdsLoaded()) return;
  window.gtag?.("consent", "update", {
    ad_storage: "granted",
    analytics_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });
}

export function denyGoogleAdsConsent() {
  if (!isGoogleAdsLoaded()) return;
  window.gtag?.("consent", "update", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}
