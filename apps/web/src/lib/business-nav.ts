import { HOSTING_PLACEHOLDER_BUSINESS_ID } from "./business-route";

export const BUSINESS_PANEL_SEGMENTS = [
  "conversations",
  "faqs",
  "appointments",
  "catalog",
  "status",
  "payments",
  "whatsapp",
  "settings",
] as const;

export type BusinessPanelSegment = (typeof BUSINESS_PANEL_SEGMENTS)[number];

function normPath(path: string): string {
  return (path.split("?")[0] ?? path).replace(/\/$/, "") || "/";
}

export function isActivePanelRoute(pathname: string, href: string): boolean {
  const p = normPath(pathname);
  const h = normPath(href);
  if (isBusinessPanelHref(h)) {
    if (p !== h && !p.startsWith(`${h}/`)) return false;
  } else if (h === "/businesses") {
    if (p !== h && p !== "/businesses/new") return false;
  } else if (p !== h) {
    return false;
  }
  if (typeof window === "undefined") return true;
  const current = new URLSearchParams(window.location.search);
  if (href.includes("?")) {
    const want = new URLSearchParams(href.split("?")[1] ?? "");
    for (const [key, value] of want.entries()) {
      if (current.get(key) !== value) return false;
    }
    return true;
  }
  if (current.has("sec") && h.endsWith("/faqs")) return false;
  return true;
}

export function panelHref(businessId: string, segment: string): string {
  return `/businesses/${businessId}/${segment}`;
}

export function getBusinessPanelSegment(pathname: string): BusinessPanelSegment | null {
  const m = normPath(pathname).match(/\/businesses\/[^/]+\/([^/]+)$/);
  const seg = m?.[1];
  return BUSINESS_PANEL_SEGMENTS.includes(seg as BusinessPanelSegment)
    ? (seg as BusinessPanelSegment)
    : null;
}

export function isBusinessPanelHref(href: string): boolean {
  return getBusinessPanelSegment(href) !== null;
}

export { HOSTING_PLACEHOLDER_BUSINESS_ID };
