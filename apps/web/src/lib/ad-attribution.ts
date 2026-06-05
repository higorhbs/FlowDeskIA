export const AD_VISITOR_KEY = "flowdesk_ad_visitor";
export const AD_UTM_KEY = "flowdesk_ad_utms";

export type AdUtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
};

export function isAdClickParams(params: URLSearchParams) {
  if (params.has("gclid") || params.has("gbraid") || params.has("wbraid")) return true;
  const src = params.get("utm_source")?.toLowerCase() ?? "";
  const med = params.get("utm_medium")?.toLowerCase() ?? "";
  if (src.includes("google") && (med === "cpc" || med === "ppc" || med === "paid")) return true;
  return false;
}

export function isAdLandingPath(pathname: string) {
  return pathname.replace(/\/$/, "") === "/landing";
}

export function pickUtmParams(params: URLSearchParams): AdUtmParams {
  const out: AdUtmParams = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid",
  ] as const) {
    const v = params.get(key);
    if (v) out[key] = v;
  }
  return out;
}

export function captureAdAttribution(search: string, pathname: string) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(search);
  if (!isAdLandingPath(pathname) && !isAdClickParams(params)) return;
  sessionStorage.setItem(AD_VISITOR_KEY, "1");
  const utms = pickUtmParams(params);
  if (Object.keys(utms).length > 0) {
    sessionStorage.setItem(AD_UTM_KEY, JSON.stringify(utms));
  }
}

export function readAdVisitor(pathname: string) {
  if (typeof window === "undefined") return isAdLandingPath(pathname);
  if (isAdLandingPath(pathname)) return true;
  return sessionStorage.getItem(AD_VISITOR_KEY) === "1";
}

export function readAdUtms(): AdUtmParams | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(AD_UTM_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdUtmParams;
  } catch {
    return null;
  }
}
