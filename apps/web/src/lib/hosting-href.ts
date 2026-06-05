import { normalizeHostingBusinessPath } from "@/lib/business-route";
import { isStaticHostingClient } from "@/lib/static-hosting";

export function isFirebaseHostingClient(): boolean {
  return isStaticHostingClient();
}

function withTrailingSlash(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

export function hostingHref(href: string): string {
  if (!isStaticHostingClient()) return href;

  const hashIdx = href.indexOf("#");
  const hash = hashIdx >= 0 ? href.slice(hashIdx) : "";
  const withoutHash = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const qIdx = withoutHash.indexOf("?");
  let pathname = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;
  const search = qIdx >= 0 ? withoutHash.slice(qIdx) : "";

  if (/\.[a-z0-9]{2,8}$/i.test(pathname)) {
    return pathname + search + hash;
  }

  const normalized = normalizeHostingBusinessPath(pathname);
  if (normalized) pathname = normalized;

  return withTrailingSlash(pathname) + search + hash;
}

export function toHostingAbsoluteUrl(href: string): string {
  const path = hostingHref(href);
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).href;
}

export function hardNavigateHosting(href: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(toHostingAbsoluteUrl(href));
}
