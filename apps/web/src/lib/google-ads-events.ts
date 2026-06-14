import {
  googleAdsConversionSendTo,
  googleAdsId,
  hasGoogleAdsTag,
} from "@/lib/google-ads-config";

type GtagFn = (...args: unknown[]) => void;

function fireGtag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  const fn = (window as Window & { gtag?: GtagFn }).gtag;
  if (typeof fn === "function") fn(...args);
}

let googleAdsConfigured = false;

export function configureGoogleAdsTag() {
  if (!hasGoogleAdsTag() || googleAdsConfigured) return;
  googleAdsConfigured = true;
  fireGtag("config", googleAdsId, { cookie_domain: "auto" });
}

export function trackGoogleAdsSignUp() {
  if (!hasGoogleAdsTag()) return;
  configureGoogleAdsTag();
  const sendTo = googleAdsConversionSendTo();
  if (sendTo) {
    fireGtag("event", "conversion", { send_to: sendTo });
  }
  fireGtag("event", "sign_up", { method: "flowdesk" });
}
