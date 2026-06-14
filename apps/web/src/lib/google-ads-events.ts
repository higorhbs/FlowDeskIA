import { googleAdsConversionSendTo, hasGoogleAdsTag } from "@/lib/google-ads-config";
import { loadGoogleAdsTag } from "@/lib/google-ads-loader";

type GtagFn = (...args: unknown[]) => void;

function fireGtag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  const fn = (window as Window & { gtag?: GtagFn }).gtag;
  if (typeof fn === "function") fn(...args);
}

export async function trackGoogleAdsSignUp() {
  if (!hasGoogleAdsTag()) return;
  await loadGoogleAdsTag();
  const sendTo = googleAdsConversionSendTo();
  if (sendTo) {
    fireGtag("event", "conversion", { send_to: sendTo });
  }
  fireGtag("event", "sign_up", { method: "flowdesk" });
}
